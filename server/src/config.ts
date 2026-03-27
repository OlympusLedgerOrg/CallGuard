import path from "path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../.env") });

interface Config {
  port: number;
  baseUrl: string;
  baseOrigin: string;
  nodeEnv: string;
  corsOrigins: string[];
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  googleClientEmail: string;
  googlePrivateKey: string;
  googleCalendarId: string;
  openaiApiKey: string;
  dashboardJwtSecret: string;
  dashboardJwtTtl: string;
  dashboardUser: string;
  dashboardPassword: string;
  dashboardPasswordSalt: string;
  dashboardAuthRequired: boolean;
  authCookieName: string;
  requestBodyLimit: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

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

const parsedPort = Number.parseInt(process.env.PORT ?? "", 10);

const cfg: Config = {
  port: Number.isNaN(parsedPort) ? 3000 : parsedPort,
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
  dashboardPasswordSalt: process.env.DASHBOARD_PASSWORD_SALT || "",
  dashboardAuthRequired:
    process.env.DASHBOARD_AUTH_REQUIRED === "true" || nodeEnv === "production",
  authCookieName: process.env.DASHBOARD_AUTH_COOKIE || "cg_auth",

  // Request limits
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || "200kb",
  rateLimitWindowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "", 10) || 60_000,
  rateLimitMax: Number.parseInt(process.env.RATE_LIMIT_MAX ?? "", 10) || 120,
};

export = cfg;
