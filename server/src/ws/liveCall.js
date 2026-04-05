// src/ws/liveCall.js
// WebSocket server for real-time owner dashboard features:
//   - Live transcript streaming (caller + Ava turns pushed as they happen)
//   - Owner join / take-over notifications
//   - Mid-call SMS dispatch
//
// VibeVoice: Now actually pauses Ava and redirects call via Twilio REST API.
//
// The app connects when it sees LIVE CALL on the home screen.
// The server pushes events; the app reacts without polling.

const { WebSocketServer } = require("ws");
const twilio = require("twilio");
const { sendMidCallInfo } = require("../sms/sms");
const { setSessionPaused } = require("../dialogue/ava");
const { pauseMediaStream, resumeMediaStream } = require("./mediaStream");
const db = require("../db/client");
const cfg = require("../config");

// callSid → Set<WebSocket>  (multiple owners could watch the same call)
const callRooms = new Map();

// Twilio client for call modifications
function getTwilioClient() {
  if (!cfg.twilioAccountSid || !cfg.twilioAuthToken) {
    return null;
  }
  return twilio(cfg.twilioAccountSid, cfg.twilioAuthToken);
}

// ── Attach WS server to existing HTTP server ────────────────────
function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "ws://localhost");
    const callSid = url.searchParams.get("callSid");
    const role = url.searchParams.get("role") || "owner"; // owner | monitor

    if (!callSid) {
      ws.close(1008, "callSid required");
      return;
    }

    // Add to room
    if (!callRooms.has(callSid)) callRooms.set(callSid, new Set());
    callRooms.get(callSid).add(ws);

    console.log(`[WS] ${role} joined call room ${callSid}. Room size: ${callRooms.get(callSid).size}`);

    // Send current state on join
    ws.send(JSON.stringify({
      event: "connected",
      callSid,
      role,
      ts: Date.now(),
    }));

    // ── Incoming messages from owner ──────────────────────────
    ws.on("message", async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); }
      catch { return; }

      switch (msg.event) {
        // Owner wants to listen silently (no action needed server-side for now)
        case "listen_in":
          broadcastToRoom(callSid, { event: "mode_change", mode: "listen", ts: Date.now() }, ws);
          break;

        // Owner is taking over the call — actually pause Ava and redirect
        case "take_over":
          await handleOwnerTakeover(callSid, ws);
          break;

        // Owner handing back to Ava
        case "hand_back":
          await handleHandBackToAva(callSid, ws);
          break;

        // Owner sending info SMS to caller mid-call
        case "send_sms": {
          const { body, businessId, toNumber } = msg;
          if (!body || !toNumber) break;
          try {
            const call = await db.calls.findFirst({ where: { twilioCallSid: callSid } });
            const business = await db.businesses.findUnique({ where: { id: businessId } });
            if (!business) break;

            await sendMidCallInfo({
              business,
              toNumber,
              body,
              callId: call?.id,
            });

            // Echo the sent message back to all room watchers
            broadcastToRoom(callSid, {
              event:    "sms_sent",
              body,
              to:       toNumber,
              ts:       Date.now(),
            });
          } catch (err) {
            ws.send(JSON.stringify({ event: "error", message: err.message }));
          }
          break;
        }

        // Owner ending the call
        case "end_call":
          broadcastToRoom(callSid, { event: "call_ended", ts: Date.now() });
          break;
      }
    });

    ws.on("close", () => {
      const room = callRooms.get(callSid);
      if (room) {
        room.delete(ws);
        if (room.size === 0) callRooms.delete(callSid);
      }
      console.log(`[WS] Connection closed for call ${callSid}`);
    });

    ws.on("error", (err) => {
      console.error(`[WS] Error on call ${callSid}:`, err.message);
    });
  });

  return wss;
}

// ── Push a transcript line to all room watchers ─────────────────
// Called by the voice route after each Ava turn or STT result
function pushTranscriptLine(callSid, line) {
  // line: { from: "ava"|"caller", text: string, ts: number }
  broadcastToRoom(callSid, { event: "transcript_line", line });
}

