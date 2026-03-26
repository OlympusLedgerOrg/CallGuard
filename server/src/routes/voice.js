/**
 * Week 2 – Voice round-trip routes (STT → dialogue → TTS).
 *
 * POST /voice/respond  → receives Gather result (STT text), runs dialogue
 *                         engine, replies with TTS, gathers next turn.
 */

const { Router } = require("express");
const { twiml: { VoiceResponse } } = require("twilio");
const twilioAuth = require("../middleware/twilio-auth");
const dialogue = require("../services/dialogue");
const tracker = require("../services/call-tracker");
const cfg = require("../config");

const router = Router();

/**
 * POST /voice/respond
 * Twilio sends the STT result here after <Gather>.
 * The dialogue engine classifies the intent and we reply with <Say>.
 */
router.post("/respond", twilioAuth, (req, res) => {
  const callSid = req.body.CallSid || "unknown";
  const speechResult = req.body.SpeechResult || "";

  // Record user speech in tracker
  tracker.addTranscriptTurn(callSid, "user", speechResult);

  // Run dialogue engine
  const { intent, response: replyText } = dialogue.getReply(callSid, speechResult);

  // Record AI reply in tracker
  tracker.addTranscriptTurn(callSid, "assistant", replyText);

  const twimlResponse = new VoiceResponse();

  // If the intent signals end of conversation, say goodbye and hang up
  if (intent === "thanks") {
    twimlResponse.say({ voice: "Polly.Joanna" }, replyText);
    twimlResponse.hangup();
    dialogue.endSession(callSid);
    tracker.endCall(callSid, "handled");
    return res.type("text/xml").send(twimlResponse.toString());
  }

  // If booking intent, redirect to booking flow
  if (intent === "booking") {
    twimlResponse.say({ voice: "Polly.Joanna" }, replyText);
    twimlResponse.redirect(`${cfg.baseUrl}/booking/start?CallSid=${encodeURIComponent(callSid)}`);
    return res.type("text/xml").send(twimlResponse.toString());
  }

  // Otherwise, reply and gather next turn
  const gather = twimlResponse.gather({
    input: "speech",
    action: `${cfg.baseUrl}/voice/respond`,
    method: "POST",
    speechTimeout: "auto",
    language: "en-US",
  });
  gather.say({ voice: "Polly.Joanna" }, replyText);

  // Timeout fallback
  twimlResponse.say(
    { voice: "Polly.Joanna" },
    "Are you still there? If you need anything else, please let me know."
  );
  twimlResponse.redirect(`${cfg.baseUrl}/voice/respond`);

  res.type("text/xml").send(twimlResponse.toString());
});

module.exports = router;
