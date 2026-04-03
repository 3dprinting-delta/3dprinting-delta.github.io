const { upsertNormalizedEvents, recordSyncStart, recordSyncCompletion } = require("./repository");

function getSecurlyConfig() {
  return {
    baseUrl: process.env.SECURLY_API_BASE_URL,
    token: process.env.SECURLY_API_TOKEN,
    path: process.env.SECURLY_API_BLOCK_EVENTS_PATH || "/block-events",
    lookbackMinutes: Number(process.env.SECURLY_SYNC_LOOKBACK_MINUTES || "30"),
  };
}

async function fetchSecurlyEvents() {
  const config = getSecurlyConfig();
  if (!config.baseUrl || !config.token) {
    throw new Error("Securly API configuration is incomplete.");
  }

  const since = new Date(Date.now() - config.lookbackMinutes * 60 * 1000).toISOString();
  const url = new URL(config.path, config.baseUrl);
  url.searchParams.set("since", since);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Securly API request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.events)) {
    return payload.events;
  }

  throw new Error("Securly API response did not contain an events array.");
}

async function syncFromSecurly(triggeredBy = "manual") {
  const syncRun = await recordSyncStart("securly-api", {
    triggeredBy,
  });

  try {
    const events = await fetchSecurlyEvents();
    const result = await upsertNormalizedEvents(events);
    const status = result.failedCount > 0 ? "partial" : "success";

    await recordSyncCompletion(syncRun.id, status, result.importedCount, result.failedCount, {
      fetchedCount: events.length,
      failures: result.failures.slice(0, 20),
    });

    return {
      status,
      fetchedCount: events.length,
      ...result,
    };
  } catch (error) {
    await recordSyncCompletion(syncRun.id, "failed", 0, 1, { message: error.message });
    throw error;
  }
}

module.exports = {
  fetchSecurlyEvents,
  syncFromSecurly,
};
