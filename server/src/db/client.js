// src/db/client.js
// Prisma client singleton with compatibility aliases.
// The Ava engine code uses snake_case model names (db.businesses, db.calls, etc.)
// while the existing Prisma schema may use PascalCase model names.
// This module provides both access patterns.

const path = require("path");

let db;

// Default SQLite database URL (file in repo root data/ dir)
const defaultDbUrl = "file:" + path.resolve(__dirname, "../../../data/callguard.db");

try {
  // Try the custom output path used by prisma.config.ts first
  const { PrismaClient } = require("../../../generated/prisma");
  db = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL || defaultDbUrl,
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });
} catch {
  try {
    // Fallback to default @prisma/client
    const { PrismaClient } = require("@prisma/client");
    db = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL || defaultDbUrl,
      log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
    });
  } catch {
    // Stub — DB queries will return null/empty until Prisma is set up
    console.warn("[DB] Prisma client not available — running without database");
    const handler = {
      get: (_, prop) => {
        if (prop === "$connect" || prop === "$disconnect") return async () => {};
        if (prop === "then") return undefined; // prevent Promise-like behavior
        return new Proxy({}, {
          get: () => async () => null,
        });
      },
    };
    db = new Proxy({}, handler);
  }
}

// Compatibility: the Ava engine uses snake_case (db.businesses, db.calls, etc.)
// If the Prisma client uses PascalCase names, alias them here.
if (db && !db.businesses && db.business)    db.businesses    = db.business;
if (db && !db.calls && db.call)             db.calls         = db.call;
if (db && !db.transcripts && db.transcript) db.transcripts   = db.transcript;
if (db && !db.appointments && db.appointment) db.appointments = db.appointment;
if (db && !db.job_requests && db.jobRequest) db.job_requests  = db.jobRequest;
if (db && !db.twilio_numbers && db.twilioNumber) db.twilio_numbers = db.twilioNumber;
if (db && !db.oauth_tokens && db.oauthToken) db.oauth_tokens  = db.oauthToken;
if (db && !db.sms_logs && db.smsLog)        db.sms_logs      = db.smsLog;

module.exports = db;
