function normalizeDomain(input) {
  if (!input || typeof input !== "string") {
    return null;
  }

  const cleaned = input.trim().toLowerCase();
  if (!cleaned) {
    return null;
  }

  try {
    const withProtocol = cleaned.includes("://") ? cleaned : `https://${cleaned}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "");
  } catch {
    return cleaned.replace(/^www\./, "").split("/")[0];
  }
}

function titleFromDomain(domain) {
  if (!domain) {
    return "Unknown domain";
  }

  return (domain.split(".")[0] || domain)
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getPreferredDisplayName(domain, displayName) {
  const fallback = domain || "Unknown domain";
  const resolved = String(displayName || "").trim() || titleFromDomain(domain);
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

function normalizeEvent(event, source = "securly-api") {
  const sourceEventId = String(
    event.sourceEventId || event.id || event.event_id || event.blockId || event.block_id || ""
  ).trim();
  const domain = normalizeDomain(event.domain || event.url || event.fullUrl || event.full_url);
  const blockedAt = event.blockedAt || event.blocked_at || event.timestamp || event.createdAt;
  const reason = String(event.reason || event.category || event.policy || "Blocked by policy").trim();

  if (!sourceEventId || !domain || !blockedAt) {
    return { ok: false, error: "Missing sourceEventId, domain, or blockedAt." };
  }

  const blockedDate = new Date(blockedAt);
  if (Number.isNaN(blockedDate.getTime())) {
    return { ok: false, error: "Invalid blockedAt timestamp." };
  }

  return {
    ok: true,
    value: {
      sourceEventId,
      source,
      domain,
      fullUrl: event.fullUrl || event.full_url || event.url || null,
      blockedAt: blockedDate.toISOString(),
      reason,
      userId: event.userId || event.user_id || null,
      deviceId: event.deviceId || event.device_id || null,
      rawPayload: event,
      displayName: getPreferredDisplayName(domain, event.displayName || titleFromDomain(domain)),
    },
  };
}

module.exports = {
  normalizeDomain,
  titleFromDomain,
  getPreferredDisplayName,
  normalizeEvent,
};
