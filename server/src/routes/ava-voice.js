// src/routes/ava-voice.js
// Twilio webhook routes for the Ava dialogue engine.
//
// Twilio calls these URLs during a phone call:
//   POST /voice/inbound   — new call arrives on your number
//   POST /voice/input     — caller has spoken, STT result comes back
//   POST /voice/fallback  — Ava timed out waiting for input
//   POST /voice/status    — call lifecycle events (completed, busy, failed)
//   POST /voice/takeover  — owner takes over the call (TwiML endpoint)

const { Router } = require("express");
const { processInput, processFallback, endSession, getSession, setSessionPaused } = require("../dialogue/ava");
const { buildTwiML, buildOwnerTakeoverTwiML } = require("../twilio/twiml");
const { DEFAULT_HVAC_CONFIG } = require("../../../config/businesses");
const twilioAuth = require("../middleware/twilio-auth");
const {
  sendBookingConfirm,
  sendMissedCallAlert,
  sendOwnerAlert,
} = require("../sms/sms");
const {
  pushTranscriptLine,
  pushCallStatus,
  pushDisposition,
} = require("../ws/liveCall");
const { persistSession, deleteSession } = require("../services/session-store");
const db = require("../db/client");

const router = Router();
const BASE_URL = process.env.BASE_URL || "";

// ── Utility: load business config by called number ───────────────
async function loadBizConfig(toNumber) {
  try {
    const tn = await db.twilio_numbers.findUnique({
      where: { number: toNumber },
      include: { business: true },
    });
    if (tn?.business) {
      return {
        business: tn.business,
        // Merge DB config over the type default
        aiConfig: {
          ...(tn.business.business_type === "mechanic" ? {} : DEFAULT_HVAC_CONFIG),
          ...tn.business.ai_config,
          name:    tn.business.name,
          phone:   tn.business.phone,
          address: tn.business.address,
        },
      };
    }
  } catch (err) {
    console.error("[Voice] loadBizConfig error:", err.message);
  }
  // Fallback to demo config if DB lookup fails
  return { business: null, aiConfig: DEFAULT_HVAC_CONFIG };
}

// ── POST /voice/inbound ──────────────────────────────────────────
// Twilio hits this when a call comes in.
// We: create a DB call record, start the Ava session, return TwiML greeting.
router.post("/inbound", twilioAuth, async (req, res) => {
  const { CallSid, From, To, CallStatus } = req.body;
  console.log(`[Voice] Inbound call ${CallSid} from ${From} to ${To}`);

  const { business, aiConfig } = await loadBizConfig(To);

  // Create call record
  let callRecord = null;
  if (business) {
    try {
      callRecord = await db.calls.create({
        data: {
          businessId:    business.id,
          twilioCallSid: CallSid,
          callerNumber:  From,
          aiHandled:     true,
        },
      });
      await db.transcripts.create({
        data: { callId: callRecord.id },
      });
    } catch (err) {
      console.error("[Voice] DB create error:", err.message);
    }
  }

  // Push live status to WebSocket clients
  pushCallStatus(CallSid, "ringing");

  // Kick off Ava — no text input on first turn (greeting gate)
  const { action, session: initialSession } = processInput(CallSid, "", aiConfig);

  // Persist initial session
  if (initialSession) {
    await persistSession(CallSid, initialSession, aiConfig?.businessId).catch(err =>
      console.error("[Voice] Failed to persist initial session:", CallSid, err.message)
    );
  }

  // Push Ava's greeting to WS
  if (action.text) {
    pushTranscriptLine(CallSid, { from: "ava", text: action.text, ts: Date.now() });
  }

  res.type("text/xml").send(buildTwiML(action, BASE_URL, CallSid));
});

