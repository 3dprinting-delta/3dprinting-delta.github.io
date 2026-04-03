const { requireSharedSecret } = require("../../lib/auth");
const { sendError, sendJson } = require("../../lib/http");
const { syncFromSecurly } = require("../../lib/securly");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    sendError(res, 405, "Method not allowed.");
    return;
  }

  if (!requireSharedSecret(req, res, process.env.CRON_SECRET, "authorization")) {
    return;
  }

  try {
    const result = await syncFromSecurly("vercel-cron");
    sendJson(res, 200, result);
  } catch (error) {
    sendError(res, 500, "Scheduled sync failed.", error.message);
  }
};
