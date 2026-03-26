/**
 * Week 4 – WebSocket server for live call updates.
 *
 * Clients connect to ws://host/ws and receive JSON messages:
 *   { event: "call:start",      data: { callSid, from, ... } }
 *   { event: "call:transcript",  data: { callSid, turn } }
 *   { event: "call:end",         data: { callSid, outcome, ... } }
 */

const { WebSocketServer } = require("ws");
const tracker = require("../services/call-tracker");

let wss = null;

function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    // Send current active calls on connect
    const activeCalls = tracker.getActiveCalls();
    ws.send(
      JSON.stringify({ event: "snapshot", data: { activeCalls } })
    );
  });

  // Forward call tracker events to all connected clients
  const events = ["call:start", "call:transcript", "call:end"];
  for (const evt of events) {
    tracker.on(evt, (data) => {
      broadcast({ event: evt, data });
    });
  }

  return wss;
}

function broadcast(message) {
  if (!wss) return;
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === 1 /* WebSocket.OPEN */) {
      client.send(payload);
    }
  }
}

function getWss() {
  return wss;
}

module.exports = { initWebSocket, broadcast, getWss };
