const fs = require("fs");
const https = require("https");
const path = require("path");
const { Client } = require("pg");

const GITHUB_HEADERS = {
  "User-Agent": "codex-block-watch-importer",
  Accept: "application/vnd.github+json",
};

const AGGREGATE_CATEGORIES = new Set(["basic", "everything"]);
const OISD_SOURCE = {
  owner: "sjhgvr",
  repo: "oisd",
  ref: "main",
  path: "oisd_big.txt",
  category: "oisd",
  priority: 0,
};
const DB_BATCH_SIZE = 500;

function hasFlag(name) {
  return process.argv.includes(name);
}

function ensureDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  if (databaseUrl.includes("[YOUR-PASSWORD]")) {
    throw new Error("DATABASE_URL still contains the [YOUR-PASSWORD] placeholder.");
  }

  return databaseUrl;
}

function getHttpsResponse(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers,
      },
      (response) => {
        const { statusCode, headers: responseHeaders } = response;

        if (statusCode >= 300 && statusCode < 400 && responseHeaders.location) {
          response.resume();
          resolve(getHttpsResponse(responseHeaders.location, headers));
          return;
        }

        if (statusCode !== 200) {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => {
            reject(new Error(`Request failed for ${url}: ${statusCode} ${body.slice(0, 200)}`));
          });
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
      }
    );

    request.on("error", reject);
  });
}

async function fetchJson(url) {
  const body = await getHttpsResponse(url, GITHUB_HEADERS);
  return JSON.parse(body);
}

async function fetchText(url) {
  return getHttpsResponse(url, GITHUB_HEADERS);
}

function isIPv4(value) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value);
}

function isIPv6(value) {
  return value.includes(":") && /^[0-9a-f:.]+$/i.test(value);
}

function sanitizeToken(token) {
  return token
    .trim()
    .replace(/^0\.0\.0\.0\s+/, "")
    .replace(/^127\.0\.0\.1\s+/, "")
    .replace(/^::1?\s+/, "")
    .replace(/^\|\|/, "")
    .replace(/^\*\./, "")
    .replace(/\^.*$/, "")
    .replace(/\$.*$/, "")
    .replace(/\.$/, "")
    .trim();
}

function extractDomain(line) {
  const withoutComment = line.split("#")[0].trim();
  if (!withoutComment || withoutComment.startsWith("!") || withoutComment.startsWith("[")) {
    return null;
  }

  const parts = withoutComment.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return null;
  }

  let candidate = parts[0];
  if ((isIPv4(candidate) || isIPv6(candidate)) && parts[1]) {
    candidate = parts[1];
  }

  candidate = sanitizeToken(candidate).toLowerCase();
  if (!candidate || candidate === "localhost" || candidate.includes("@")) {
    return null;
  }

  if (candidate.includes("://")) {
    try {
      candidate = new URL(candidate).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  candidate = candidate.replace(/^www\./, "");
  if (!candidate || candidate.includes("/") || isIPv4(candidate) || isIPv6(candidate) || !candidate.includes(".")) {
    return null;
  }

  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(candidate)) {
    return null;
  }

  return candidate;
}

function parseDomainList(content) {
  const domains = [];

  for (const line of content.split(/\r?\n/)) {
    const domain = extractDomain(line);
    if (domain) {
      domains.push(domain);
    }
  }

  return domains;
}

function getPriorityForCategory(category) {
  if (category === "oisd") {
    return 0;
  }

  if (AGGREGATE_CATEGORIES.has(category)) {
    return 1;
  }

  return 2;
}

async function discoverBlocklistProjectSources() {
  const items = await fetchJson("https://api.github.com/repos/blocklistproject/Lists/contents");
  if (!Array.isArray(items)) {
    throw new Error("Unexpected GitHub API response while discovering Blocklist Project sources.");
  }

  return items
    .filter((item) => item.type === "file" && item.name.endsWith(".txt"))
    .map((item) => ({
      owner: "blocklistproject",
      repo: "Lists",
      ref: "master",
      path: item.path,
      category: path.basename(item.name, ".txt").toLowerCase(),
      priority: getPriorityForCategory(path.basename(item.name, ".txt").toLowerCase()),
      downloadUrl:
        item.download_url ||
        `https://raw.githubusercontent.com/blocklistproject/Lists/master/${encodeURI(item.path)}`,
    }))
    .sort((left, right) => left.category.localeCompare(right.category));
}

