const { getCatalogPayload } = require("../lib/catalog-data");
const { getPreferredDisplayName } = require("../lib/normalize");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRelative(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const spans = [
    { limit: 60, unit: "second" },
    { limit: 3600, unit: "minute", value: 60 },
    { limit: 86400, unit: "hour", value: 3600 },
    { limit: 604800, unit: "day", value: 86400 },
  ];

  for (const span of spans) {
    if (Math.abs(seconds) < span.limit) {
      return formatter.format(Math.round(seconds / (span.value || 1)), span.unit);
    }
  }

  return formatter.format(Math.round(seconds / 604800), "week");
}

function formatDate(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeDomain(input) {
  const trimmed = String(input || "").trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  try {
    const withProtocol = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^www\./, "").split("/")[0];
  }
}

function getResolvedName(site) {
  return getPreferredDisplayName(site.domain, site.displayName);
}

function getSiteHeading(site) {
  const preferred = getResolvedName(site);
  return preferred.toLowerCase() === String(site.domain || "").toLowerCase()
    ? escapeHtml(site.domain)
    : `${escapeHtml(preferred)} (${escapeHtml(site.domain)})`;
}

function getSiteListLabel(site) {
  const preferred = getResolvedName(site);
  return preferred.toLowerCase() === String(site.domain || "").toLowerCase()
    ? escapeHtml(site.domain)
    : `${escapeHtml(preferred)} · ${escapeHtml(site.domain)}`;
}

function getFeedStatusText(payload) {
  const status = payload.syncStatus?.status;
  if (status === "mirror_snapshot" || status === "mirror_snapshot_truncated") {
    return "Mirror catalog active";
  }

  if (status === "mirror_live") {
    return "Live mirror refresh active";
  }

  if (status === "mirror_unavailable") {
    return "Mirror catalog unavailable";
  }

  return status || "Waiting for the first successful sync";
}

