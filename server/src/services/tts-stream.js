// src/services/tts-stream.js
// ══════════════════════════════════════════════════════════════════
// VibeVoice — Streaming Text-to-Speech (ElevenLabs)
// Ultra-low-latency voice synthesis for natural AI conversations.
//
// Supports:
//   - ElevenLabs (primary, recommended for natural voice)
//   - Fallback to Twilio's Polly voices if no API key configured
//
// Usage:
//   const tts = createTTSStream(callSid, onAudioChunk);
//   await tts.speak("Hello, how can I help?");
//   tts.close();
// ══════════════════════════════════════════════════════════════════

const WebSocket = require("ws");

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";

// ── Voice presets for different business types ───────────────────
const VOICE_PRESETS = {
  // Friendly, professional female voice — great for HVAC/mechanic
  ava: {
    voiceId: "EXAVITQu4vr4xnSDxMaL",  // "Sarah" — warm, professional
    model: "eleven_turbo_v2_5",        // Fastest model for real-time
    stability: 0.5,
    similarity_boost: 0.8,
    style: 0.2,
  },
  // Calmer, more authoritative for emergencies
  emergency: {
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    model: "eleven_turbo_v2_5",
    stability: 0.7,
    similarity_boost: 0.9,
    style: 0.1,
  },
  // Upbeat for confirmations
  confirm: {
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    model: "eleven_turbo_v2_5",
    stability: 0.4,
    similarity_boost: 0.8,
    style: 0.4,
  },
};

// ── ElevenLabs streaming TTS client ──────────────────────────────
class ElevenLabsTTSStream {
  constructor(callSid, onAudioChunk, options = {}) {
    this.callSid = callSid;
    this.onAudioChunk = onAudioChunk;
    this.ws = null;
    this.connected = false;
    this.speaking = false;
    this.queue = [];
    this.options = {
      preset: "ava",
      outputFormat: "ulaw_8000",  // Twilio-compatible format
      ...options,
    };
  }

  async connect() {
    if (!ELEVENLABS_API_KEY) {
      console.warn("[TTS] No ELEVENLABS_API_KEY — streaming TTS disabled");
      return false;
    }

    const preset = VOICE_PRESETS[this.options.preset] || VOICE_PRESETS.ava;
    const url = `wss://api.elevenlabs.io/v1/text-to-speech/${preset.voiceId}/stream-input?model_id=${preset.model}&output_format=${this.options.outputFormat}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      });

      this.ws.on("open", () => {
        console.log(`[TTS] ElevenLabs connected for call ${this.callSid}`);
        this.connected = true;

        // Send initial config
        const preset = VOICE_PRESETS[this.options.preset] || VOICE_PRESETS.ava;
        this.ws.send(JSON.stringify({
          text: " ",  // Initial space to warm up
          voice_settings: {
            stability: preset.stability,
            similarity_boost: preset.similarity_boost,
            style: preset.style,
          },
          generation_config: {
            chunk_length_schedule: [50, 100, 150, 200],  // Faster initial chunks
          },
          xi_api_key: ELEVENLABS_API_KEY,
        }));

        resolve(true);
      });

      this.ws.on("message", (data, isBinary) => {
        if (isBinary) {
          // Binary audio data - isBinary guarantees this is audio content
          if (data.length > 0) {
            this.onAudioChunk(data);
          }
          return;
        }

        try {
          const payload = Buffer.isBuffer(data) ? data.toString("utf8") : data;
          const msg = JSON.parse(payload);
          this._handleMessage(msg);
        } catch {
          console.warn(`[TTS] Ignoring invalid text message for ${this.callSid}`);
        }
      });

      this.ws.on("error", (err) => {
        console.error(`[TTS] ElevenLabs error for ${this.callSid}:`, err.message);
        this.connected = false;
        reject(err);
      });

      this.ws.on("close", () => {
        console.log(`[TTS] ElevenLabs closed for ${this.callSid}`);
        this.connected = false;
        this.speaking = false;
      });

      setTimeout(() => {
        if (!this.connected) {
          reject(new Error("ElevenLabs connection timeout"));
        }
      }, 5000);
    });
  }

  _handleMessage(msg) {
    if (msg.audio) {
      // Base64-encoded audio chunk
      const audioBuffer = Buffer.from(msg.audio, "base64");
      this.onAudioChunk(audioBuffer);
    }

    if (msg.isFinal) {
      this.speaking = false;
      this._processQueue();
    }

    if (msg.error) {
      console.error(`[TTS] ElevenLabs error:`, msg.error);
    }
  }

  async speak(text, options = {}) {
    if (!text?.trim()) return;

    if (!this.connected) {
      // Queue for later or use fallback
      this.queue.push({ text, options });
      return;
    }

    if (this.speaking) {
      // Queue while speaking
      this.queue.push({ text, options });
      return;
    }

    this.speaking = true;

    const preset = VOICE_PRESETS[options.preset || this.options.preset] || VOICE_PRESETS.ava;

    this.ws.send(JSON.stringify({
      text: text + " ",  // Trailing space helps with prosody
      voice_settings: {
        stability: preset.stability,
        similarity_boost: preset.similarity_boost,
        style: preset.style,
      },
      try_trigger_generation: true,
    }));

    // Signal end of text
    this.ws.send(JSON.stringify({
      text: "",
    }));
  }

  _processQueue() {
    if (this.queue.length > 0 && !this.speaking) {
      const { text, options } = this.queue.shift();
      this.speak(text, options);
    }
  }

  interrupt() {
    // Clear queue and stop current speech
    this.queue = [];
    if (this.speaking && this.ws?.readyState === WebSocket.OPEN) {
      // Send empty text to flush
      this.ws.send(JSON.stringify({ text: "", flush: true }));
    }
    this.speaking = false;
  }

  close() {
    this.interrupt();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}

// ── Factory function ─────────────────────────────────────────────
function createTTSStream(callSid, onAudioChunk, options = {}) {
  return new ElevenLabsTTSStream(callSid, onAudioChunk, options);
}

// ── Check if streaming TTS is available ──────────────────────────
function isStreamingTTSAvailable() {
  return !!ELEVENLABS_API_KEY;
}

// ── Get available voice presets ──────────────────────────────────
function getVoicePresets() {
  return Object.keys(VOICE_PRESETS);
}

module.exports = {
  createTTSStream,
  isStreamingTTSAvailable,
  getVoicePresets,
  ElevenLabsTTSStream,
  VOICE_PRESETS,
};
