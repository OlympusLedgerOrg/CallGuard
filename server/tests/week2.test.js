/**
 * Week 2 tests – STT + dialogue engine + TTS round trip.
 */

const request = require("supertest");
const { createApp } = require("../src/index");
const dialogue = require("../src/services/dialogue");

let app;
beforeAll(() => {
  app = createApp();
});

describe("Dialogue engine", () => {
  afterEach(() => dialogue.endSession("test-sid"));

  it("classifies greeting intent", () => {
    const result = dialogue.classifyIntent("hello there");
    expect(result.intent).toBe("greeting");
    expect(result.response).toContain("CallGuard");
  });

  it("classifies booking intent", () => {
    const result = dialogue.classifyIntent("I'd like to book an appointment");
    expect(result.intent).toBe("booking");
  });

  it("classifies hours intent", () => {
    const result = dialogue.classifyIntent("what are your hours?");
    expect(result.intent).toBe("hours");
  });

  it("classifies services intent", () => {
    const result = dialogue.classifyIntent("what services do you offer?");
    expect(result.intent).toBe("services");
  });

  it("classifies cancel intent", () => {
    const result = dialogue.classifyIntent("I need to cancel my appointment");
    expect(result.intent).toBe("cancel");
  });

  it("classifies emergency intent", () => {
    const result = dialogue.classifyIntent("this is an emergency");
    expect(result.intent).toBe("emergency");
  });

  it("classifies thanks/goodbye intent", () => {
    const result = dialogue.classifyIntent("thank you, goodbye");
    expect(result.intent).toBe("thanks");
  });

  it("falls back on unknown input", () => {
    const result = dialogue.classifyIntent("xyzzy foobarbaz");
    expect(result.intent).toBe("fallback");
  });

  it("maintains session history", () => {
    const r1 = dialogue.getReply("test-sid", "hello");
    expect(r1.turnCount).toBe(1);
    const r2 = dialogue.getReply("test-sid", "what services?");
    expect(r2.turnCount).toBe(2);

    const session = dialogue.getSession("test-sid");
    expect(session.length).toBe(4); // 2 turns × 2 entries each
  });

  it("endSession clears history", () => {
    dialogue.getReply("test-sid", "hi");
    dialogue.endSession("test-sid");
    expect(dialogue.getSession("test-sid")).toEqual([]);
  });
});

describe("POST /voice/respond", () => {
  it("returns TwiML with dialogue response for greeting", async () => {
    const res = await request(app)
      .post("/voice/respond")
      .type("form")
      .send({ CallSid: "CA-voice-1", SpeechResult: "hello" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/xml/);
    expect(res.text).toContain("<Response>");
    expect(res.text).toContain("<Say");
    expect(res.text).toContain("<Gather");
    expect(res.text).toContain("CallGuard");
  });

  it("hangs up on goodbye intent", async () => {
    const res = await request(app)
      .post("/voice/respond")
      .type("form")
      .send({ CallSid: "CA-voice-2", SpeechResult: "thank you bye" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("<Hangup");
  });

  it("redirects to booking on booking intent", async () => {
    const res = await request(app)
      .post("/voice/respond")
      .type("form")
      .send({ CallSid: "CA-voice-3", SpeechResult: "I want to book" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("<Redirect");
    expect(res.text).toContain("/booking/start");
  });
});