function mergeDomain(map, domain, category, priority) {
  const existing = map.get(domain);
  if (!existing || priority > existing.priority || (priority === existing.priority && category < existing.category)) {
    map.set(domain, { domain, category, priority });
  }
}

function chunk(list, size) {
  const batches = [];
  for (let index = 0; index < list.length; index += size) {
    batches.push(list.slice(index, index + size));
  }
  return batches;
}

async function collectDomainsFromSources(sources) {
  const uniqueDomains = new Map();
  const sourceCounts = [];
  let parsedCount = 0;

  for (const source of sources) {
    const url =
      source.downloadUrl ||
      `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.ref}/${source.path}`;
    const content = await fetchText(url);
    const domains = parseDomainList(content);
    parsedCount += domains.length;

    for (const domain of domains) {
      mergeDomain(uniqueDomains, domain, source.category, source.priority);
    }

    sourceCounts.push({
      category: source.category,
      fetchedDomains: domains.length,
    });
  }

  return {
    rows: Array.from(uniqueDomains.values()).map((entry) => ({
      domain: entry.domain,
      category: entry.category,
      discoveredAt: new Date().toISOString(),
    })),
    parsedCount,
    sourceCounts,
  };
}

async function getExistingDomains(client, domains) {
  const existing = new Set();

  for (const batch of chunk(domains, DB_BATCH_SIZE)) {
    const result = await client.query(
      `
        select domain
        from securly_mirrored_blocks
        where domain = any($1::text[])
      `,
      [batch]
    );

    for (const row of result.rows) {
      existing.add(row.domain);
    }
  }

  return existing;
}

async function upsertRows(client, rows) {
  const existingDomains = await getExistingDomains(
    client,
    rows.map((row) => row.domain)
  );

  let insertedCount = 0;
  let updatedCount = 0;

  for (const batch of chunk(rows, DB_BATCH_SIZE)) {
    const values = [];
    const placeholders = batch.map((row, index) => {
      const offset = index * 3;
      values.push(row.domain, row.category, row.discoveredAt);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
    });

    await client.query(
      `
        insert into securly_mirrored_blocks (domain, category, discovered_at)
        values ${placeholders.join(", ")}
        on conflict (domain) do update
        set category = excluded.category,
            discovered_at = excluded.discovered_at
      `,
      values
    );
  }

  for (const row of rows) {
    if (existingDomains.has(row.domain)) {
      updatedCount += 1;
    } else {
      insertedCount += 1;
    }
  }

  return { insertedCount, updatedCount };
}

function printSummary(summary) {
  console.log(`Fetched ${summary.sourcesFetched} source files.`);
  console.log(`Parsed ${summary.parsedCount} domain lines.`);
  console.log(`Prepared ${summary.uniqueCount} unique domains.`);
  if (typeof summary.insertedCount === "number") {
    console.log(`Inserted ${summary.insertedCount} new rows.`);
  }
  if (typeof summary.updatedCount === "number") {
    console.log(`Updated ${summary.updatedCount} existing rows.`);
  }
  console.log("Top source categories:");

  summary.sourceCounts
    .sort((left, right) => right.fetchedDomains - left.fetchedDomains)
    .slice(0, 10)
    .forEach((entry) => {
      console.log(`- ${entry.category}: ${entry.fetchedDomains}`);
    });
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const blocklistProjectSources = await discoverBlocklistProjectSources();
  const sources = [...blocklistProjectSources, OISD_SOURCE];
  const { rows, parsedCount, sourceCounts } = await collectDomainsFromSources(sources);

  const summary = {
    sourcesFetched: sources.length,
    parsedCount,
    uniqueCount: rows.length,
    sourceCounts,
  };

  if (dryRun) {
    printSummary(summary);
    return;
  }

  const databaseUrl = ensureDatabaseUrl();
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(schema);
    const { insertedCount, updatedCount } = await upsertRows(client, rows);
    printSummary({
      ...summary,
      insertedCount,
      updatedCount,
    });
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
