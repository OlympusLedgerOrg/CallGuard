// src/routes/ava-api.js
// REST API for the owner dashboard (the CallGuard mobile app).
// All routes expect a businessId query param or header in prod.
// Simplified auth for now — add JWT middleware before shipping.

const { Router } = require("express");
const { sendMidCallInfo, sendFollowUp, sendBookingConfirm } = require("../sms/sms");
const db = require("../db/client");

const router = Router();

// ── GET /api/stats ───────────────────────────────────────────────
// The 4 numbers on the home screen
router.get("/stats", async (req, res) => {
  const { businessId } = req.query;
  if (!businessId) return res.status(400).json({ error: "businessId required" });

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [totalCalls, aiCalls, bookedCalls, callDurations] = await Promise.all([
      db.calls.count({ where: { business_id: businessId, created_at: { gte: weekAgo } } }),
      db.calls.count({ where: { business_id: businessId, ai_handled: true, created_at: { gte: weekAgo } } }),
      db.calls.count({ where: { business_id: businessId, disposition: "booked", created_at: { gte: weekAgo } } }),
      db.calls.findMany({
        where:  { business_id: businessId, created_at: { gte: weekAgo }, duration_secs: { not: null } },
        select: { duration_secs: true },
      }),
    ]);

    const avgDuration = callDurations.length > 0
      ? Math.round(callDurations.reduce((a, c) => a + c.duration_secs, 0) / callDurations.length)
      : 0;

    const aiRate = totalCalls > 0 ? Math.round((aiCalls / totalCalls) * 100) : 0;
    const mins   = Math.floor(avgDuration / 60);
    const secs   = avgDuration % 60;

    res.json({
      calls_this_week: totalCalls,
      ai_handled_pct:  `${aiRate}%`,
      jobs_booked:     bookedCalls,
      avg_handle_time: avgDuration > 0 ? `${mins}m ${secs}s` : "—",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/calls ───────────────────────────────────────────────
router.get("/calls", async (req, res) => {
  const { businessId, disposition, limit = "20", offset = "0" } = req.query;
  if (!businessId) return res.status(400).json({ error: "businessId required" });

  try {
    const calls = await db.calls.findMany({
      where: {
        business_id: businessId,
        ...(disposition ? { disposition } : {}),
      },
      include: { transcript: { select: { summary: true } } },
      orderBy: { created_at: "desc" },
      take:    parseInt(limit),
      skip:    parseInt(offset),
    });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/calls/:id/transcript ────────────────────────────────
router.get("/calls/:id/transcript", async (req, res) => {
  try {
    const tx = await db.transcripts.findUnique({ where: { call_id: req.params.id } });
    if (!tx) return res.status(404).json({ error: "Not found" });
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/jobs ────────────────────────────────────────────────
router.get("/jobs", async (req, res) => {
  const { businessId, status, disposition } = req.query;
  if (!businessId) return res.status(400).json({ error: "businessId required" });

  try {
    const jobs = await db.job_requests.findMany({
      where: {
        business_id: businessId,
        ...(status      ? { status }      : {}),
        ...(disposition ? { disposition } : {}),
      },
      orderBy: { created_at: "desc" },
      take: 50,
    });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/appointments ─────────────────────────────────────────
router.get("/appointments", async (req, res) => {
  const { businessId, from, to } = req.query;
  if (!businessId) return res.status(400).json({ error: "businessId required" });

  try {
    const appointments = await db.appointments.findMany({
      where: {
        business_id: businessId,
        scheduled_for: {
          gte: from ? new Date(from) : new Date(),
          ...(to ? { lte: new Date(to) } : {}),
        },
      },
      orderBy: { scheduled_for: "asc" },
    });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/appointments ───────────────────────────────────────
// Manual booking from the app's Book tab
router.post("/appointments", async (req, res) => {
  const { businessId, customerName, customerPhone, service, scheduledFor, durationMins, notes } = req.body;
  if (!businessId || !customerPhone || !service || !scheduledFor) {
    return res.status(400).json({ error: "businessId, customerPhone, service, scheduledFor required" });
  }

  try {
    const appointment = await db.appointments.create({
      data: {
        business_id:    businessId,
        customer_name:  customerName || "Customer",
        customer_phone: customerPhone,
        service,
        scheduled_for:  new Date(scheduledFor),
        duration_mins:  durationMins || 60,
        notes:          notes || null,
        status:         "confirmed",
      },
    });

    // SMS confirmation
    const business = await db.businesses.findUnique({ where: { id: businessId } });
    if (business) {
      await sendBookingConfirm({ business, appointment, callId: null });
    }

    res.status(201).json(appointment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/calls/:callSid/sms ─────────────────────────────────
// Owner sends info to caller mid-call from the live call panel
router.post("/calls/:callSid/sms", async (req, res) => {
  const { callSid } = req.params;
  const { body, businessId } = req.body;

  if (!body || !businessId) {
    return res.status(400).json({ error: "body and businessId required" });
  }

  try {
    const [call, business] = await Promise.all([
      db.calls.findFirst({ where: { call_sid: callSid } }),
      db.businesses.findUnique({ where: { id: businessId } }),
    ]);

    if (!call)     return res.status(404).json({ error: "Call not found" });
    if (!business) return res.status(404).json({ error: "Business not found" });

    await sendMidCallInfo({
      business,
      toNumber: call.from_number,
      body,
      callId: call.id,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/jobs/:id/follow-up ─────────────────────────────────
router.post("/jobs/:id/follow-up", async (req, res) => {
  const { businessId } = req.body;
  try {
    const [job, business] = await Promise.all([
      db.job_requests.findUnique({ where: { id: req.params.id } }),
      db.businesses.findUnique({ where: { id: businessId } }),
    ]);
    if (!job || !business) return res.status(404).json({ error: "Not found" });
    await sendFollowUp({ business, jobRequest: job });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/health ───────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

module.exports = router;
