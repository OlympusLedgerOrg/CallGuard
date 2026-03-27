const { Router } = require("express");
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
  if (username !== cfg.dashboardUser || password !== cfg.dashboardPassword) {
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
