/**
 * Week 4 tests – Owner dashboard API + WebSocket for live calls.
 */

const request = require("supertest");
const http = require("http");
const WebSocket = require("ws");
const { createApp } = require("../src/index");
const { initWebSocket } = require("../src/ws/live-calls");
const tracker = require("../src/services/call-tracker");

let app, server;

beforeAll((done) => {
  app = createApp();
  server = http.createServer(app);
  initWebSocket(server);
  server.listen(0, done); // random port
});

afterAll((done) => {
  tracker.removeAllListeners();
  server.close(done);
});

describe("Dashboard REST API", () => {
  it("GET /api/dashboard/stats returns stats object", async () => {
    const res = await request(app).get("/api/dashboard/stats");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("activeCalls");
    expect(res.body).toHaveProperty("callsThisWeek");
    expect(res.body).toHaveProperty("bookingsThisWeek");
    expect(res.body).toHaveProperty("aiHandledPct");
  });

  it("GET /api/dashboard/calls/active returns array", async () => {
    const res = await request(app).get("/api/dashboard/calls/active");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/dashboard/calls/log returns array", async () => {
    const res = await request(app).get("/api/dashboard/calls/log");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /api/dashboard/sms returns 400 without required fields", async () => {
    const res = await request(app)
      .post("/api/dashboard/sms")
      .send({ to: "+15551234567" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required fields");
  });
});

describe("Call tracker", () => {
  afterEach(() => {
    // Clean up any leftover calls
    for (const c of tracker.getActiveCalls()) {
      tracker.endCall(c.callSid, "test-cleanup");
    }
  });

  it("tracks a call lifecycle", () => {
    const call = tracker.startCall("CA-track-1", { from: "+1555", to: "+1666" });
    expect(call.status).toBe("ringing");
    expect(tracker.getActiveCalls().length).toBeGreaterThanOrEqual(1);

    tracker.addTranscriptTurn("CA-track-1", "user", "hello");
    tracker.addTranscriptTurn("CA-track-1", "assistant", "hi");

    const active = tracker.getActiveCalls().find((c) => c.callSid === "CA-track-1");
    expect(active.transcript.length).toBe(2);
    expect(active.status).toBe("in-progress");

    const ended = tracker.endCall("CA-track-1", "handled");
    expect(ended.status).toBe("completed");
    expect(tracker.getActiveCalls().find((c) => c.callSid === "CA-track-1")).toBeUndefined();
    expect(tracker.getCallLog().some((c) => c.callSid === "CA-track-1")).toBe(true);
  });

  it("returns stats", () => {
    tracker.startCall("CA-stat-1", { from: "+1555", to: "+1666" });
    tracker.endCall("CA-stat-1", "booked");

    const stats = tracker.getStats();
    expect(typeof stats.activeCalls).toBe("number");
    expect(typeof stats.callsThisWeek).toBe("number");
    expect(typeof stats.bookingsThisWeek).toBe("number");
  });
});

describe("WebSocket", () => {
  it("sends snapshot on connection", (done) => {
    const addr = server.address();
    const ws = new WebSocket(`ws://localhost:${addr.port}/ws`);

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.event).toBe("snapshot");
      expect(msg.data).toHaveProperty("activeCalls");
      ws.close();
      done();
    });

    ws.on("error", done);
  });

  it("broadcasts call:start events", (done) => {
    const addr = server.address();
    const ws = new WebSocket(`ws://localhost:${addr.port}/ws`);
    let gotSnapshot = false;

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.event === "snapshot") {
        gotSnapshot = true;
        // Trigger a call start after we're connected
        tracker.startCall("CA-ws-1", { from: "+1555", to: "+1666" });
        return;
      }
      if (msg.event === "call:start" && gotSnapshot) {
        expect(msg.data.callSid).toBe("CA-ws-1");
        tracker.endCall("CA-ws-1", "test");
        ws.close();
        done();
      }
    });

    ws.on("error", done);
  });
});