// ── Push call status update ──────────────────────────────────────
function pushCallStatus(callSid, status) {
  broadcastToRoom(callSid, { event: "call_status", status, ts: Date.now() });
}

// ── Push disposition when Ava determines outcome ─────────────────
function pushDisposition(callSid, disposition) {
  broadcastToRoom(callSid, { event: "disposition", disposition, ts: Date.now() });
}

// ── Broadcast to all sockets in a room ──────────────────────────
function broadcastToRoom(callSid, payload, exclude = null) {
  const room = callRooms.get(callSid);
  if (!room) return;
  const data = JSON.stringify(payload);
  for (const ws of room) {
    if (ws !== exclude && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

// ── Log call event to DB ─────────────────────────────────────────
async function logCallEvent(callSid, event) {
  try {
    const call = await db.calls.findFirst({ where: { twilioCallSid: callSid } });
    if (!call) return;
    if (event === "owner_took_over") {
      await db.calls.update({
        where: { id: call.id },
        data:  { aiHandled: false },
      });
    }
  } catch (err) {
    console.error("[WS] logCallEvent error:", err.message);
  }
}

// ── Handle owner takeover — actually pause Ava and redirect call ─
async function handleOwnerTakeover(callSid, ws) {
  console.log(`[WS] Owner takeover initiated for ${callSid}`);

  // 1. Pause Ava session (stops processInput from responding)
  setSessionPaused(callSid, true);

  // 2. Pause media stream if VibeVoice is active
  pauseMediaStream(callSid);

  // 3. Redirect the active call to the takeover TwiML endpoint
  const client = getTwilioClient();
  if (client) {
    try {
      const takeoverUrl = `${cfg.baseUrl}/ava/voice/takeover`;
      await client.calls(callSid).update({
        url: takeoverUrl,
        method: "POST",
      });
      console.log(`[WS] Call ${callSid} redirected to takeover endpoint`);
    } catch (err) {
      console.error(`[WS] Failed to redirect call ${callSid}:`, err.message);
      ws.send(JSON.stringify({
        event: "error",
        message: `Failed to redirect call: ${err.message}`,
        ts: Date.now(),
      }));
    }
  } else {
    console.warn(`[WS] No Twilio client — takeover is simulated only`);
  }

  // 4. Broadcast mode change and log
  broadcastToRoom(callSid, { event: "mode_change", mode: "owner_live", ts: Date.now() });
  await logCallEvent(callSid, "owner_took_over");

  // 5. Confirm to the requesting client
  ws.send(JSON.stringify({
    event: "takeover_confirmed",
    callSid,
    ts: Date.now(),
  }));
}

// ── Handle hand back to Ava — resume AI processing ───────────────
async function handleHandBackToAva(callSid, ws) {
  console.log(`[WS] Handing call ${callSid} back to Ava`);

  // 1. Resume Ava session
  setSessionPaused(callSid, false);

  // 2. Resume media stream if VibeVoice is active
  resumeMediaStream(callSid);

  // 3. Redirect call back to Ava's input endpoint
  const client = getTwilioClient();
  if (client) {
    try {
      const inputUrl = `${cfg.baseUrl}/ava/voice/input?callSid=${encodeURIComponent(callSid)}`;
      await client.calls(callSid).update({
        url: inputUrl,
        method: "POST",
      });
      console.log(`[WS] Call ${callSid} returned to Ava`);
    } catch (err) {
      console.error(`[WS] Failed to return call ${callSid} to Ava:`, err.message);
    }
  }

  // 4. Broadcast and log
  broadcastToRoom(callSid, { event: "mode_change", mode: "ai", ts: Date.now() });
  await logCallEvent(callSid, "handed_back_to_ai");

  ws.send(JSON.stringify({
    event: "handback_confirmed",
    callSid,
    ts: Date.now(),
  }));
}

module.exports = {
  attachWebSocketServer,
  pushTranscriptLine,
  pushCallStatus,
  pushDisposition,
  broadcastToRoom,
};
