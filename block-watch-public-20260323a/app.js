const policyUrl = "https://support.securly.com/hc/en-us";

const state = {
  sites: [],
  selectedDomain: "",
  query: typeof window !== "undefined" ? window.__INITIAL_QUERY__ || "" : "",
  syncStatus: null,
  dataSource: "live",
};

const refs = {
  siteList: document.querySelector("#site-list"),
  search: document.querySelector("#site-search"),
  clear: document.querySelector("#clear-search"),
  blockedCount: document.querySelector("#blocked-count"),
  eventCount: document.querySelector("#event-count"),
  lastRefresh: document.querySelector("#last-refresh"),
  feedStatus: document.querySelector("#feed-status"),
  focusTitle: document.querySelector("#focus-title"),
  focusFirstSeen: document.querySelector("#focus-first-seen"),
  focusLastSeen: document.querySelector("#focus-last-seen"),
  focusEvents: document.querySelector("#focus-events"),
  focusReason: document.querySelector("#focus-reason"),
  focusGuidance: document.querySelector("#focus-guidance"),
  requestTemplate: document.querySelector("#request-template"),
  copyRequest: document.querySelector("#copy-request"),
  policyLink: document.querySelector("#policy-link"),
  template: document.querySelector("#site-item-template"),
  publicError: document.querySelector("#public-error"),
  resultsStatus: document.querySelector("#results-status"),
  verdictCard: document.querySelector("#verdict-card"),
  verdictLabel: document.querySelector("#verdict-label"),
  verdictCopy: document.querySelector("#verdict-copy"),
};

