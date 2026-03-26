/**
 * Week 6 — Ava dialogue engine tests
 *
 * Tests the stateful gate-based conversation manager,
 * TwiML builder, and new route structure.
 */

const request = require("supertest");
const { createApp } = require("../src/index");
const { processInput, endSession, getSession, GATES } = require("../src/dialogue/ava");
const { buildTwiML, escapeXml } = require("../src/twilio/twiml");
const { DEFAULT_HVAC_CONFIG, DEFAULT_MECHANIC_CONFIG } = require("../../config/businesses");

let app;

beforeAll(() => {
  app = createApp();
});

afterEach(() => {
  // Clean up sessions between tests
  endSession("test-call-1");
  endSession("test-call-2");
  endSession("test-hvac-1");
  endSession("test-mechanic-1");
});

// ── Ava Dialogue Engine ─────────────────────────────────────────

describe("Ava dialogue engine", () => {
  it("starts at GREETING gate and moves to TRIAGE on first input", () => {
    const result = processInput("test-call-1", "", DEFAULT_HVAC_CONFIG);
    expect(result.action.type).toBe("gather");
    expect(result.action.text).toContain(DEFAULT_HVAC_CONFIG.name);
    expect(result.session.gate).toBe(GATES.TRIAGE);
    expect(result.done).toBe(false);
  });

  it("detects AC issue intent for HVAC business", () => {
    processInput("test-hvac-1", "", DEFAULT_HVAC_CONFIG); // greeting
    const result = processInput("test-hvac-1", "My AC is not cooling", DEFAULT_HVAC_CONFIG);
    expect(result.session.issue_type).toBe("ac");
    expect(result.session.issue).toBe("My AC is not cooling");
    expect(result.done).toBe(false);
  });

  it("detects brakes intent for mechanic business", () => {
    processInput("test-mechanic-1", "", DEFAULT_MECHANIC_CONFIG); // greeting
    const result = processInput("test-mechanic-1", "My brakes are squealing", DEFAULT_MECHANIC_CONFIG);
    expect(result.session.issue_type).toBe("brakes");
    expect(result.done).toBe(false);
  });

  it("handles escalation request from any gate", () => {
    processInput("test-call-1", "", DEFAULT_HVAC_CONFIG); // greeting
    const result = processInput("test-call-1", "I want to speak to the owner", DEFAULT_HVAC_CONFIG);
    expect(result.session.gate).toBe(GATES.CALLBACK);
    expect(result.session.disposition).toBe("callback");
    expect(result.action.type).toBe("gather");
  });

  it("handles emergency for HVAC with emergency_service=true", () => {
    processInput("test-call-1", "", DEFAULT_HVAC_CONFIG); // greeting
    const result = processInput("test-call-1", "This is an emergency, it's urgent!", DEFAULT_HVAC_CONFIG);
    expect(result.session.gate).toBe(GATES.CAPTURE);
    expect(result.session.disposition).toBe("emergency");
  });

  it("handles emergency for mechanic with emergency_service=false", () => {
    processInput("test-call-2", "", DEFAULT_MECHANIC_CONFIG); // greeting
    const result = processInput("test-call-2", "This is an emergency", DEFAULT_MECHANIC_CONFIG);
    expect(result.session.gate).toBe(GATES.END);
    expect(result.action.type).toBe("hangup");
  });

  it("provides price info when asked", () => {
    processInput("test-call-1", "", DEFAULT_HVAC_CONFIG); // greeting
    const result = processInput("test-call-1", "How much does AC repair cost?", DEFAULT_HVAC_CONFIG);
    expect(result.action.text).toContain("$");
    expect(result.action.type).toBe("gather");
  });

  it("provides hours when asked", () => {
    processInput("test-call-1", "", DEFAULT_HVAC_CONFIG); // greeting
    const result = processInput("test-call-1", "What are your hours?", DEFAULT_HVAC_CONFIG);
    expect(result.action.text).toContain("Monday");
    expect(result.action.type).toBe("gather");
  });

  it("completes a full booking flow", () => {
    // Greeting
    processInput("test-call-1", "", DEFAULT_HVAC_CONFIG);
    // Triage — describe issue
    processInput("test-call-1", "My AC is not cooling at all", DEFAULT_HVAC_CONFIG);
    // Triage question 1 answer
    processInput("test-call-1", "It stopped completely", DEFAULT_HVAC_CONFIG);
    // Triage question 2 answer → moves to logistics
    processInput("test-call-1", "Yesterday afternoon", DEFAULT_HVAC_CONFIG);
    // Logistics — give address → moves to offer
    processInput("test-call-1", "123 Main Street", DEFAULT_HVAC_CONFIG);
    // Offer — pick first slot → moves to capture
    processInput("test-call-1", "yes the first one", DEFAULT_HVAC_CONFIG);
    // Capture — give name
    processInput("test-call-1", "John Smith", DEFAULT_HVAC_CONFIG);
    // Capture — give phone → confirmed
    const result = processInput("test-call-1", "8285550142", DEFAULT_HVAC_CONFIG);

    expect(result.session.disposition).toBe("booked");
    expect(result.session.customer_name).toBe("John Smith");
    expect(result.session.customer_phone).toBe("+18285550142");
    expect(result.session.gate).toBe(GATES.END);
    expect(result.done).toBe(true);
    expect(result.action.type).toBe("hangup");
    expect(result.action.text).toContain("John Smith");
  });

  it("captures a lead when caller declines booking", () => {
    processInput("test-call-1", "", DEFAULT_HVAC_CONFIG); // greeting
    processInput("test-call-1", "My heater is broken", DEFAULT_HVAC_CONFIG); // triage
    processInput("test-call-1", "No heat at all", DEFAULT_HVAC_CONFIG); // triage q1
    processInput("test-call-1", "Gas furnace", DEFAULT_HVAC_CONFIG); // triage q2 → logistics
    processInput("test-call-1", "204 Oak Ave", DEFAULT_HVAC_CONFIG); // logistics → offer
    processInput("test-call-1", "not now", DEFAULT_HVAC_CONFIG); // decline slot → lead
    processInput("test-call-1", "Sarah Jones", DEFAULT_HVAC_CONFIG); // name

    const result = processInput("test-call-1", "8285559999", DEFAULT_HVAC_CONFIG);
    expect(result.session.disposition).toBe("lead");
    expect(result.session.customer_name).toBe("Sarah Jones");
    expect(result.session.customer_phone).toBe("+18285559999");
    expect(result.done).toBe(true);
  });

  it("endSession cleans up and returns the session", () => {
    processInput("test-call-1", "", DEFAULT_HVAC_CONFIG);
    const session = endSession("test-call-1");
    expect(session).toBeTruthy();
    expect(session.callSid).toBe("test-call-1");
    expect(getSession("test-call-1")).toBeUndefined();
  });
});

