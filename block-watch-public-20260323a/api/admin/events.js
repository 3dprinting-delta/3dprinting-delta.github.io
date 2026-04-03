const { requireAdmin } = require("../../lib/auth");
const { getQueryParam, sendError, sendJson } = require("../../lib/http");
const { getAdminEvents, getLatestSyncStatus } = require("../../lib/repository");

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  if (req.method !== "GET") {
    sendError(res, 405, "Method not allowed.");
    return;
  }

  try {
    const limit = Number(getQueryParam(req, "limit") || "100");
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(250, limit)) : 100;
    const [events, syncStatus] = await Promise.all([getAdminEvents(safeLimit), getLatestSyncStatus()]);
    sendJson(res, 200, { events, syncStatus });
  } catch (error) {
    sendError(res, 500, "Failed to load admin events.", error.message);
  }
};