function formatDate(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRelative(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
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

function getPreferredDisplayName(domain, displayName) {
  const fallback = domain || "Unknown domain";
  const resolved = String(displayName || "").trim();
  const normalized = resolved.replace(/\s+/g, " ").trim();
  const tokens = normalized.split(" ").filter(Boolean);
  const alphaTokens = tokens.filter((token) => /[a-z]/i.test(token));
  const longAlphaTokens = alphaTokens.filter((token) => token.replace(/[^a-z]/gi, "").length >= 3);
  const alphaCount = (normalized.match(/[a-z]/gi) || []).length;
  const startsWithDigit = /^\d/.test(normalized);

  if (!normalized) {
    return fallback;
  }

  if (normalized.toLowerCase() === String(domain || "").toLowerCase()) {
    return fallback;
  }

  if (startsWithDigit && longAlphaTokens.length === 0) {
    return fallback;
  }

  if (alphaCount < 3) {
    return fallback;
  }

  if (tokens.length >= 3 && longAlphaTokens.length === 0) {
    return fallback;
  }

  return normalized;
}

function getSiteHeading(site) {
  const preferred = getPreferredDisplayName(site.domain, site.displayName);
  return preferred.toLowerCase() === String(site.domain || "").toLowerCase()
    ? site.domain
    : `${preferred} (${site.domain})`;
}

function getSiteListLabel(site) {
  const preferred = getPreferredDisplayName(site.domain, site.displayName);
  return preferred.toLowerCase() === String(site.domain || "").toLowerCase()
    ? site.domain
    : `${preferred} · ${site.domain}`;
}

function getFeedStatusText(syncStatus) {
  if (!syncStatus) {
    return "Waiting for the first successful sync";
  }

  if (syncStatus.status === "mirror_snapshot" || syncStatus.status === "mirror_snapshot_truncated") {
    return "Mirror catalog active";
  }

  if (syncStatus.status === "mirror_live") {
    return "Live mirror refresh active";
  }

  if (syncStatus.status === "mirror_unavailable") {
    return "Mirror catalog unavailable";
  }

  return `${syncStatus.status} · last sync ${formatRelative(syncStatus.completedAt || syncStatus.startedAt)}`;
}

function getReviewGuidance(site) {
  return `Request a review with the exact URL needed for ${getPreferredDisplayName(site.domain, site.displayName)}. This public checker only shows anonymous, domain-level summaries, so staff should confirm the academic purpose and specific destination before approving access.`;
}

function makeRequestMessage(site) {
  return [
    `Hello, I would like a review for ${getPreferredDisplayName(site.domain, site.displayName)} (${site.domain}).`,
    "",
    "Reason for access: [add class or project purpose here]",
    "Specific page or resource needed: [paste exact URL here]",
    "Why it is needed: [brief explanation]",
    "",
    `The domain first appeared blocked on ${formatDate(site.firstSeen)} and was most recently flagged on ${formatDate(site.lastSeen)}.`,
    "",
    "Please let me know if there is an approved alternative if access cannot be granted.",
  ].join("\n");
}

function getVisibleSites() {
  return state.sites;
}

function getExactMatch() {
  const normalizedQuery = normalizeDomain(state.query);
  if (!normalizedQuery) {
    return null;
  }

  return state.sites.find((site) => normalizeDomain(site.domain) === normalizedQuery) || null;
}

function setVerdict(type, label, copy) {
  refs.verdictCard.className = `verdict-card verdict-${type}`;
  refs.verdictLabel.textContent = label;
  refs.verdictCopy.textContent = copy;
}

function renderVerdict() {
  const exactMatch = getExactMatch();

  if (!state.query.trim()) {
    if (state.dataSource === "mirror") {
      setVerdict("idle", "Mirror catalog loaded", "Browsing the mirrored blocked-domain catalog.");
      return;
    }

    setVerdict("idle", "Catalog loaded", "Browsing the currently documented blocked-domain dataset.");
    return;
  }

  if (state.dataSource === "mirror") {
    if (exactMatch) {
      setVerdict("found", "Found in mirror catalog", `${exactMatch.domain} appears in the mirrored blocked-domain catalog.`);
    } else {
      setVerdict("not-found", "No record found", "That domain is not present in the mirrored blocked-domain catalog.");
    }
    return;
  }

  if (state.syncStatus?.status === "mirror_unavailable") {
    setVerdict("not-configured", "Mirror unavailable", "The mirrored blocked-domain catalog could not be loaded.");
    return;
  }

  if (exactMatch) {
    setVerdict("found", "Found in dataset", `${exactMatch.domain} appears in the blocked-domain dataset.`);
  } else {
    setVerdict("not-found", "No record found", "That domain is not present in the current dataset.");
  }
}

function renderFocusCard() {
  const site = state.sites.find((candidate) => candidate.domain === state.selectedDomain);

  if (!site) {
    refs.focusTitle.textContent = state.query.trim()
      ? "No documented record found for this search"
      : "Pick a documented domain to inspect it";
    refs.focusFirstSeen.textContent = "--";
    refs.focusLastSeen.textContent = "--";
    refs.focusEvents.textContent = "--";
    refs.focusReason.textContent = "--";
    refs.focusGuidance.textContent = state.query.trim()
      ? "No matching domain is documented in the currently loaded catalog."
      : "Browse the catalog or search above to inspect a domain.";
    refs.requestTemplate.value = "";
    refs.policyLink.href = policyUrl;
    return;
  }

  refs.focusTitle.textContent = getSiteHeading(site);
  refs.focusFirstSeen.textContent = formatDate(site.firstSeen);
  refs.focusLastSeen.textContent = formatDate(site.lastSeen);
  refs.focusEvents.textContent = `${site.eventCount} total events`;
  refs.focusReason.textContent = site.reason;
  refs.focusGuidance.textContent = getReviewGuidance(site);
  refs.requestTemplate.value = makeRequestMessage(site);
  refs.policyLink.href = policyUrl;
}

function renderSiteList() {
  const visibleSites = getVisibleSites();
  refs.siteList.innerHTML = "";

  if (!visibleSites.length) {
    const empty = document.createElement("li");
    empty.className = "glass card";
    empty.textContent = state.query.trim()
      ? "No documented domain matches that search."
      : "No blocked domains are currently documented.";
    refs.siteList.appendChild(empty);
    refs.resultsStatus.textContent = state.query.trim()
      ? "No documented domain matches that search."
      : "No documented blocked domains are loaded.";
    state.selectedDomain = "";
    return;
  }

  const exactMatch = getExactMatch();
  state.selectedDomain = exactMatch?.domain || visibleSites[0].domain;
  refs.resultsStatus.textContent = `Showing ${visibleSites.length} documented blocked domain${visibleSites.length === 1 ? "" : "s"}.`;

  visibleSites.forEach((site, index) => {
    const fragment = refs.template.content.cloneNode(true);
    const item = fragment.querySelector(".site-item");
    const button = fragment.querySelector(".site-button");

    if (index < 10) {
      item.classList.add("site-item-enhanced");
      item.style.animationDelay = `${index * 35}ms`;
    }

    fragment.querySelector(".site-name").textContent = getSiteListLabel(site);
    fragment.querySelector(".site-meta").textContent = `First blocked ${formatDate(site.firstSeen)} · Updated ${formatRelative(
      site.lastSeen
    )}`;
    fragment.querySelector(".site-count").textContent = `${site.eventCount} hits`;

    if (site.domain === state.selectedDomain) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      state.selectedDomain = site.domain;
      render();
    });

    refs.siteList.appendChild(fragment);
  });
}

