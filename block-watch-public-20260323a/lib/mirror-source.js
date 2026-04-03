const fs = require("fs");
const https = require("https");
const path = require("path");
const { getPreferredDisplayName, titleFromDomain } = require("./normalize");

const SNAPSHOT_PATH = path.join(__dirname, "..", "data", "mirrored-catalog-snapshot.json");
const GITHUB_HEADERS = {
  "User-Agent": "codex-block-watch-mirror",
  Accept: "application/vnd.github+json",
};
const AGGREGATE_CATEGORIES = new Set(["basic", "everything"]);
const CATEGORY_ALIASES = {
  fortnite: ["games", "gaming"],
  facebook: ["social", "social-media"],
  twitter: ["social", "social-media"],
  tiktok: ["social", "social-media"],
  whatsapp: ["social", "social-media", "chat"],
  youtube: ["streaming", "video"],
  "smart-tv": ["streaming", "video"],
  malware: ["security"],
  phishing: ["security"],
  ransomware: ["security"],
  scam: ["security", "fraud"],
  fraud: ["security", "fraud"],
  ads: ["advertising"],
  tracking: ["advertising", "privacy"],
  redirect: ["advertising"],
  torrent: ["piracy", "downloads"],
  piracy: ["downloads"],
  porn: ["adult"],
  gambling: ["betting"],
  crypto: ["cryptocurrency"],
  oisd: ["general", "privacy", "security"],
};
const SNAPSHOT_MAX_ROWS_PER_SOURCE = 250;
const LIVE_FETCH_TIMEOUT_MS = 1500;
const LIVE_CACHE_TTL_MS = 15 * 60 * 1000;

const BLOCKLIST_PROJECT_FILES = [
  "abuse",
  "adobe",
  "ads",
  "basic",
  "crypto",
  "drugs",
  "everything",
  "facebook",
  "fortnite",
  "fraud",
  "gambling",
  "malware",
  "phishing",
  "piracy",
  "porn",
  "ransomware",
  "redirect",
  "scam",
  "smart-tv",
  "tiktok",
  "torrent",
  "tracking",
  "twitter",
  "vaping",
  "whatsapp",
  "youtube",
];

const SOURCE_MANIFEST = [
  ...BLOCKLIST_PROJECT_FILES.map((name) => ({
    owner: "blocklistproject",
    repo: "Lists",
    ref: "master",
    path: `${name}.txt`,
    category: name,
    priority: getPriorityForCategory(name),
  })),
  {
    owner: "sjhgvr",
    repo: "oisd",
    ref: "main",
    path: "oisd_big.txt",
    category: "oisd",
    priority: 0,
  },
];

let cachedSnapshot;
let liveMirrorCache;

function getPriorityForCategory(category) {
  if (category === "oisd") {
    return 0;
  }

  if (AGGREGATE_CATEGORIES.has(category)) {
    return 1;
  }

  return 2;
}

function getRawGithubUrl(source) {
  return `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.ref}/${source.path}`;
}

function buildSearchCategories(categories) {
  const expanded = new Set();

  for (const category of categories) {
    expanded.add(category);
    for (const alias of CATEGORY_ALIASES[category] || []) {
      expanded.add(alias);
    }
  }

  return Array.from(expanded);
}