// ── POST /voice/input ────────────────────────────────────────────
// Twilio returns here after the caller speaks.
// SpeechResult contains the STT transcript of what they said.
router.post("/input", twilioAuth, async (req, res) => {
  const { CallSid, SpeechResult, From } = req.body;
  const callerText = (SpeechResult || "").trim();

  console.log(`[Voice] ${CallSid} caller said: "${callerText}"`);

  // Push caller transcript line to WS
  if (callerText) {
    pushTranscriptLine(CallSid, { from: "caller", text: callerText, ts: Date.now() });
  }

  // Load config (session already exists)
  const session = getSession(CallSid);
  const { aiConfig } = session?.bizConfig
    ? { aiConfig: session.bizConfig }
    : await loadBizConfig(req.body.To);

  const { action, session: updatedSession, done } = processInput(CallSid, callerText, aiConfig);

  // Persist session after update
  if (updatedSession) {
    await persistSession(CallSid, updatedSession, updatedSession.bizConfig?.businessId).catch(err => 
      console.error("[Voice] Failed to persist updated session:", CallSid, err.message)
    );
  }

  // Push Ava's response to WS
  if (action.text) {
    pushTranscriptLine(CallSid, { from: "ava", text: action.text, ts: Date.now() });
  }

  // If session just ended, handle outcomes
  if (done) {
    await handleCallEnd(CallSid, updatedSession, From, req.body.To);
  }

  // Append to transcript in DB
  appendTranscript(CallSid, callerText, action.text);

  res.type("text/xml").send(buildTwiML(action, BASE_URL, CallSid));
});

// ── POST /voice/fallback ─────────────────────────────────────────
// Caller didn't respond in time — Ava re-prompts or transfers after 3 attempts
router.post("/fallback", twilioAuth, async (req, res) => {
  const { CallSid, From } = req.body;
  console.log(`[Voice] ${CallSid} fallback (no speech detected)`);

  // Use the new processFallback which tracks attempts
  const { action, session, done, maxFallbacksReached } = processFallback(CallSid);

  // Persist session after fallback update
  if (session) {
    await persistSession(CallSid, session, session.bizConfig?.businessId).catch(err =>
      console.error("[Voice] Failed to persist session after fallback:", CallSid, err.message)
    );
  }

  // Push fallback event to WebSocket
  pushTranscriptLine(CallSid, {
    from: "system",
    text: `[Fallback ${session?.fallbackCount || 1}/3]`,
    ts: Date.now(),
  });

  // If max fallbacks reached, handle call end and create callback request
  if (maxFallbacksReached && session) {
    await handleCallEnd(CallSid, session, From, req.body.To);
    
    // Create callback request for STT failures
    try {
      const call = await db.calls.findFirst({ where: { twilioCallSid: CallSid } });
      if (call) {
        await db.callback_requests.create({
          data: {
            businessId: call.businessId,
            callId: call.id,
            callerPhone: From,
            reason: "STT failure - caller could not be heard",
            urgency: "normal",
            status: "pending",
          },
        });
      }
    } catch (err) {
      console.error("[Voice] callback request error:", err.message);
    }
  }

  res.type("text/xml").send(buildTwiML(action, BASE_URL, CallSid));
});

// ── POST /voice/takeover ─────────────────────────────────────────
// Owner takes over the call — redirect caller to conference
router.post("/takeover", twilioAuth, async (req, res) => {
  const { CallSid } = req.body;
  console.log(`[Voice] ${CallSid} owner takeover requested`);

  // Pause Ava processing
  setSessionPaused(CallSid, true);

  // Generate conference room name
  const conferenceRoom = `owner-takeover-${CallSid}`;

  // Push event to WebSocket
  pushCallStatus(CallSid, "owner_live");

  res.type("text/xml").send(buildOwnerTakeoverTwiML(CallSid, conferenceRoom));
});

// ── POST /voice/status ───────────────────────────────────────────
// Twilio lifecycle events — completed, busy, no-answer, failed
router.post("/status", twilioAuth, async (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  console.log(`[Voice] ${CallSid} status: ${CallStatus} (${CallDuration}s)`);

  pushCallStatus(CallSid, CallStatus);

  try {
    const call = await db.calls.findFirst({ where: { twilioCallSid: CallSid } });
    if (!call) return res.sendStatus(200);

    if (["completed", "busy", "no-answer", "failed", "canceled"].includes(CallStatus)) {
      const session = getSession(CallSid);
      
      await db.calls.update({
        where: { id: call.id },
        data: {
          outcome:        CallStatus === "completed" ? "completed" : "missed",
          durationSeconds: CallDuration ? parseInt(CallDuration) : null,
        },
      });

      // If call ended with no booking — fire missed call alert
      if (session && ["lead", null, "stt_failure"].includes(session.disposition)) {
        const business = await db.businesses.findUnique({ where: { id: call.businessId } });
        if (business) await sendMissedCallAlert({ business, call });
      }

      endSession(CallSid);
      
      // Delete persisted session when call ends
      await deleteSession(CallSid).catch(err =>
        console.error("[Voice] Failed to delete session:", CallSid, err.message)
      );
    }
  } catch (err) {
    console.error("[Voice] status handler error:", err.message);
  }

  res.sendStatus(200);
});

