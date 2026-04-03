const { requireAdmin } = require("../../lib/auth");
const { getQueryParam, sendError, sendJson } = require("../../lib/http");
const { getAdminLookups } = require("../../lib/repository");

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
    const lookups = await getAdminLookups(safeLimit);
    sendJson(res, 200, { lookups });
  } catch (error) {
    sendError(res, 500, "Failed to load lookup logs.", error.message);
  }
};