function renderStats(payload) {
  refs.blockedCount.textContent = String(payload.stats?.blockedSiteCount || 0);
  refs.eventCount.textContent = String(payload.stats?.eventCount || 0);
  refs.lastRefresh.textContent = formatRelative(payload.stats?.lastSeen);

  if (payload.syncStatus) {
    state.syncStatus = payload.syncStatus;
    refs.feedStatus.textContent = getFeedStatusText(payload.syncStatus);
  } else {
    refs.feedStatus.textContent = "Waiting for the first successful sync";
  }
}

function applyPayload(payload) {
  state.sites = payload.sites || [];
  state.dataSource = payload.dataSource || "live";
  renderStats(payload);
  render();
}

function render() {
  renderVerdict();
  renderSiteList();
  renderFocusCard();
}

async function loadSites() {
  const query = state.query.trim();
  const url = query ? `/api/public/sites?q=${encodeURIComponent(query)}` : "/api/public/sites";
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Failed to load blocked-domain data.");
  }

  applyPayload(payload);
  refs.publicError.hidden = true;
}

async function refreshForCurrentQuery() {
  refs.publicError.hidden = true;
  refs.resultsStatus.textContent = "Loading catalog...";
  setVerdict("loading", "Checking", "Looking up that domain in the current dataset.");

  try {
    await loadSites();
  } catch (error) {
    refs.publicError.hidden = false;
    refs.publicError.textContent = error.message;
    refs.resultsStatus.textContent = "Unable to load catalog.";
    refs.feedStatus.textContent = "Backend unavailable";
    setVerdict("not-configured", "Unavailable", error.message);
  }
}

refs.search.addEventListener("input", async (event) => {
  state.query = event.target.value;
  await refreshForCurrentQuery();
});

refs.clear.addEventListener("click", async () => {
  state.query = "";
  refs.search.value = "";
  await refreshForCurrentQuery();
});

refs.copyRequest.addEventListener("click", async () => {
  if (!refs.requestTemplate.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(refs.requestTemplate.value);
    refs.copyRequest.textContent = "Copied";
    window.setTimeout(() => {
      refs.copyRequest.textContent = "Copy request message";
    }, 1400);
  } catch {
    refs.copyRequest.textContent = "Copy failed";
    window.setTimeout(() => {
      refs.copyRequest.textContent = "Copy request message";
    }, 1400);
  }
});

if (typeof window !== "undefined" && window.__INITIAL_DATA__) {
  applyPayload(window.__INITIAL_DATA__);
  if (refs.search) {
    refs.search.value = state.query;
  }
} else {
  refreshForCurrentQuery();
}