function buildSiteSummary(domain, category, timestamp, sourceCategories = [category]) {
  return {
    domain,
    displayName: getPreferredDisplayName(domain, titleFromDomain(domain)),
    reason: category,
    firstSeen: timestamp,
    lastSeen: timestamp,
    eventCount: 1,
    sourceCategories: buildSearchCategories(sourceCategories),
  };
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

function mergeDomain(map, domain, category, priority, timestamp) {
  const existing = map.get(domain);
  if (!existing) {
    map.set(domain, {
      domain,
      category,
      priority,
      sourceCategories: new Set([category]),
      timestamp,
    });
    return;
  }

  existing.sourceCategories.add(category);

  if (priority > existing.priority || (priority === existing.priority && category < existing.category)) {
    existing.category = category;
    existing.priority = priority;
  }
}

function buildStats(sites) {
  const lastSeen = sites.reduce((latest, site) => {
    return !latest || new Date(site.lastSeen) > new Date(latest) ? site.lastSeen : latest;
  }, null);

  return {
    blockedSiteCount: sites.length,
    eventCount: sites.reduce((sum, site) => sum + (site.eventCount || 0), 0),
    lastSeen,
  };
}

function toPublicSite(site) {
  return {
    domain: site.domain,
    displayName: site.displayName,
    reason: site.reason,
    firstSeen: site.firstSeen,
    lastSeen: site.lastSeen,
    eventCount: site.eventCount,
  };
}

function searchSites(sites, query) {
  const search = String(query || "").trim().toLowerCase();
  if (!search) {
    return sites;
  }

  return sites.filter((site) => {
    const sourceCategories = Array.isArray(site.sourceCategories) ? site.sourceCategories.join(" ") : "";
    return (
      site.domain.toLowerCase().includes(search) ||
      site.displayName.toLowerCase().includes(search) ||
      site.reason.toLowerCase().includes(search) ||
      sourceCategories.toLowerCase().includes(search)
    );
  });
}

function sortSites(sites) {
  return [...sites].sort((left, right) => {
    const leftTime = new Date(left.lastSeen || left.firstSeen || 0).getTime();
    const rightTime = new Date(right.lastSeen || right.firstSeen || 0).getTime();
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return left.domain.localeCompare(right.domain);
  });
}

function readSnapshotFile() {
  if (!cachedSnapshot) {
    const raw = fs.readFileSync(SNAPSHOT_PATH, "utf8");
    cachedSnapshot = JSON.parse(raw);
  }

  return cachedSnapshot;
}

function getSnapshotCatalog(query) {
  const snapshot = readSnapshotFile();
  const filteredSites = sortSites(searchSites(snapshot.sites || [], query)).slice(0, 100).map(toPublicSite);

  return {
    sites: filteredSites,
    stats: snapshot.stats || buildStats(snapshot.sites || []),
    syncStatus: {
      source: "mirror-snapshot",
      status: snapshot.truncated ? "mirror_snapshot_truncated" : "mirror_snapshot",
      importedCount: snapshot.stats?.blockedSiteCount || filteredSites.length,
      failedCount: 0,
      startedAt: null,
      completedAt: snapshot.generatedAt || null,
    },
    dataSource: "mirror",
    meta: {
      generatedAt: snapshot.generatedAt || null,
      truncated: Boolean(snapshot.truncated),
      totalSites: snapshot.stats?.blockedSiteCount || 0,
    },
  };
}

function getHttpsText(url, timeoutMs = LIVE_FETCH_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: GITHUB_HEADERS,
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          resolve(getHttpsText(response.headers.location, timeoutMs));
          return;
        }

        if (response.statusCode !== 200) {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => {
            reject(new Error(`Request failed for ${url}: ${response.statusCode} ${body.slice(0, 200)}`));
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

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Timed out fetching ${url}`));
    });
    request.on("error", reject);
  });
}

async function fetchSourceSites(source, generatedAt, maxRowsPerSource = Infinity, timeoutMs = LIVE_FETCH_TIMEOUT_MS) {
  const content = await getHttpsText(getRawGithubUrl(source), timeoutMs);
  const parsedDomains = parseDomainList(content);
  const uniqueDomains = [];
  const seen = new Set();

  for (const domain of parsedDomains) {
    if (seen.has(domain)) {
      continue;
    }

    seen.add(domain);
    uniqueDomains.push(domain);

    if (uniqueDomains.length >= maxRowsPerSource) {
      break;
    }
  }

  return uniqueDomains.map((domain) => ({
    domain,
    category: source.category,
    priority: source.priority,
    site: buildSiteSummary(domain, source.category, generatedAt),
  }));
}

async function buildMirroredDataset({ maxRowsPerSource = SNAPSHOT_MAX_ROWS_PER_SOURCE, timeoutMs = LIVE_FETCH_TIMEOUT_MS } = {}) {
  const generatedAt = new Date().toISOString();
  const uniqueDomains = new Map();

  const allSourceRows = await Promise.all(
    SOURCE_MANIFEST.map((source) => fetchSourceSites(source, generatedAt, maxRowsPerSource, timeoutMs))
  );

  for (const rows of allSourceRows) {
    for (const row of rows) {
      mergeDomain(uniqueDomains, row.domain, row.category, row.priority, generatedAt);
    }
  }

  const sites = sortSites(
    Array.from(uniqueDomains.values()).map((entry) =>
      buildSiteSummary(entry.domain, entry.category, entry.timestamp, Array.from(entry.sourceCategories))
    )
  );

  return {
    generatedAt,
    truncated: Number.isFinite(maxRowsPerSource),
    maxRowsPerSource,
    sourceCount: SOURCE_MANIFEST.length,
    sites,
    stats: buildStats(sites),
  };
}

async function getLiveMirrorCatalog(query) {
  const now = Date.now();
  if (liveMirrorCache && now - liveMirrorCache.fetchedAt < LIVE_CACHE_TTL_MS) {
    const filteredSites = sortSites(searchSites(liveMirrorCache.snapshot.sites, query)).slice(0, 100).map(toPublicSite);
    return {
      sites: filteredSites,
      stats: liveMirrorCache.snapshot.stats,
      syncStatus: {
        source: "mirror-live",
        status: "mirror_live",
        importedCount: liveMirrorCache.snapshot.stats.blockedSiteCount,
        failedCount: 0,
        startedAt: null,
        completedAt: liveMirrorCache.snapshot.generatedAt,
      },
      dataSource: "mirror",
      meta: {
        generatedAt: liveMirrorCache.snapshot.generatedAt,
        truncated: liveMirrorCache.snapshot.truncated,
        totalSites: liveMirrorCache.snapshot.stats.blockedSiteCount,
      },
    };
  }

  const snapshot = await buildMirroredDataset({ maxRowsPerSource: SNAPSHOT_MAX_ROWS_PER_SOURCE, timeoutMs: LIVE_FETCH_TIMEOUT_MS });
  liveMirrorCache = {
    fetchedAt: now,
    snapshot,
  };

  const filteredSites = sortSites(searchSites(snapshot.sites, query)).slice(0, 100).map(toPublicSite);
  return {
    sites: filteredSites,
    stats: snapshot.stats,
    syncStatus: {
      source: "mirror-live",
      status: "mirror_live",
      importedCount: snapshot.stats.blockedSiteCount,
      failedCount: 0,
      startedAt: null,
      completedAt: snapshot.generatedAt,
    },
    dataSource: "mirror",
    meta: {
      generatedAt: snapshot.generatedAt,
      truncated: snapshot.truncated,
      totalSites: snapshot.stats.blockedSiteCount,
    },
  };
}

async function getMirroredCatalog(query) {
  const snapshotPayload = getSnapshotCatalog(query);

  try {
    return await Promise.race([
      getLiveMirrorCatalog(query),
      new Promise((resolve) => setTimeout(() => resolve(snapshotPayload), LIVE_FETCH_TIMEOUT_MS + 150)),
    ]);
  } catch {
    return snapshotPayload;
  }
}

module.exports = {
  SNAPSHOT_PATH,
  SNAPSHOT_MAX_ROWS_PER_SOURCE,
  SOURCE_MANIFEST,
  buildMirroredDataset,
  buildStats,
  getMirroredCatalog,
  getSnapshotCatalog,
  parseDomainList,
};
