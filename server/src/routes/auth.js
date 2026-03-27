const { Router } = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const cfg = require("../config");
const { requireDashboardAuth, isAuthConfigured } = require("../middleware/dashboard-auth");

const router = Router();

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: cfg.nodeEnv === "production",
  };
}

router.post("/login", (req, res) => {
  if (!isAuthConfigured()) {
    return res.status(503).json({ error: "Dashboard auth not configured" });
  }
  if (!cfg.dashboardUser || !cfg.dashboardPassword) {
    return res.status(503).json({ error: "Dashboard credentials not configured" });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const userLength = Math.max(String(username).length, cfg.dashboardUser.length);
  const passLength = Math.max(String(password).length, cfg.dashboardPassword.length);
  const userBuf = Buffer.from(String(username).padEnd(userLength, "\0"));
  const storedUserBuf = Buffer.from(cfg.dashboardUser.padEnd(userLength, "\0"));
  const passBuf = Buffer.from(String(password).padEnd(passLength, "\0"));
  const storedPassBuf = Buffer.from(cfg.dashboardPassword.padEnd(passLength, "\0"));

  const userMatch = crypto.timingSafeEqual(userBuf, storedUserBuf);
  const passMatch = crypto.timingSafeEqual(passBuf, storedPassBuf);

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
