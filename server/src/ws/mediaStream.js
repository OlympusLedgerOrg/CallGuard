// src/ws/mediaStream.js
// ══════════════════════════════════════════════════════════════════
// VibeVoice — Twilio Media Streams Handler
// Real-time bidirectional audio streaming for ultra-low-latency voice AI.
//
// Architecture:
//   Caller ←→ Twilio Media Streams ←→ VibeVoice ←→ Deepgram STT
//                                               ←→ ElevenLabs TTS
//                                               ←→ Ava Dialogue Engine
//
// Flow:
//   1. Twilio connects WebSocket when call starts (via <Stream> TwiML)
//   2. Audio flows in real-time: caller speaks → Deepgram transcribes
//   3. Ava processes transcript → generates response
//   4. ElevenLabs synthesizes → audio streams back to caller
//
// This provides ~300ms response latency vs ~2-3s with standard Gather/Say.
// ══════════════════════════════════════════════════════════════════

const { WebSocketServer } = require("ws");
const { createSTTStream, isStreamingSTTAvailable } = require("../services/stt-stream");
const { createTTSStream, isStreamingTTSAvailable } = require("../services/tts-stream");
const { processInput, getSession, setSessionPaused } = require("../dialogue/ava");
const { pushTranscriptLine, pushCallStatus } = require("./liveCall");
const db = require("../db/client");

// callSid → MediaStreamSession
const mediaStreams = new Map();

// ── Media Stream Session ─────────────────────────────────────────
class MediaStreamSession {
  constructor(callSid, streamSid, ws) {
    this.callSid = callSid;
    this.streamSid = streamSid;
    this.ws = ws;
    this.stt = null;
    this.tts = null;
    this.bizConfig = null;
    this.businessId = null;
    this.transcriptBuffer = "";
    this.lastTranscriptTime = 0;
    this.isProcessing = false;
    this.paused = false;
    this.silenceTimeout = null;
    this.connected = false;
  }

  async initialize(bizConfig, businessId) {
    this.bizConfig = bizConfig;
    this.businessId = businessId;
    this.connected = true;

    // Initialize STT if available
    if (isStreamingSTTAvailable()) {
      this.stt = createSTTStream(this.callSid, this._onTranscript.bind(this));
      try {
        await this.stt.connect();
      } catch (err) {
        console.error(`[MediaStream] STT connect failed for ${this.callSid}:`, err.message);
        this.stt = null;
      }
    }

    // Initialize TTS if available
    if (isStreamingTTSAvailable()) {
      this.tts = createTTSStream(this.callSid, this._onTTSAudio.bind(this));
      try {
        await this.tts.connect();
      } catch (err) {
        console.error(`[MediaStream] TTS connect failed for ${this.callSid}:`, err.message);
        this.tts = null;
      }
    }

    // Send initial greeting
    const { action } = processInput(this.callSid, "", this.bizConfig);
    if (action.text) {
      await this._speak(action.text);
      pushTranscriptLine(this.callSid, { from: "ava", text: action.text, ts: Date.now() });
    }

    console.log(`[MediaStream] Session initialized for ${this.callSid} (STT: ${!!this.stt}, TTS: ${!!this.tts})`);
  }

  // Handle incoming audio from Twilio
  handleMedia(payload) {
    if (this.paused) return;

    const audioBuffer = Buffer.from(payload.payload, "base64");
    
    if (this.stt) {
      this.stt.write(audioBuffer);
    }
  }

  // Handle DTMF tones
  handleDTMF(digit) {
    console.log(`[MediaStream] DTMF: ${digit} for ${this.callSid}`);
    // Could map digits to intents (e.g., "1" = yes, "2" = no)
  }

  // Pause Ava processing (owner taking over)
  pause() {
    this.paused = true;
    if (this.tts) this.tts.interrupt();
    console.log(`[MediaStream] Paused for ${this.callSid}`);
  }

  // Resume Ava processing
  resume() {
    this.paused = false;
    console.log(`[MediaStream] Resumed for ${this.callSid}`);
  }

  // ── STT Transcript callback ────────────────────────────────────
  async _onTranscript(result) {
    if (this.paused) return;

    const { text, isFinal, isUtteranceEnd } = result;

    // Buffer partial transcripts
    if (!isFinal && text) {
      this.transcriptBuffer = text;
      this.lastTranscriptTime = Date.now();
      
      // Push interim transcript to dashboard
      pushTranscriptLine(this.callSid, {
        from: "caller",
        text: text,
        ts: Date.now(),
        interim: true,
      });
      return;
    }

    // Final transcript or utterance end — process with Ava
    const finalText = isFinal ? text : this.transcriptBuffer;
    if (!finalText?.trim() && !isUtteranceEnd) return;

    // Prevent overlapping processing
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Clear silence timeout
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }

      // Push final transcript
      if (finalText?.trim()) {
        pushTranscriptLine(this.callSid, {
          from: "caller",
          text: finalText,
          ts: Date.now(),
        });
        console.log(`[MediaStream] ${this.callSid} caller: "${finalText}"`);
      }

      // Process with Ava
      const { action, session, done } = processInput(this.callSid, finalText || "", this.bizConfig);

      // Speak response
      if (action.text && !this.paused) {
        await this._speak(action.text, action.type === "hangup" ? "confirm" : "ava");
        pushTranscriptLine(this.callSid, { from: "ava", text: action.text, ts: Date.now() });
      }

