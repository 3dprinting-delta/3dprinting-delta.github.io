const { requireAdmin } = require("../../../lib/auth");
const { sendError, sendJson } = require("../../../lib/http");
const { normalizeDomain } = require("../../../lib/normalize");
const { getAdminSite } = require("../../../lib/repository");

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  if (req.method !== "GET") {
    sendError(res, 405, "Method not allowed.");
    return;
  }

  try {
    const routeParam = req.query?.domain;
    const domain = normalizeDomain(Array.isArray(routeParam) ? routeParam[0] : routeParam);

    if (!domain) {
      sendError(res, 400, "A valid domain is required.");
      return;
    }

    const result = await getAdminSite(domain);
    if (!result.site) {
      sendError(res, 404, "Domain not found.");
      return;
    }

    sendJson(res, 200, result);
  } catch (error) {
    sendError(res, 500, "Failed to load admin site details.", error.message);
  }
};
