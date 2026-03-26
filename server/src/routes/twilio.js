/**
 * Week 1 – Twilio webhook routes.
 *
 * POST /twilio/voice   → handles incoming voice calls with TwiML
 * POST /twilio/status  → receives call status callbacks
 */

const { Router } = require("express");
const { twiml: { VoiceResponse } } = require("twilio");
const twilioAuth = require("../middleware/twilio-auth");
const tracker = require("../services/call-tracker");
const cfg = require("../config");

const router = Router();

/**
 * POST /twilio/voice
 * Twilio hits this URL when a call comes in on the purchased number.
 * Responds with TwiML that greets the caller and gathers speech input.
 */
router.post("/voice", twilioAuth, (req, res) => {
  const callSid = req.body.CallSid || "unknown";
  const from = req.body.From || "unknown";
  const to = req.body.To || "unknown";

  // Track the call
  tracker.startCall(callSid, { from, to });

  const response = new VoiceResponse();

  // Greet and gather speech
  const gather = response.gather({
    input: "speech",
    action: `${cfg.baseUrl}/voice/respond`,
    method: "POST",
    speechTimeout: "auto",
    language: "en-US",
  });
  gather.say(
    { voice: "Polly.Joanna" },
    "Hello! Thanks for calling CallGuard. How can I help you today?"
  );

  // If no input, repeat
  response.say(
    { voice: "Polly.Joanna" },
    "I didn't hear anything. Please try again."
  );
  response.redirect(`${cfg.baseUrl}/twilio/voice`);

  res.type("text/xml").send(response.toString());
});

/**
 * POST /twilio/status
 * Receives call status callbacks (ringing, in-progress, completed, etc.)
 */
router.post("/status", twilioAuth, (req, res) => {
  const callSid = req.body.CallSid || "unknown";
  const status = req.body.CallStatus || "unknown";

  if (status === "completed" || status === "failed" || status === "no-answer") {
    tracker.endCall(callSid, status);
  }

  res.sendStatus(204);
});

module.exports = router;
