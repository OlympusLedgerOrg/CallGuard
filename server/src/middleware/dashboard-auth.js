const jwt = require("jsonwebtoken");
const cfg = require("../config");

function parseCookies(header = "") {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const idx = part.indexOf("=");
      if (idx === -1) return acc;
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (!key) return acc;
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function getToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[cfg.authCookieName] || "";
}

function isAuthConfigured() {
  return Boolean(cfg.dashboardJwtSecret);
}

function requireDashboardAuth(req, res, next) {
  if (!isAuthConfigured()) {
    if (cfg.dashboardAuthRequired) {
      return res.status(500).json({ error: "Dashboard auth not configured" });
    }
    return next();
  }

  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, cfg.dashboardJwtSecret, {
      issuer: "callguard",
      audience: "dashboard",
    });
    req.auth = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

module.exports = {
  requireDashboardAuth,
  isAuthConfigured,
  getToken,
};
