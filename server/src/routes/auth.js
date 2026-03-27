const { Router } = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const cfg = require("../config");
const { requireDashboardAuth, isAuthConfigured } = require("../middleware/dashboard-auth");

const router = Router();
const hasSalt = Boolean(cfg.dashboardPasswordSalt);
const hashSecret = (value) =>
  crypto.scryptSync(String(value), cfg.dashboardPasswordSalt, 64);
const storedUserHash = hasSalt ? hashSecret(cfg.dashboardUser || "") : null;
const storedPassHash = hasSalt ? hashSecret(cfg.dashboardPassword || "") : null;

function getCookieOptions() {
  const ttlMatch = String(cfg.dashboardJwtTtl || "").trim().match(/^(\d+)([smhd])?$/);
  let maxAge;
  if (ttlMatch) {
    const value = Number.parseInt(ttlMatch[1], 10);
    const unit = ttlMatch[2] || "s";
    const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
    maxAge = value * multiplier;
  }

  return {
    httpOnly: true,
    sameSite: "lax",
    secure: cfg.nodeEnv === "production",
    ...(maxAge ? { maxAge } : {}),
  };
}

router.post("/login", (req, res) => {
  if (!isAuthConfigured()) {
    return res.status(503).json({ error: "Dashboard auth not configured" });
  }
  if (!cfg.dashboardUser || !cfg.dashboardPassword) {
    return res.status(503).json({ error: "Dashboard credentials not configured" });
  }
  if (!cfg.dashboardPasswordSalt || !storedUserHash || !storedPassHash) {
    return res.status(503).json({ error: "Dashboard password salt not configured" });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const userMatch = crypto.timingSafeEqual(hashSecret(username), storedUserHash);
  const passMatch = crypto.timingSafeEqual(hashSecret(password), storedPassHash);

  if (!userMatch || !passMatch) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { sub: username },
    cfg.dashboardJwtSecret,
    { expiresIn: cfg.dashboardJwtTtl, issuer: "callguard", audience: "dashboard" }
  );

  res.cookie(cfg.authCookieName, token, getCookieOptions());
  return res.json({ token, user: { username } });
});

router.get("/session", requireDashboardAuth, (req, res) => {
  res.json({ user: { username: req.auth?.sub } });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(cfg.authCookieName, getCookieOptions());
  res.json({ ok: true });
});

module.exports = router;
