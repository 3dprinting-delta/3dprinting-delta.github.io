const { requireSharedSecret } = require("../../lib/auth");
const { parseRequestBody, sendError, sendJson } = require("../../lib/http");
const { upsertNormalizedEvents, recordSyncStart, recordSyncCompletion } = require("../../lib/repository");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed.");
    return;
  }

  if (!requireSharedSecret(req, res, process.env.INGEST_SHARED_SECRET)) {
    return;
  }

  const syncRun = await recordSyncStart("manual-ingest", { triggeredBy: "webhook" });

  try {
    const body = await parseRequestBody(req);
    const events = Array.isArray(body) ? body : body.events;

    if (!Array.isArray(events)) {
      await recordSyncCompletion(syncRun.id, "failed", 0, 1, {
        message: "Request body must contain an events array.",
      });
      sendError(res, 400, "Request body must contain an events array.");
      return;
    }

    const result = await upsertNormalizedEvents(events);
    const status = result.failedCount > 0 ? "partial" : "success";

    await recordSyncCompletion(syncRun.id, status, result.importedCount, result.failedCount, {
      receivedCount: events.length,
      failures: result.failures.slice(0, 20),
    });

    sendJson(res, 200, {
      status,
      receivedCount: events.length,
      ...result,
    });
  } catch (error) {
    await recordSyncCompletion(syncRun.id, "failed", 0, 1, { message: error.message });
    sendError(res, 500, "Ingest failed.", error.message);
  }
};