function renderPage(payload, query) {
  const normalizedQuery = normalizeDomain(query);
  const exactMatch = normalizedQuery
    ? payload.sites.find((site) => normalizeDomain(site.domain) === normalizedQuery) || null
    : null;
  const selected = exactMatch || payload.sites[0] || null;

  let verdictLabel = "Catalog loaded";
  let verdictCopy = "Browse the list or search a domain to narrow the documented results.";
  let resultsStatus = `Showing ${payload.sites.length} documented blocked domain${payload.sites.length === 1 ? "" : "s"}.`;

  if (!payload.sites.length && query) {
    verdictLabel = "No record found";
    verdictCopy = "No matching domain is documented in the currently loaded catalog.";
    resultsStatus = "No documented domain matches that search.";
  } else if (!payload.sites.length) {
    verdictLabel = "No catalog data";
    verdictCopy = "No blocked domains are currently documented.";
    resultsStatus = "No documented blocked domains are loaded.";
  } else if (payload.dataSource === "mirror") {
    verdictLabel = query ? (exactMatch ? "Found in mirror catalog" : "No record found") : "Mirror catalog loaded";
    verdictCopy = query
      ? exactMatch
        ? `${exactMatch.domain} appears in the mirrored blocked-domain catalog.`
        : "That domain is not present in the mirrored blocked-domain catalog."
      : "Browsing the mirrored blocked-domain catalog.";
  } else if (query) {
    verdictLabel = exactMatch ? "Found in dataset" : "No record found";
    verdictCopy = exactMatch
      ? `${exactMatch.domain} appears in the blocked-domain dataset.`
      : "That domain is not present in the current dataset.";
  }

  const selectedTitle = selected
    ? getSiteHeading(selected)
    : query
      ? "No documented record found for this search"
      : "Pick a documented domain to inspect it";

  const selectedName = selected ? getResolvedName(selected) : "";
  const selectedGuidance = selected
    ? `Request a review with the exact URL needed for ${escapeHtml(selectedName)}. This public checker only shows anonymous, domain-level summaries, so staff should confirm the academic purpose and specific destination before approving access.`
    : query
      ? "No matching domain is documented in the currently loaded catalog."
      : "Browse the catalog or search above to inspect a domain.";

  const selectedRequest = selected
    ? escapeHtml(
        [
          `Hello, I would like a review for ${selectedName} (${selected.domain}).`,
          "",
          "Reason for access: [add class or project purpose here]",
          "Specific page or resource needed: [paste exact URL here]",
          "Why it is needed: [brief explanation]",
          "",
          `The domain first appeared blocked on ${formatDate(selected.firstSeen)} and was most recently flagged on ${formatDate(selected.lastSeen)}.`,
          "",
          "Please let me know if there is an approved alternative if access cannot be granted.",
        ].join("\n")
      )
    : "";

  const listHtml = payload.sites.length
    ? payload.sites
        .map((site, index) => {
          const itemClass = index < 10 ? "site-item site-item-enhanced" : "site-item";
          const active = selected && site.domain === selected.domain ? " active" : "";
          return `
            <li class="${itemClass}" style="${index < 10 ? `animation-delay:${index * 35}ms` : ""}">
              <button type="button" class="site-button${active}">
                <div>
                  <p class="site-name">${getSiteListLabel(site)}</p>
                  <p class="site-meta">First blocked ${escapeHtml(formatDate(site.firstSeen))} · Updated ${escapeHtml(
                    formatRelative(site.lastSeen)
                  )}</p>
                </div>
                <span class="site-count">${escapeHtml(String(site.eventCount))} hits</span>
              </button>
            </li>
          `;
        })
        .join("")
    : `<li class="glass card">${escapeHtml(resultsStatus)}</li>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Block Watch</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="aurora aurora-one"></div>
    <div class="aurora aurora-two"></div>
    <main class="shell">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Blocked-domain catalog</p>
          <h1>Browse and search the blocked domains currently documented in this dataset.</h1>
          <p class="lede">
            This website documents blocked domains from the current approved dataset and lets you search them by name,
            reason, or domain. When no database is configured, it serves the bundled mirrored blocklist catalog.
          </p>
        </div>
        <div class="hero-status">
          <div class="status-card">
            <span class="dot"></span>
            <div>
              <p class="status-label">Feed status</p>
              <p id="feed-status" class="status-value">${escapeHtml(getFeedStatusText(payload))}</p>
            </div>
          </div>
          <div class="mini-stats">
            <article><span id="blocked-count">${escapeHtml(String(payload.stats.blockedSiteCount || 0))}</span><p>sites tracked</p></article>
            <article><span id="event-count">${escapeHtml(String(payload.stats.eventCount || 0))}</span><p>block events</p></article>
            <article><span id="last-refresh">${escapeHtml(formatRelative(payload.stats.lastSeen))}</span><p>last update</p></article>
          </div>
        </div>
      </section>

      <section class="workspace-panel">
        <section class="glass card privacy-card">
          <div class="card-heading">
            <p class="card-kicker">Dataset notes</p>
            <h2>Public catalog with anonymous aggregated stats</h2>
          </div>
          <p class="guidance">
            This website documents domain-level summaries such as blocked counts, first seen, last seen, and the
            public-facing reason. It does not scan devices, track a user, or record complete browsing histories on the
            public site.
          </p>
        </section>

        <label class="search-panel" for="site-search">
          <span>Search the blocked-domain catalog</span>
          <div class="search-input-wrap">
            <input id="site-search" type="search" placeholder="Try youtube.com, roblox.com, streaming, social..." autocomplete="off" value="${escapeHtml(query)}" />
            <button id="clear-search" type="button">Clear</button>
          </div>
        </label>

        <div class="content-grid">
          <section class="glass card focus-card">
            <div class="card-heading">
              <p class="card-kicker">Selected catalog entry</p>
              <h2 id="focus-title">${selectedTitle}</h2>
            </div>
            <div id="verdict-card" class="verdict-card verdict-idle">
              <p class="card-kicker">Catalog status</p>
              <h3 id="verdict-label">${escapeHtml(verdictLabel)}</h3>
              <p id="verdict-copy" class="guidance">${escapeHtml(verdictCopy)}</p>
            </div>

            <dl class="focus-metrics">
              <div><dt>First blocked</dt><dd id="focus-first-seen">${escapeHtml(formatDate(selected?.firstSeen))}</dd></div>
              <div><dt>Most recent event</dt><dd id="focus-last-seen">${escapeHtml(formatDate(selected?.lastSeen))}</dd></div>
              <div><dt>Events logged</dt><dd id="focus-events">${selected ? escapeHtml(`${selected.eventCount} total events`) : "--"}</dd></div>
              <div><dt>Reason</dt><dd id="focus-reason">${escapeHtml(selected?.reason || "--")}</dd></div>
            </dl>

            <div class="request-box">
              <p class="card-kicker">Approved next step</p>
              <p id="focus-guidance" class="guidance">${selectedGuidance}</p>
              <textarea id="request-template" readonly>${selectedRequest}</textarea>
              <div class="request-actions">
                <button id="copy-request" type="button">Copy request message</button>
                <a id="policy-link" href="https://support.securly.com/hc/en-us" target="_blank" rel="noreferrer">Open policy page</a>
                <a href="/admin.html">Open admin dashboard</a>
              </div>
            </div>
          </section>

          <section class="glass card">
            <div class="card-heading">
              <p class="card-kicker">Documented blocked domains</p>
              <h2>Catalog results</h2>
            </div>
            <p id="results-status" class="results-status">${escapeHtml(resultsStatus)}</p>
            <p id="public-error" class="inline-message" hidden></p>
            <ul id="site-list" class="site-list" aria-live="polite">${listHtml}</ul>
          </section>
        </div>
      </section>
    </main>

    <template id="site-item-template">
      <li class="site-item">
        <button type="button" class="site-button">
          <div>
            <p class="site-name"></p>
            <p class="site-meta"></p>
          </div>
          <span class="site-count"></span>
        </button>
      </li>
    </template>

    <script>window.__INITIAL_DATA__=${JSON.stringify(payload)};window.__INITIAL_QUERY__=${JSON.stringify(query)};</script>
    <script src="/app.js"></script>
  </body>
</html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method not allowed.");
    return;
  }

  try {
    const query = Array.isArray(req.query?.q) ? req.query.q[0] : req.query?.q || "";
    const payload = await getCatalogPayload(query);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(renderPage(payload, query));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(`Failed to render catalog: ${error.message}`);
  }
};
