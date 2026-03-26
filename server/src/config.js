require("dotenv").config({ path: __dirname + "/../.env" });

const cfg = {
  port: parseInt(process.env.PORT, 10) || 3000,
  baseUrl: process.env.BASE_URL || "http://localhost:3000",

  // Twilio
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "",

  // Google Calendar
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL || "",
  googlePrivateKey: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID || "primary",

  // OpenAI (for dialogue engine)
  openaiApiKey: process.env.OPENAI_API_KEY || "",
};

module.exports = cfg;
