require("dotenv").config({ path: __dirname + "/../.env" });

const nodeEnv = process.env.NODE_ENV || "development";
const baseUrl = process.env.BASE_URL || "http://localhost:3000";
let baseOrigin = "";
try {
  baseOrigin = new URL(baseUrl).origin;
} catch {}

const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (!corsOrigins.length && baseOrigin) {
  corsOrigins.push(baseOrigin);
}

const cfg = {
  port: parseInt(process.env.PORT, 10) || 3000,
  baseUrl,
  baseOrigin,
  nodeEnv,
  corsOrigins,

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

  // Dashboard auth
  dashboardJwtSecret: process.env.DASHBOARD_JWT_SECRET || "",
  dashboardJwtTtl: process.env.DASHBOARD_JWT_TTL || "12h",
  dashboardUser: process.env.DASHBOARD_USER || "",
  dashboardPassword: process.env.DASHBOARD_PASSWORD || "",
  dashboardAuthRequired:
    process.env.DASHBOARD_AUTH_REQUIRED === "true" || nodeEnv === "production",
  authCookieName: process.env.DASHBOARD_AUTH_COOKIE || "cg_auth",

  // Request limits
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || "200kb",
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60_000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 120,
};

module.exports = cfg;
