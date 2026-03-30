function extractTranscriptText(body = {}) {
  const candidates = [
    body.SpeechResult, // Twilio <Gather>
    body.transcript,   // common ASR payload shape
    body.Transcript,
    body.text,
    body.utterance,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

module.exports = { extractTranscriptText };
