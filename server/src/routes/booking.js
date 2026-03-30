/**
 * Week 3 – Booking flow + Google Calendar + SMS confirmation.
 *
 * POST /booking/start       → begin the booking conversation
 * POST /booking/collect-date → gather preferred date
 * POST /booking/collect-time → gather preferred time slot
 * POST /booking/confirm      → confirm and create the event + SMS
 * GET  /booking/availability → REST: available slots for a date
 * POST /booking/create       → REST: create a booking
 */

const { Router } = require("express");
const { twiml: { VoiceResponse } } = require("twilio");
const twilioAuth = require("../middleware/twilio-auth");
const calendar = require("../services/calendar");
const sms = require("../services/sms");
const tracker = require("../services/call-tracker");
const cfg = require("../config");
const { extractTranscriptText } = require("../utils/transcript");

const router = Router();

// In-memory map to hold booking session data keyed by CallSid
const bookingSessions = new Map();

/* ------------------------------------------------------------------ */
/*  Voice-driven booking (called during a live Twilio call)           */
/* ------------------------------------------------------------------ */

/**
 * POST /booking/start
 * Entry point for voice booking. Asks for the service.
 */
router.post("/start", twilioAuth, (req, res) => {
  const callSid = req.body.CallSid || req.query.CallSid || "unknown";
  bookingSessions.set(callSid, {});

  const vr = new VoiceResponse();
  const gather = vr.gather({
    input: "speech",
    action: `${cfg.baseUrl}/booking/collect-date`,
    method: "POST",
    speechTimeout: "auto",
  });
  gather.say(
    { voice: "Polly.Joanna" },
    "Great, let's book an appointment! What service do you need?"
  );

  vr.say({ voice: "Polly.Joanna" }, "Sorry, I didn't catch that.");
  vr.redirect(`${cfg.baseUrl}/booking/start`);

  res.type("text/xml").send(vr.toString());
});

/**
 * POST /booking/collect-date
 * Receives service choice, asks for preferred date.
 */
router.post("/collect-date", twilioAuth, (req, res) => {
  const callSid = req.body.CallSid || "unknown";
  const service = extractTranscriptText(req.body) || "General appointment";
  const session = bookingSessions.get(callSid) || {};
  session.service = service;
  bookingSessions.set(callSid, session);

  tracker.addTranscriptTurn(callSid, "user", service);

  const vr = new VoiceResponse();
  const gather = vr.gather({
    input: "speech",
    action: `${cfg.baseUrl}/booking/collect-time`,
    method: "POST",
    speechTimeout: "auto",
  });
  gather.say(
    { voice: "Polly.Joanna" },
    `Got it, ${service}. What date works best for you?`
  );

  vr.say({ voice: "Polly.Joanna" }, "I didn't hear a date. Please try again.");
  vr.redirect(`${cfg.baseUrl}/booking/collect-date`);

  res.type("text/xml").send(vr.toString());
});

/**
 * POST /booking/collect-time
 * Receives date, asks for preferred time.
 */
router.post("/collect-time", twilioAuth, (req, res) => {
  const callSid = req.body.CallSid || "unknown";
  const date = extractTranscriptText(req.body) || "next available";
  const session = bookingSessions.get(callSid) || {};
  session.date = date;
  bookingSessions.set(callSid, session);

  tracker.addTranscriptTurn(callSid, "user", date);

  const vr = new VoiceResponse();
  const gather = vr.gather({
    input: "speech",
    action: `${cfg.baseUrl}/booking/confirm`,
    method: "POST",
    speechTimeout: "auto",
  });
  gather.say(
    { voice: "Polly.Joanna" },
    `Alright, ${date}. And what time would you prefer? We have openings from 9 AM to 5 PM.`
  );

  vr.say({ voice: "Polly.Joanna" }, "I didn't hear a time. Please try again.");
  vr.redirect(`${cfg.baseUrl}/booking/collect-time`);

  res.type("text/xml").send(vr.toString());
});

/**
 * POST /booking/confirm
 * Receives time, confirms booking, creates calendar event, sends SMS.
 */
