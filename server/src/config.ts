import path from "path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../.env") });

interface Config {
  port: number;
  baseUrl: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  googleClientEmail: string;
  googlePrivateKey: string;
  googleCalendarId: string;
  openaiApiKey: string;
}

const parsedPort = Number.parseInt(process.env.PORT ?? "", 10);

const cfg: Config = {
  port: Number.isNaN(parsedPort) ? 3000 : parsedPort,
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

export = cfg;
