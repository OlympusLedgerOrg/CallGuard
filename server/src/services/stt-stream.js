// src/services/stt-stream.js
// ══════════════════════════════════════════════════════════════════
// VibeVoice — Streaming Speech-to-Text (Deepgram)
// Real-time transcription for low-latency voice AI.
//
// Supports:
//   - Deepgram (primary, recommended for accuracy)
//   - Fallback to Twilio's built-in STT if no API key configured
//
// Usage:
//   const stt = createSTTStream(callSid, onTranscript);
//   stt.write(audioChunk);  // mulaw/8000 from Twilio Media Streams
//   stt.close();
// ══════════════════════════════════════════════════════════════════

const WebSocket = require("ws");

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";

// ── Deepgram streaming STT client ────────────────────────────────
class DeepgramSTTStream {
  constructor(callSid, onTranscript, options = {}) {
    this.callSid = callSid;
    this.onTranscript = onTranscript;
    this.ws = null;
    this.connected = false;
    this.buffer = [];
    this.options = {
      model: "nova-2",           // Best accuracy for phone calls
      language: "en-US",
      punctuate: true,
      interim_results: true,     // Get partial results for responsiveness
      endpointing: 300,          // 300ms silence = end of utterance
      utterance_end_ms: 1000,    // Finalize after 1s pause
      smart_format: true,        // Format numbers, currency, etc.
      ...options,
    };
  }

  async connect() {
    if (!DEEPGRAM_API_KEY) {
      console.warn("[STT] No DEEPGRAM_API_KEY — streaming STT disabled");
      return false;
    }

    const url = new URL("wss://api.deepgram.com/v1/listen");
    url.searchParams.set("model", this.options.model);
    url.searchParams.set("language", this.options.language);
    url.searchParams.set("punctuate", this.options.punctuate);
    url.searchParams.set("interim_results", this.options.interim_results);
    url.searchParams.set("endpointing", this.options.endpointing);
    url.searchParams.set("utterance_end_ms", this.options.utterance_end_ms);
    url.searchParams.set("smart_format", this.options.smart_format);
    url.searchParams.set("encoding", "mulaw");
    url.searchParams.set("sample_rate", "8000");
    url.searchParams.set("channels", "1");

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url.toString(), {
        headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
      });

      this.ws.on("open", () => {
        console.log(`[STT] Deepgram connected for call ${this.callSid}`);
        this.connected = true;
        // Flush any buffered audio
        for (const chunk of this.buffer) {
          this.ws.send(chunk);
        }
        this.buffer = [];
        resolve(true);
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data);
          this._handleMessage(msg);
        } catch (err) {
          console.error("[STT] Parse error:", err.message);
        }
      });

      this.ws.on("error", (err) => {
        console.error(`[STT] Deepgram error for ${this.callSid}:`, err.message);
        this.connected = false;
        reject(err);
      });

      this.ws.on("close", () => {
        console.log(`[STT] Deepgram closed for ${this.callSid}`);
        this.connected = false;
      });

      // Timeout connection attempt
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error("Deepgram connection timeout"));
        }
      }, 5000);
    });
  }

  _handleMessage(msg) {
    if (msg.type === "Results") {
      const alt = msg.channel?.alternatives?.[0];
      if (!alt) return;

      const transcript = alt.transcript || "";
      const isFinal = msg.is_final;
      const confidence = alt.confidence || 0;

      if (transcript.trim()) {
        this.onTranscript({
          text: transcript,
          isFinal,
          confidence,
          words: alt.words || [],
          callSid: this.callSid,
        });
      }
    }

    if (msg.type === "UtteranceEnd") {
      // Caller finished speaking — signal to Ava to respond
      this.onTranscript({
        text: "",
        isFinal: true,
        isUtteranceEnd: true,
        callSid: this.callSid,
      });
    }
  }

  write(audioBuffer) {
    if (!this.connected) {
      // Buffer audio until connected
      this.buffer.push(audioBuffer);
      return;
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioBuffer);
    }
  }

  close() {
    if (this.ws) {
      // Send close message to Deepgram
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "CloseStream" }));
      }
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.buffer = [];
  }
}

// ── Factory function ─────────────────────────────────────────────
function createSTTStream(callSid, onTranscript, options = {}) {
  return new DeepgramSTTStream(callSid, onTranscript, options);
}

// ── Check if streaming STT is available ──────────────────────────
function isStreamingSTTAvailable() {
  return !!DEEPGRAM_API_KEY;
}

module.exports = {
  createSTTStream,
  isStreamingSTTAvailable,
  DeepgramSTTStream,
};
