/**
 * Week 1 tests – Twilio webhook + basic TwiML response.
 */

const request = require("supertest");
const { createApp } = require("../src/index");

let app;
beforeAll(() => {
  app = createApp();
});

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("POST /twilio/voice", () => {
  it("returns valid TwiML with Gather and Say", async () => {
    const res = await request(app)
      .post("/twilio/voice")
      .type("form")
      .send({ CallSid: "CA123", From: "+15551234567", To: "+15559876543" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/xml/);
    expect(res.text).toContain("<Response>");
    expect(res.text).toContain("<Gather");
    expect(res.text).toContain("<Say");
    expect(res.text).toContain("Thanks for calling CallGuard");
  });

  it("includes speech input type in Gather", async () => {
    const res = await request(app)
      .post("/twilio/voice")
      .type("form")
      .send({ CallSid: "CA456" });

    expect(res.text).toContain('input="speech"');
  });
});

describe("POST /twilio/status", () => {
  it("returns 204 on status callback", async () => {
    const res = await request(app)
      .post("/twilio/status")
      .type("form")
      .send({ CallSid: "CA789", CallStatus: "completed" });

    expect(res.status).toBe(204);
  });
});
