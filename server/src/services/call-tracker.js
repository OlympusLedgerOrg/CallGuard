/**
 * Live call tracker – in-memory store for active calls.
 * Emits events that the WebSocket layer picks up.
 */

const EventEmitter = require("events");

class CallTracker extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, object>} callSid → call data */
    this.activeCalls = new Map();
    /** @type {Array<object>} completed call log (most recent first) */
    this.callLog = [];
  }

  /** Register a new inbound call. */
  startCall(callSid, data) {
    const call = {
      callSid,
      from: data.from || "unknown",
      to: data.to || "unknown",
      status: "ringing",
      startedAt: new Date().toISOString(),
      transcript: [],
      ...data,
    };
    this.activeCalls.set(callSid, call);
    this.emit("call:start", call);
    return call;
  }

  /** Append a transcript turn. */
  addTranscriptTurn(callSid, role, text) {
    const call = this.activeCalls.get(callSid);
    if (!call) return null;
    const turn = { role, text, timestamp: new Date().toISOString() };
    call.transcript.push(turn);
    call.status = "in-progress";
    this.emit("call:transcript", { callSid, turn });
    return turn;
  }

  /** Mark call as completed and move to log. */
  endCall(callSid, outcome) {
    const call = this.activeCalls.get(callSid);
    if (!call) return null;
    call.status = "completed";
    call.endedAt = new Date().toISOString();
    call.outcome = outcome || "handled";
    this.activeCalls.delete(callSid);
    this.callLog.unshift(call);
    if (this.callLog.length > 200) this.callLog.pop();
    this.emit("call:end", call);
    return call;
  }

  /** Get all active calls. */
  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }

  /** Get recent call log. */
  getCallLog(limit = 50) {
    return this.callLog.slice(0, limit);
  }

  /** Dashboard stats. */
  getStats() {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const recentCalls = this.callLog.filter(
      (c) => new Date(c.startedAt) >= weekAgo
    );
    const booked = recentCalls.filter((c) => c.outcome === "booked").length;

    return {
      activeCalls: this.activeCalls.size,
      callsThisWeek: recentCalls.length,
      bookingsThisWeek: booked,
      aiHandledPct:
        recentCalls.length > 0
          ? Math.round(
              (recentCalls.filter((c) => c.outcome !== "transferred").length /
                recentCalls.length) *
                100
            )
          : 0,
    };
  }
}

// Singleton
const tracker = new CallTracker();
module.exports = tracker;
