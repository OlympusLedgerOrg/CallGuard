// src/twilio/twiml.js
// Converts Ava dialogue actions into TwiML XML that Twilio executes.
// Twilio calls your webhook, you return this XML, Twilio speaks + listens.
//
// VibeVoice: When streaming is enabled, uses <Stream> for real-time audio.

const VOICE = "Polly.Joanna"; // AWS Polly via Twilio — natural female voice, no extra cost
const LANGUAGE = "en-US";

// Build a full TwiML response string from an Ava action object
function buildTwiML(action, webhookBase, callSid, options = {}) {
  const callbackUrl = `${webhookBase}/voice/input?callSid=${encodeURIComponent(callSid)}`;
  const { useStreaming = false, streamUrl = null } = options;

  // VibeVoice: Use Media Streams for real-time voice
  if (useStreaming && streamUrl && action.type !== "hangup") {
    return buildStreamingTwiML(action, streamUrl, callSid);
  }

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

  if (action.type === "transfer") {
    // Transfer call to owner's phone
    const transferNum = action.number || "";
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${VOICE}">${escapeXml(action.text || "Connecting you now.")}</Say>
  <Dial callerId="${escapeXml(action.callerId || "")}">
    <Number>${escapeXml(transferNum)}</Number>
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

// VibeVoice: Build TwiML with Media Streams for real-time voice
function buildStreamingTwiML(action, streamUrl, callSid) {
  // Connect to VibeVoice WebSocket for bidirectional audio
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(streamUrl)}">
      <Parameter name="callSid" value="${escapeXml(callSid)}" />
    </Stream>
  </Connect>
</Response>`;
}

// Build TwiML for owner takeover — redirect to conference
function buildOwnerTakeoverTwiML(callSid, conferenceRoom) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${VOICE}">The owner is joining now.</Say>
  <Dial>
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      record="record-from-start"
      waitUrl=""
    >${escapeXml(conferenceRoom)}</Conference>
  </Dial>
</Response>`;
}

// Build TwiML to dial the owner into the call
function buildDialOwnerTwiML(ownerPhone, conferenceRoom, callerId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(callerId)}">
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="false"
      beep="false"
    >${escapeXml(conferenceRoom)}</Conference>
  </Dial>
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

module.exports = {
  buildTwiML,
  buildStreamingTwiML,
  buildOwnerTakeoverTwiML,
  buildDialOwnerTwiML,
  escapeXml,
};
