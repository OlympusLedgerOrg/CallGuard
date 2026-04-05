-- CreateTable
CREATE TABLE "call_analytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "call_id" TEXT NOT NULL,
    "detected_intents" TEXT NOT NULL DEFAULT '[]',
    "missed_phrases" TEXT NOT NULL DEFAULT '[]',
    "avg_response_ms" INTEGER,
    "first_response_ms" INTEGER,
    "total_turns" INTEGER NOT NULL DEFAULT 0,
    "turns_to_booking" INTEGER,
    "gate_progression" TEXT NOT NULL DEFAULT '[]',
    "final_gate" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "call_analytics_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "active_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "call_sid" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "session_data" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_calls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "twilio_call_sid" TEXT NOT NULL,
    "caller_number" TEXT NOT NULL,
    "caller_name" TEXT,
    "zip_code" TEXT,
    "service_type" TEXT,
    "urgency" TEXT,
    "outcome" TEXT,
    "appointment_id" TEXT,
    "duration_seconds" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disposition" TEXT,
    "ai_handled" BOOLEAN NOT NULL DEFAULT false,
    "job_request_id" TEXT,
    "fallback_count" INTEGER NOT NULL DEFAULT 0,
    "missed_intent_count" INTEGER NOT NULL DEFAULT 0,
    "turn_count" INTEGER NOT NULL DEFAULT 0,
    "vibevoice_used" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "calls_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "calls_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_calls" ("ai_handled", "appointment_id", "business_id", "caller_name", "caller_number", "created_at", "disposition", "duration_seconds", "id", "job_request_id", "outcome", "service_type", "twilio_call_sid", "urgency", "zip_code") SELECT "ai_handled", "appointment_id", "business_id", "caller_name", "caller_number", "created_at", "disposition", "duration_seconds", "id", "job_request_id", "outcome", "service_type", "twilio_call_sid", "urgency", "zip_code" FROM "calls";
DROP TABLE "calls";
ALTER TABLE "new_calls" RENAME TO "calls";
CREATE UNIQUE INDEX "calls_twilio_call_sid_key" ON "calls"("twilio_call_sid");
CREATE INDEX "calls_business_id_idx" ON "calls"("business_id");
CREATE INDEX "calls_created_at_idx" ON "calls"("created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "call_analytics_call_id_key" ON "call_analytics"("call_id");

-- CreateIndex
CREATE UNIQUE INDEX "active_sessions_call_sid_key" ON "active_sessions"("call_sid");

-- CreateIndex
CREATE INDEX "active_sessions_expires_at_idx" ON "active_sessions"("expires_at");