router.post("/confirm", twilioAuth, async (req, res) => {
  const callSid = req.body.CallSid || "unknown";
  const time = extractTranscriptText(req.body) || "10:00 AM";
  const callerPhone = req.body.From || "";
  const session = bookingSessions.get(callSid) || {};
  session.time = time;

  tracker.addTranscriptTurn(callSid, "user", time);

  const vr = new VoiceResponse();
  const confirmMsg =
    `Your ${session.service || "appointment"} has been booked for ` +
    `${session.date || "the next available date"} at ${time}. ` +
    `You'll receive an SMS confirmation shortly. Thank you for calling CallGuard!`;

  vr.say({ voice: "Polly.Joanna" }, confirmMsg);
  vr.hangup();

  tracker.addTranscriptTurn(callSid, "assistant", confirmMsg);
  tracker.endCall(callSid, "booked");

  // Attempt to create calendar event + send SMS (best-effort, don't fail the call)
  try {
    if (cfg.googleClientEmail && cfg.googlePrivateKey) {
      // TODO: Parse session.date + session.time into proper dates for production
      const startTime = new Date().toISOString();
      const endTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await calendar.createEvent({
        summary: `CallGuard: ${session.service || "Appointment"}`,
        description: `Booked via phone by ${callerPhone}`,
        startTime,
        endTime,
      });
    }
  } catch (err) {
    console.error("Calendar event creation failed:", err.message);
  }

  try {
    if (callerPhone && cfg.twilioAccountSid && cfg.twilioAuthToken) {
      await sms.sendBookingConfirmation({
        to: callerPhone,
        customerName: "Valued Customer",
        service: session.service || "Appointment",
        dateTime: `${session.date || "TBD"} at ${time}`,
      });
    }
  } catch (err) {
    console.error("SMS confirmation failed:", err.message);
  }

  bookingSessions.delete(callSid);
  res.type("text/xml").send(vr.toString());
});

/* ------------------------------------------------------------------ */
/*  REST API for the frontend / dashboard                             */
/* ------------------------------------------------------------------ */

/**
 * GET /booking/availability?date=YYYY-MM-DD
 * Returns available time slots for a given date.
 */
router.get("/availability", async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: "date query parameter required (YYYY-MM-DD)" });
  }
  try {
    const slots = await calendar.getAvailableSlots(date);
    res.json({ date, slots });
  } catch (err) {
    console.error("Calendar availability error:", err.message);
    res.status(502).json({ error: "Could not fetch calendar availability" });
  }
});

/**
 * POST /booking/create
 * REST endpoint to create a booking from the dashboard.
 * Body: { service, date, time, customerName, customerPhone, customerEmail? }
 */
router.post("/create", async (req, res) => {
  const { service, date, time, customerName, customerPhone, customerEmail } = req.body;

  if (!service || !date || !time || !customerName || !customerPhone) {
    return res.status(400).json({
      error: "Missing required fields: service, date, time, customerName, customerPhone",
    });
  }

  // Parse time string (handles both "10:00" and "10:00 AM" formats)
  function parseTo24h(dateStr, timeStr) {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return new Date(`${dateStr}T${timeStr}`);
    let hours = parseInt(match[1], 10);
    const mins = match[2];
    const ampm = (match[3] || "").toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${mins}:00`);
  }

  const startDt = parseTo24h(date, time);
  const startTime = startDt.toISOString();
  const endTime = new Date(startDt.getTime() + 30 * 60 * 1000).toISOString();

  try {
    let calendarEvent = null;
    if (cfg.googleClientEmail && cfg.googlePrivateKey) {
      calendarEvent = await calendar.createEvent({
        summary: `CallGuard: ${service}`,
        description: `Booked for ${customerName} (${customerPhone})`,
        startTime,
        endTime,
        attendeeEmail: customerEmail,
      });
    }

    if (cfg.twilioAccountSid && cfg.twilioAuthToken) {
      await sms.sendBookingConfirmation({
        to: customerPhone,
        customerName,
        service,
        dateTime: `${date} at ${time}`,
      });
    }

    res.status(201).json({
      message: "Booking created",
      booking: { service, date, time, customerName, customerPhone },
      calendarEventId: calendarEvent?.id || null,
    });
  } catch (err) {
    console.error("Booking creation error:", err.message);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

module.exports = router;
