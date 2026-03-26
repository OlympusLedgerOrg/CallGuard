/**
 * Week 3 tests – Booking flow + Google Calendar + SMS confirmation.
 */

const request = require("supertest");
const { createApp } = require("../src/index");

let app;
beforeAll(() => {
  app = createApp();
});

describe("Voice booking flow", () => {
  it("POST /booking/start returns TwiML asking for service", async () => {
    const res = await request(app)
      .post("/booking/start")
      .type("form")
      .send({ CallSid: "CA-book-1" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("<Gather");
    expect(res.text).toContain("book an appointment");
  });

  it("POST /booking/collect-date captures service and asks for date", async () => {
    const res = await request(app)
      .post("/booking/collect-date")
      .type("form")
      .send({ CallSid: "CA-book-1", SpeechResult: "dental cleaning" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("dental cleaning");
    expect(res.text).toContain("date");
  });

  it("POST /booking/collect-time captures date and asks for time", async () => {
    const res = await request(app)
      .post("/booking/collect-time")
      .type("form")
      .send({ CallSid: "CA-book-1", SpeechResult: "next Monday" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("next Monday");
    expect(res.text).toContain("time");
  });

  it("POST /booking/confirm confirms booking with TwiML", async () => {
    // First start a session
    await request(app)
      .post("/booking/start")
      .type("form")
      .send({ CallSid: "CA-book-2" });

    await request(app)
      .post("/booking/collect-date")
      .type("form")
      .send({ CallSid: "CA-book-2", SpeechResult: "checkup" });

    await request(app)
      .post("/booking/collect-time")
      .type("form")
      .send({ CallSid: "CA-book-2", SpeechResult: "Tuesday" });

    const res = await request(app)
      .post("/booking/confirm")
      .type("form")
      .send({ CallSid: "CA-book-2", SpeechResult: "10 AM", From: "+15551234567" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("booked");
    expect(res.text).toContain("<Hangup");
  });
});

describe("REST booking API", () => {
  it("GET /booking/availability returns 400 without date", async () => {
    const res = await request(app).get("/booking/availability");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("date");
  });

  it("POST /booking/create returns 400 with missing fields", async () => {
    const res = await request(app)
      .post("/booking/create")
      .send({ service: "cleaning" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required fields");
  });
});