// ── Handle call outcomes after Ava finishes ──────────────────────
async function handleCallEnd(callSid, session, fromNumber, toNumber) {
  const { disposition, customer_name, customer_phone, issue, address, slot, bizConfig } = session;

  console.log(`[Voice] ${callSid} ended. Disposition: ${disposition}`);
  pushDisposition(callSid, disposition);

  // Fetch DB records
  let call, business;
  try {
    call     = await db.calls.findFirst({ where: { twilioCallSid: callSid } });
    business = call ? await db.businesses.findUnique({ where: { id: call.businessId } }) : null;
  } catch { /* non-critical */ }

  // ── Create job_request ────────────────────────────────────────
  let jobRequest = null;
  if (business && (issue || customer_phone)) {
    try {
      jobRequest = await db.job_requests.create({
        data: {
          businessId:    business.id,
          customerName:  customer_name || null,
          customerPhone: customer_phone || fromNumber,
          issue:         issue || "General enquiry",
          address:       address || null,
          urgency:       disposition === "emergency" ? "emergency" : "normal",
          disposition:   disposition || "lead",
          status:        disposition === "booked" ? "scheduled" : "new",
        },
      });

      // Link job_request to call
      if (call) {
        await db.calls.update({
          where: { id: call.id },
          data:  { jobRequestId: jobRequest.id, disposition },
        });
      }
    } catch (err) {
      console.error("[Voice] job_request create error:", err.message);
    }
  }

  // ── Booking confirmed ─────────────────────────────────────────
  if (disposition === "booked" && business && customer_phone && slot) {
    try {
      const appointment = await db.appointments.create({
        data: {
          businessId:    business.id,
          customerName:  customer_name || "Customer",
          customerPhone: customer_phone,
          serviceType:   issue || "Service",
          scheduledFor:  new Date(slot.iso),
          status:        "confirmed",
        },
      });

      if (call) {
        await db.calls.update({
          where: { id: call.id },
          data:  { appointmentId: appointment.id },
        });
      }

      // SMS confirmation to customer
      await sendBookingConfirm({ business, appointment, callId: call?.id });

      // Alert to owner
      if (jobRequest) await sendOwnerAlert({ business, jobRequest, call });

    } catch (err) {
      console.error("[Voice] booking error:", err.message);
    }
  }

  // ── Lead / callback — just alert owner ───────────────────────
  if (["lead", "callback"].includes(disposition) && business && jobRequest) {
    await sendOwnerAlert({ business, jobRequest, call });
  }

  // ── Update call disposition in DB ────────────────────────────
  if (call) {
    await db.calls.update({
      where: { id: call.id },
      data:  { disposition: disposition || "info" },
    }).catch(() => {});
  }
}

// ── Async transcript append (fire-and-forget) ────────────────────
async function appendTranscript(callSid, callerText, avaText) {
  try {
    const call = await db.calls.findFirst({ where: { twilioCallSid: callSid } });
    if (!call) return;
    const tx = await db.transcripts.findUnique({ where: { callId: call.id } });
    if (!tx) return;

    const lines = Array.isArray(tx.lines) ? tx.lines : [];
    const now = Date.now();
    if (callerText) lines.push({ from: "caller", text: callerText, ts: now });
    if (avaText)    lines.push({ from: "ava",    text: avaText,    ts: now + 1 });

    await db.transcripts.update({
      where: { callId: call.id },
      data:  { lines },
    });
  } catch { /* non-critical — don't break the call */ }
}

module.exports = router;
