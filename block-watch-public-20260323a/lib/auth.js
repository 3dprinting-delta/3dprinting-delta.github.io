const { sendError } = require("./http");

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function readBasicAuth(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) {
    return null;
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function requireAdmin(req, res) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    sendError(res, 500, "Admin authentication is not configured.");
    return false;
  }

  const credentials = readBasicAuth(req);
  const ok =
    credentials &&
    constantTimeEqual(credentials.username, username) &&
    constantTimeEqual(credentials.password, password);

  if (!ok) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Block Watch Admin"');
    sendError(res, 401, "Admin authentication required.");
    return false;
  }

  return true;
}

function requireSharedSecret(req, res, expectedSecret, headerName = "x-ingest-secret") {
  if (!expectedSecret) {
    sendError(res, 500, "Shared secret is not configured.");
    return false;
  }

  let candidate = req.headers[headerName];
  if (headerName === "authorization") {
    candidate = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  } else if (!candidate) {
    candidate = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  }

  if (!constantTimeEqual(String(candidate || ""), expectedSecret)) {
    sendError(res, 401, "Invalid shared secret.");
    return false;
  }

  return true;
}

module.exports = {
  requireAdmin,
  requireSharedSecret,
};