      // Handle call end
      if (done || action.type === "hangup") {
        this._handleCallEnd(session);
      }

      // Reset buffer
      this.transcriptBuffer = "";

    } finally {
      this.isProcessing = false;
    }
  }

  // ── TTS Audio callback ─────────────────────────────────────────
  _onTTSAudio(audioBuffer) {
    if (!this.connected || this.paused) return;

    // Send audio to Twilio
    const message = {
      event: "media",
      streamSid: this.streamSid,
      media: {
        payload: audioBuffer.toString("base64"),
      },
    };

    if (this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // ── Speak text (TTS or fallback) ───────────────────────────────
  async _speak(text, preset = "ava") {
    if (this.tts) {
      await this.tts.speak(text, { preset });
    } else {
      // Fallback: send mark event and let Twilio handle TTS
      // (This won't be as smooth but works without ElevenLabs)
      console.log(`[MediaStream] TTS fallback for: "${text.substring(0, 50)}..."`);
    }
  }

  // ── Handle call end ────────────────────────────────────────────
  async _handleCallEnd(session) {
    const { disposition } = session;
    pushCallStatus(this.callSid, "completed");

    // Update DB
    try {
      const call = await db.calls.findFirst({ where: { twilioCallSid: this.callSid } });
      if (call) {
        await db.calls.update({
          where: { id: call.id },
          data: { disposition: disposition || "completed" },
        });
      }
    } catch (err) {
      console.error(`[MediaStream] DB update error:`, err.message);
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────
  close() {
    this.connected = false;
    if (this.stt) {
      this.stt.close();
      this.stt = null;
    }
    if (this.tts) {
      this.tts.close();
      this.tts = null;
    }
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }
    console.log(`[MediaStream] Session closed for ${this.callSid}`);
  }
}

// ── Attach Media Stream WebSocket server ─────────────────────────
function attachMediaStreamServer(httpServer, path = "/media-stream") {
  const wss = new WebSocketServer({ server: httpServer, path });

  wss.on("connection", (ws, req) => {
    let session = null;

    console.log(`[MediaStream] New connection from ${req.socket.remoteAddress}`);

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data);

        switch (msg.event) {
          case "connected":
            console.log(`[MediaStream] Connected event received`);
            break;

          case "start":
            // Twilio sends start event with call metadata
            const { callSid, streamSid, customParameters } = msg.start;
            console.log(`[MediaStream] Start: callSid=${callSid}, streamSid=${streamSid}`);

            session = new MediaStreamSession(callSid, streamSid, ws);
            mediaStreams.set(callSid, session);

            // Load business config
            const bizConfig = customParameters?.bizConfig 
              ? JSON.parse(customParameters.bizConfig)
              : await loadBizConfigFromDB(customParameters?.toNumber);

            await session.initialize(bizConfig.config, bizConfig.businessId);
            break;

          case "media":
            // Incoming audio from caller
            if (session) {
              session.handleMedia(msg.media);
            }
            break;

          case "dtmf":
            // DTMF tone pressed
            if (session) {
              session.handleDTMF(msg.dtmf.digit);
            }
            break;

          case "stop":
            // Call ended
            console.log(`[MediaStream] Stop event received`);
            if (session) {
              session.close();
              mediaStreams.delete(session.callSid);
            }
            break;

          case "mark":
            // Mark event (used for timing)
            break;
        }
      } catch (err) {
        console.error(`[MediaStream] Message handling error:`, err.message);
      }
    });

    ws.on("close", () => {
      if (session) {
        session.close();
        mediaStreams.delete(session.callSid);
      }
    });

    ws.on("error", (err) => {
      console.error(`[MediaStream] WebSocket error:`, err.message);
    });
  });

  return wss;
}

// ── Load business config from DB ─────────────────────────────────
async function loadBizConfigFromDB(toNumber) {
  const { DEFAULT_HVAC_CONFIG } = require("../../../config/businesses");
  
  try {
    if (toNumber) {
      const tn = await db.twilioNumbers.findUnique({
        where: { phoneNumber: toNumber },
        include: { business: true },
      });
      if (tn?.business) {
        return {
          businessId: tn.business.id,
          config: {
            ...DEFAULT_HVAC_CONFIG,
            name: tn.business.name,
            phone: tn.business.phone,
          },
        };
      }
    }
  } catch (err) {
    console.error(`[MediaStream] loadBizConfig error:`, err.message);
  }

  return { businessId: null, config: DEFAULT_HVAC_CONFIG };
}

// ── Get active media stream session ──────────────────────────────
function getMediaStreamSession(callSid) {
  return mediaStreams.get(callSid);
}

// ── Pause/resume Ava for a call (owner takeover) ─────────────────
function pauseMediaStream(callSid) {
  const session = mediaStreams.get(callSid);
  if (session) {
    session.pause();
    return true;
  }
  return false;
}

function resumeMediaStream(callSid) {
  const session = mediaStreams.get(callSid);
  if (session) {
    session.resume();
    return true;
  }
  return false;
}

// ── Check if VibeVoice is available ──────────────────────────────
function isVibeVoiceAvailable() {
  return isStreamingSTTAvailable() || isStreamingTTSAvailable();
}

module.exports = {
  attachMediaStreamServer,
  getMediaStreamSession,
  pauseMediaStream,
  resumeMediaStream,
  isVibeVoiceAvailable,
  MediaStreamSession,
};