// ── TwiML Builder ───────────────────────────────────────────────

describe("TwiML builder", () => {
  it("builds a Gather TwiML for gather actions", () => {
    const xml = buildTwiML(
      { type: "gather", text: "How can I help?", hints: "repair, price" },
      "https://example.com",
      "CA123"
    );
    expect(xml).toContain("<Response>");
    expect(xml).toContain("<Gather");
    expect(xml).toContain("input=\"speech\"");
    expect(xml).toContain("How can I help?");
    expect(xml).toContain("<Say");
    expect(xml).toContain("Polly.Joanna");
    expect(xml).toContain("repair, price");
  });

  it("builds a Hangup TwiML for hangup actions", () => {
    const xml = buildTwiML(
      { type: "hangup", text: "Goodbye!" },
      "https://example.com",
      "CA123"
    );
    expect(xml).toContain("<Hangup/>");
    expect(xml).toContain("Goodbye!");
  });

  it("builds a Conference TwiML for conference actions", () => {
    const xml = buildTwiML(
      { type: "conference", room: "room-123" },
      "https://example.com",
      "CA123"
    );
    expect(xml).toContain("<Conference");
    expect(xml).toContain("room-123");
  });

  it("escapes XML special characters", () => {
    expect(escapeXml('Hello & "World" <test>')).toBe("Hello &amp; &quot;World&quot; &lt;test&gt;");
  });

  it("builds fallback TwiML for unknown action types", () => {
    const xml = buildTwiML({ type: "unknown" }, "https://example.com", "CA123");
    expect(xml).toContain("<Hangup/>");
    expect(xml).toContain("<Pause");
  });
});

