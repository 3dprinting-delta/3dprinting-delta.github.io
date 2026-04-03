const { getQueryParam, sendError, sendJson } = require("../../lib/http");
const { normalizeDomain } = require("../../lib/normalize");
const { getCatalogPayload } = require("../../lib/catalog-data");
const { recordPublicLookup } = require("../../lib/repository");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    sendError(res, 405, "Method not allowed.");
    return;
  }

  try {
    const search = getQueryParam(req, "q") || "";
    const payload = await getCatalogPayload(search);

    if (search.trim() && payload.dataSource === "live") {
      const normalizedQuery = normalizeDomain(search);
      const exactMatch = payload.sites.find((site) => normalizeDomain(site.domain) === normalizedQuery);
      await recordPublicLookup(search, exactMatch?.domain || null, exactMatch ? "found" : "not_found");
    }

    sendJson(res, 200, payload);
  } catch (error) {
    sendError(res, 500, "Failed to load public sites.", error.message);
  }
};
