/**
 * Week 4 – Owner dashboard REST API.
 *
 * GET  /api/dashboard/stats       → aggregate call stats
 * GET  /api/dashboard/calls/active → currently active calls
 * GET  /api/dashboard/calls/log   → recent call history
 * POST /api/dashboard/sms         → send an SMS to a caller
 */

const { Router } = require("express");
const tracker = require("../services/call-tracker");
const sms = require("../services/sms");
const cfg = require("../config");

const router = Router();

/** GET /api/dashboard/stats */
router.get("/stats", (_req, res) => {
  res.json(tracker.getStats());
});

/** GET /api/dashboard/calls/active */
router.get("/calls/active", (_req, res) => {
  res.json(tracker.getActiveCalls());
});

/** GET /api/dashboard/calls/log */
router.get("/calls/log", (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  res.json(tracker.getCallLog(limit));
});

/**
 * POST /api/dashboard/sms
 * Body: { to, body }
 * Lets the owner send an SMS to a caller from the dashboard.
 */
router.post("/sms", async (req, res) => {
  const { to, body } = req.body;

  if (!to || !body) {
    return res.status(400).json({ error: "Missing required fields: to, body" });
  }

  try {
    if (!cfg.twilioAccountSid || !cfg.twilioAuthToken) {
      return res.status(503).json({ error: "Twilio not configured" });
    }
    const msg = await sms.sendSms({ to, body });
    res.json({ sid: msg.sid, status: msg.status });
  } catch (err) {
    console.error("Dashboard SMS error:", err.message);
    res.status(500).json({ error: "Failed to send SMS" });
  }
});

module.exports = router;