// ── Business Configs ────────────────────────────────────────────

describe("Business configs", () => {
  it("HVAC config has required fields", () => {
    expect(DEFAULT_HVAC_CONFIG.business_type).toBe("hvac");
    expect(DEFAULT_HVAC_CONFIG.name).toBeTruthy();
    expect(DEFAULT_HVAC_CONFIG.services.length).toBeGreaterThan(0);
    expect(DEFAULT_HVAC_CONFIG.triage_questions).toBeTruthy();
    expect(DEFAULT_HVAC_CONFIG.available_slots.length).toBeGreaterThan(0);
    expect(DEFAULT_HVAC_CONFIG.sms_templates).toBeTruthy();
    expect(DEFAULT_HVAC_CONFIG.emergency_service).toBe(true);
  });

  it("Mechanic config has required fields", () => {
    expect(DEFAULT_MECHANIC_CONFIG.business_type).toBe("mechanic");
    expect(DEFAULT_MECHANIC_CONFIG.name).toBeTruthy();
    expect(DEFAULT_MECHANIC_CONFIG.services.length).toBeGreaterThan(0);
    expect(DEFAULT_MECHANIC_CONFIG.walk_ins).toBe(true);
  });
});

// ── Ava Voice Routes ────────────────────────────────────────────

describe("Ava voice routes", () => {
  it("POST /ava/voice/inbound returns TwiML greeting", async () => {
    const res = await request(app)
      .post("/ava/voice/inbound")
      .type("form")
      .send({ CallSid: "CAxyz123", From: "+18285550142", To: "+18285550100" });

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/xml/);
    expect(res.text).toContain("<Response>");
    expect(res.text).toContain("<Gather");
    expect(res.text).toContain("Ava");
  });

  it("POST /ava/voice/input returns next TwiML turn", async () => {
    // Start a session first
    await request(app)
      .post("/ava/voice/inbound")
      .type("form")
      .send({ CallSid: "CAxyz456", From: "+18285550142", To: "+18285550100" });

    const res = await request(app)
      .post("/ava/voice/input")
      .type("form")
      .send({ CallSid: "CAxyz456", SpeechResult: "My AC is broken", From: "+18285550142", To: "+18285550100" });

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/xml/);
    expect(res.text).toContain("<Response>");
  });

  it("POST /ava/voice/fallback returns re-prompt TwiML", async () => {
    const res = await request(app)
      .post("/ava/voice/fallback")
      .type("form")
      .send({ CallSid: "CAxyz789" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("<Gather");
    expect(res.text).toContain("didn't catch that");
  });

  it("POST /ava/voice/status returns 200", async () => {
    const res = await request(app)
      .post("/ava/voice/status")
      .type("form")
      .send({ CallSid: "CAxyz123", CallStatus: "completed", CallDuration: "120" });

    expect(res.status).toBe(200);
  });
});

// ── Ava API Routes ──────────────────────────────────────────────

describe("Ava API routes", () => {
  it("GET /ava/api/health returns ok", async () => {
    const res = await request(app).get("/ava/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /ava/api/stats returns 400 without businessId", async () => {
    const res = await request(app).get("/ava/api/stats");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("businessId");
  });

  it("GET /ava/api/calls returns 400 without businessId", async () => {
    const res = await request(app).get("/ava/api/calls");
    expect(res.status).toBe(400);
  });

  it("GET /ava/api/jobs returns 400 without businessId", async () => {
    const res = await request(app).get("/ava/api/jobs");
    expect(res.status).toBe(400);
  });

  it("GET /ava/api/appointments returns 400 without businessId", async () => {
    const res = await request(app).get("/ava/api/appointments");
    expect(res.status).toBe(400);
  });

  it("POST /ava/api/appointments returns 400 without required fields", async () => {
    const res = await request(app)
      .post("/ava/api/appointments")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("required");
  });

  it("POST /ava/api/calls/:callSid/sms returns 400 without required fields", async () => {
    const res = await request(app)
      .post("/ava/api/calls/CAxyz123/sms")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("required");
  });
});
