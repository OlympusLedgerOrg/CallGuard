/**
 * Week 7 — New feature tests
 *
 * Tests the 4 missing business-owner features:
 * ⭐ Test My AI Button — simulated call endpoint
 * ⭐ Script Wizard — CRUD for dialogue scripts
 * ⭐ Call Me Back Queue — callback request management
 * ⭐ Offline Mode — service worker served correctly
 */

const request = require("supertest");
const { createApp } = require("../src/index");
const { processInput, endSession } = require("../src/dialogue/ava");
const { DEFAULT_HVAC_CONFIG, DEFAULT_MECHANIC_CONFIG } = require("../../config/businesses");

let app;

beforeAll(() => {
  app = createApp();
});

afterEach(() => {
  endSession("test-sim-1");
  endSession("test-sim-2");
  endSession("test-sim-hvac");
  endSession("test-sim-mech");
});

// ── Test My AI Button ───────────────────────────────────────────

describe("Test My AI — simulated call API", () => {
  it("POST /ava/api/test-call starts a new session and returns greeting", async () => {
    const res = await request(app)
      .post("/ava/api/test-call")
      .send({ sessionId: "test-sim-1", text: "", businessType: "hvac" });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe("test-sim-1");
    expect(res.body.gate).toBe("triage");
    expect(res.body.response).toContain("Ava");
    expect(res.body.type).toBe("gather");
    expect(res.body.done).toBe(false);
  });

  it("POST /ava/api/test-call processes caller input and advances dialogue", async () => {
    // Start session
    await request(app)
      .post("/ava/api/test-call")
      .send({ sessionId: "test-sim-hvac", text: "", businessType: "hvac" });

    // Send caller input
    const res = await request(app)
      .post("/ava/api/test-call")
      .send({ sessionId: "test-sim-hvac", text: "My AC is broken", businessType: "hvac" });

    expect(res.status).toBe(200);
    expect(res.body.done).toBe(false);
    expect(res.body.transcript.length).toBeGreaterThan(0);
  });

  it("POST /ava/api/test-call works with mechanic business type", async () => {
    const res = await request(app)
      .post("/ava/api/test-call")
      .send({ sessionId: "test-sim-mech", text: "", businessType: "mechanic" });

    expect(res.status).toBe(200);
    expect(res.body.response).toContain("Apex Auto");
  });

  it("POST /ava/api/test-call returns 400 without sessionId", async () => {
    const res = await request(app)
      .post("/ava/api/test-call")
      .send({ text: "hello" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("sessionId");
  });

  it("DELETE /ava/api/test-call/:sessionId ends a session", async () => {
    // Start session first
    await request(app)
      .post("/ava/api/test-call")
      .send({ sessionId: "test-sim-2", text: "", businessType: "hvac" });

    const res = await request(app)
      .delete("/ava/api/test-call/test-sim-2");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.session).toBeTruthy();
  });

  it("DELETE /ava/api/test-call/:sessionId handles non-existent session", async () => {
    const res = await request(app)
      .delete("/ava/api/test-call/nonexistent");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.session).toBeNull();
  });
});

// ── Script Wizard ───────────────────────────────────────────────

describe("Script Wizard — dialogue script CRUD", () => {
  it("GET /ava/api/scripts returns 400 without businessId", async () => {
    const res = await request(app).get("/ava/api/scripts");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("businessId");
  });

  it("PUT /ava/api/scripts returns 400 without required fields", async () => {
    const res = await request(app)
      .put("/ava/api/scripts")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("required");
  });

  it("PUT /ava/api/scripts returns 400 without scripts field", async () => {
    const res = await request(app)
      .put("/ava/api/scripts")
      .send({ businessId: "test-biz-1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("required");
  });
});

// ── Call Me Back Queue ──────────────────────────────────────────

describe("Call Me Back Queue — callback management", () => {
  it("GET /ava/api/callbacks returns 400 without businessId", async () => {
    const res = await request(app).get("/ava/api/callbacks");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("businessId");
  });

  it("POST /ava/api/callbacks returns 400 without required fields", async () => {
    const res = await request(app)
      .post("/ava/api/callbacks")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("required");
  });

  it("POST /ava/api/callbacks returns 400 without callerPhone", async () => {
    const res = await request(app)
      .post("/ava/api/callbacks")
      .send({ businessId: "test-biz-1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("callerPhone");
  });

  it("PATCH /ava/api/callbacks/:id returns 400 without status", async () => {
    const res = await request(app)
      .patch("/ava/api/callbacks/test-cb-1")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("status");
  });
});

// ── Offline Mode — service worker ───────────────────────────────

describe("Offline Mode — service worker", () => {
  it("GET /sw.js serves the service worker", async () => {
    const res = await request(app).get("/sw.js");
    expect(res.status).toBe(200);
    expect(res.text).toContain("callguard");
    expect(res.text).toContain("addEventListener");
  });

  it("Service worker caches app shell files", async () => {
    const res = await request(app).get("/sw.js");
    expect(res.text).toContain("/index.html");
    expect(res.text).toContain("/callguard-app.jsx");
    expect(res.text).toContain("/api.js");
  });

  it("index.html includes service worker registration", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("serviceWorker");
    expect(res.text).toContain("sw.js");
  });
});
