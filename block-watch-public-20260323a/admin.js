const refs = {
  syncState: document.querySelector("#admin-sync-state"),
  imported: document.querySelector("#admin-imported"),
  completed: document.querySelector("#admin-completed"),
  domainSearch: document.querySelector("#admin-domain-search"),
  domainLoad: document.querySelector("#admin-load-domain"),
  domainTitle: document.querySelector("#admin-domain-title"),
  domainFirst: document.querySelector("#admin-domain-first"),
  domainLast: document.querySelector("#admin-domain-last"),
  domainCount: document.querySelector("#admin-domain-count"),
  domainReason: document.querySelector("#admin-domain-reason"),
  eventList: document.querySelector("#admin-event-list"),
  eventTemplate: document.querySelector("#admin-event-template"),
  lookupList: document.querySelector("#admin-lookup-list"),
  lookupTemplate: document.querySelector("#admin-lookup-template"),
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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

function renderEvents(events) {
  refs.eventList.innerHTML = "";

  if (!events.length) {
    const empty = document.createElement("li");
    empty.className = "glass card";
    empty.textContent = "No raw events are available yet.";
    refs.eventList.appendChild(empty);
    return;
  }

  events.forEach((event, index) => {
    const fragment = refs.eventTemplate.content.cloneNode(true);
    fragment.querySelector(".site-item").style.animationDelay = `${index * 35}ms`;
    fragment.querySelector(".site-name").textContent = `${event.domain} · ${event.reason}`;
    fragment.querySelector(".site-meta").textContent = `Blocked ${formatDate(event.blockedAt)} · ${event.fullUrl || "No full URL stored"}`;
    fragment.querySelector(".site-count").textContent = event.source;
    refs.eventList.appendChild(fragment);
  });
}

function renderSyncStatus(syncStatus) {
  refs.syncState.textContent = syncStatus?.status || "unknown";
  refs.imported.textContent = String(syncStatus?.importedCount ?? "--");
  refs.completed.textContent = formatDate(syncStatus?.completedAt);
}

function renderLookups(lookups) {
  refs.lookupList.innerHTML = "";

  if (!lookups.length) {
    const empty = document.createElement("li");
    empty.className = "glass card";
    empty.textContent = "No public lookup logs are available yet.";
    refs.lookupList.appendChild(empty);
    return;
  }

  lookups.forEach((lookup, index) => {
    const fragment = refs.lookupTemplate.content.cloneNode(true);
    fragment.querySelector(".site-item").style.animationDelay = `${index * 35}ms`;
    fragment.querySelector(".site-name").textContent = `${lookup.queriedDomain} · ${lookup.resultType}`;
    fragment.querySelector(".site-meta").textContent = `Searched ${formatDate(lookup.searchedAt)} · ${lookup.matchedDomain || "No matched domain"}`;
    fragment.querySelector(".site-count").textContent = lookup.normalizedDomain;
    refs.lookupList.appendChild(fragment);
  });
}

function renderDomain(payload) {
  const site = payload?.site;

  if (!site) {
    refs.domainTitle.textContent = "Domain not found";
    refs.domainFirst.textContent = "--";
    refs.domainLast.textContent = "--";
    refs.domainCount.textContent = "--";
    refs.domainReason.textContent = "--";
    return;
  }

  refs.domainTitle.textContent = `${site.displayName} (${site.domain})`;
  refs.domainFirst.textContent = formatDate(site.firstSeen);
  refs.domainLast.textContent = formatDate(site.lastSeen);
  refs.domainCount.textContent = `${site.eventCount} total events`;
  refs.domainReason.textContent = site.reason;
}

async function loadEvents() {
  const [eventsPayload, lookupsPayload] = await Promise.all([
    fetchJson("/api/admin/events"),
    fetchJson("/api/admin/lookups"),
  ]);
  renderEvents(eventsPayload.events || []);
  renderSyncStatus(eventsPayload.syncStatus);
  renderLookups(lookupsPayload.lookups || []);
}

async function loadDomain() {
  const domain = refs.domainSearch.value.trim();
  if (!domain) {
    renderDomain(null);
    return;
  }

  const payload = await fetchJson(`/api/admin/sites/${encodeURIComponent(domain)}`);
  renderDomain(payload);
}

refs.domainLoad.addEventListener("click", () => {
  loadDomain().catch((error) => {
    refs.domainTitle.textContent = error.message;
  });
});

refs.domainSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadDomain().catch((error) => {
      refs.domainTitle.textContent = error.message;
    });
  }
});

loadEvents().catch((error) => {
  refs.eventList.innerHTML = "";
  const item = document.createElement("li");
  item.className = "glass card";
  item.textContent = error.message;
  refs.eventList.appendChild(item);
});
