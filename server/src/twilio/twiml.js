// src/twilio/twiml.js
// Converts Ava dialogue actions into TwiML XML that Twilio executes.
// Twilio calls your webhook, you return this XML, Twilio speaks + listens.

const VOICE = "Polly.Joanna"; // AWS Polly via Twilio — natural female voice, no extra cost
const LANGUAGE = "en-US";

// Build a full TwiML response string from an Ava action object
function buildTwiML(action, webhookBase, callSid) {
  const callbackUrl = `${webhookBase}/voice/input?callSid=${encodeURIComponent(callSid)}`;

  if (action.type === "gather") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather
    input="speech"
    action="${callbackUrl}"
    method="POST"
    speechTimeout="auto"
    speechModel="phone_call"
    enhanced="true"
    hints="${escapeXml(action.hints || "")}"
    language="${LANGUAGE}"
  >
    <Say voice="${VOICE}">${escapeXml(action.text)}</Say>
  </Gather>
  <Say voice="${VOICE}">I'm sorry, I didn't catch that. Let me connect you with the team.</Say>
  <Redirect method="POST">${webhookBase}/voice/fallback?callSid=${encodeURIComponent(callSid)}</Redirect>
</Response>`;
  }

  if (action.type === "say") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${VOICE}">${escapeXml(action.text)}</Say>
  <Redirect method="POST">${callbackUrl}</Redirect>
</Response>`;
  }

  if (action.type === "hangup") {
    const farewell = action.text || "Thanks for calling. Have a great day!";
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${VOICE}">${escapeXml(farewell)}</Say>
  <Hangup/>
</Response>`;
  }

  if (action.type === "conference") {
    // Owner jump-in: bridge owner's phone into the call
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${VOICE}">Please hold for a moment.</Say>
  <Dial>
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="false"
      record="record-from-start"
    >${escapeXml(action.room)}</Conference>
  </Dial>
</Response>`;
  }

  // Fallback — silence + hangup
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
}

// Escape XML special characters in speech text
function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

module.exports = { buildTwiML, escapeXml };
