// src/sms/sms.js
// All outbound SMS logic.
// Reads templates from business ai_config, fills tokens, fires via Twilio.
// Writes every message to sms_logs for audit trail.

const twilio = require("twilio");
const db = require("../db/client");

let client;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
} catch { /* Twilio not configured */ }

// ── Token replacer ────────────────────────────────────────────────
function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `[${k}]`);
}

// ── Core send function ────────────────────────────────────────────
async function sendSMS({ to, from, body, trigger, businessId, callId }) {
  let twilioSid = null;
  let status = "sent";

  try {
    if (!client) throw new Error("Twilio not configured");
    const msg = await client.messages.create({
      body,
      to,
      from: from || process.env.TWILIO_PHONE_NUMBER,
    });
    twilioSid = msg.sid;
  } catch (err) {
    console.error(`[SMS] Failed to send to ${to}:`, err.message);
    status = "failed";
  }

  // Always log, even on failure
  try {
    await db.sms_logs.create({
      data: {
        business_id: businessId,
        call_id:     callId || null,
        direction:   "outbound",
        to_number:   to,
        from_number: from || process.env.TWILIO_PHONE_NUMBER || "",
        body,
        trigger,
        status,
        twilio_sid:  twilioSid,
      },
    });
  } catch (err) {
    console.error("[SMS] Failed to log SMS:", err.message);
  }

  return { status, twilioSid };
}

// ── Trigger: booking confirmed → customer SMS ────────────────────
async function sendBookingConfirm({ business, appointment, callId }) {
  const tpl = business.ai_config?.sms_templates?.booking_confirm
    ?? "✅ Confirmed! {{service}} on {{date}} at {{time}}. {{business_name}} — {{address}}. Reply CANCEL to cancel.";

  const body = fill(tpl, {
    service:       appointment.service,
    date:          formatDate(appointment.scheduled_for),
    time:          formatTime(appointment.scheduled_for),
    business_name: business.name,
    address:       business.address || "",
  });

  return sendSMS({
    to:         appointment.customer_phone,
    body,
    trigger:    "booking_confirm",
    businessId: business.id,
    callId,
  });
}

// ── Trigger: missed call → owner alert ──────────────────────────
async function sendMissedCallAlert({ business, call }) {
  const ownerPhone = process.env.OWNER_PHONE;
  if (!ownerPhone) return;

  const tpl = business.ai_config?.sms_templates?.missed_call
    ?? "📞 Missed call from {{caller_number}} at {{time}}. No booking made.";

  const body = fill(tpl, {
    caller_number: call.from_number,
    time:          formatTime(call.created_at),
    business_name: business.name,
  });

  return sendSMS({
    to:         ownerPhone,
    body,
    trigger:    "missed_call",
    businessId: business.id,
    callId:     call.id,
  });
}

// ── Trigger: new job request → owner alert ───────────────────────
async function sendOwnerAlert({ business, jobRequest, call }) {
  const ownerPhone = process.env.OWNER_PHONE;
  if (!ownerPhone) return;

  const tpl = business.ai_config?.sms_templates?.owner_alert
    ?? "🔔 New job: {{issue}} — {{customer_name}}, {{phone}}. Disposition: {{disposition}}.";

  const body = fill(tpl, {
    issue:         jobRequest.issue,
    customer_name: jobRequest.customer_name || "Unknown",
    phone:         jobRequest.phone,
    disposition:   jobRequest.disposition,
    business_name: business.name,
  });

  return sendSMS({
    to:         ownerPhone,
    body,
    trigger:    "owner_alert",
    businessId: business.id,
    callId:     call?.id || null,
  });
}

// ── Trigger: mid-call owner sends info to caller ─────────────────
async function sendMidCallInfo({ business, toNumber, body, callId }) {
  return sendSMS({
    to:         toNumber,
    body,
    trigger:    "mid_call",
    businessId: business.id,
    callId,
  });
}

// ── Trigger: follow-up on missed / lead calls ────────────────────
async function sendFollowUp({ business, jobRequest }) {
  const tpl = business.ai_config?.sms_templates?.follow_up
    ?? "Hey {{name}}, this is {{business_name}}. We saw your call — still need help? Reply here or call {{phone}}.";

  const body = fill(tpl, {
    name:          jobRequest.customer_name || "there",
    business_name: business.name,
    phone:         business.phone || process.env.TWILIO_PHONE_NUMBER,
  });

  return sendSMS({
    to:         jobRequest.phone,
    body,
    trigger:    "follow_up",
    businessId: business.id,
    callId:     null,
  });
}

// ── Date/time helpers ─────────────────────────────────────────────
function formatDate(dt) {
  return new Date(dt).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatTime(dt) {
  return new Date(dt).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

module.exports = {
  sendBookingConfirm,
  sendMissedCallAlert,
  sendOwnerAlert,
  sendMidCallInfo,
  sendFollowUp,
};
