/**
 * Week 4 tests – Owner dashboard API + WebSocket for live calls.
 */

process.env.DASHBOARD_JWT_SECRET = "test-dashboard-secret";
process.env.DASHBOARD_USER = "owner";
process.env.DASHBOARD_PASSWORD = "owner-pass";

const request = require("supertest");
const http = require("http");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const { createApp } = require("../src/index");
const { initWebSocket } = require("../src/ws/live-calls");
const tracker = require("../src/services/call-tracker");

let app, server;
let authHeader;

beforeAll((done) => {
  app = createApp();
  server = http.createServer(app);
  initWebSocket(server);
  server.listen(0, done); // random port
  const token = jwt.sign(
    { sub: process.env.DASHBOARD_USER },
    process.env.DASHBOARD_JWT_SECRET,
    { issuer: "callguard", audience: "dashboard" }
  );
  authHeader = { Authorization: `Bearer ${token}` };
});

afterAll((done) => {
  tracker.removeAllListeners();
  server.close(done);
});

describe("Dashboard REST API", () => {
  it("POST /api/auth/login returns a token with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: process.env.DASHBOARD_USER, password: process.env.DASHBOARD_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.username).toBe(process.env.DASHBOARD_USER);
  });

  it("GET /api/dashboard/stats returns stats object", async () => {
    const res = await request(app)
      .get("/api/dashboard/stats")
      .set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("activeCalls");
    expect(res.body).toHaveProperty("callsThisWeek");
    expect(res.body).toHaveProperty("bookingsThisWeek");
    expect(res.body).toHaveProperty("aiHandledPct");
  });

  it("GET /api/dashboard/calls/active returns array", async () => {
    const res = await request(app)
      .get("/api/dashboard/calls/active")
      .set(authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/dashboard/calls/log returns array", async () => {
    const res = await request(app)
      .get("/api/dashboard/calls/log")
      .set(authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /api/dashboard/sms returns 400 without required fields", async () => {
    const res = await request(app)
      .post("/api/dashboard/sms")
      .set(authHeader)
      .send({ to: "+15551234567" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required fields");
  });

  it("GET /api/dashboard/stats returns 401 without auth", async () => {
    const res = await request(app).get("/api/dashboard/stats");
    expect(res.status).toBe(401);
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
