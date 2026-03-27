-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "service_area" TEXT NOT NULL DEFAULT '[]',
    "service_categories" TEXT NOT NULL DEFAULT '[]',
    "hours_of_operation" TEXT,
    "emergency_rate" INTEGER,
    "emergency_hours" TEXT,
    "system_prompt" TEXT,
    "voice" TEXT NOT NULL DEFAULT 'alloy',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "twilio_numbers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "twilio_numbers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "calls" (
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
    CONSTRAINT "calls_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "calls_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "call_id" TEXT NOT NULL,
    "raw_text" TEXT,
    "segments" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transcripts_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "call_id" TEXT,
    "google_event_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "scheduled_for" DATETIME NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appointments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "oauth_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expiry" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_tokens_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "call_id" TEXT,
    "recipient" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT,
    "twilio_sid" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sms_logs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sms_logs_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "businesses_email_key" ON "businesses"("email");

-- CreateIndex
CREATE UNIQUE INDEX "twilio_numbers_phone_number_key" ON "twilio_numbers"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "twilio_numbers_sid_key" ON "twilio_numbers"("sid");

-- CreateIndex
CREATE INDEX "twilio_numbers_business_id_idx" ON "twilio_numbers"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "calls_twilio_call_sid_key" ON "calls"("twilio_call_sid");

-- CreateIndex
CREATE INDEX "calls_business_id_idx" ON "calls"("business_id");

-- CreateIndex
CREATE INDEX "calls_created_at_idx" ON "calls"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_call_id_key" ON "transcripts"("call_id");

-- CreateIndex
CREATE INDEX "appointments_business_id_idx" ON "appointments"("business_id");

-- CreateIndex
CREATE INDEX "appointments_scheduled_for_idx" ON "appointments"("scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_tokens_business_id_provider_key" ON "oauth_tokens"("business_id", "provider");

-- CreateIndex
CREATE INDEX "sms_logs_business_id_idx" ON "sms_logs"("business_id");

-- Add missing columns to calls
ALTER TABLE "calls" ADD COLUMN "disposition"     TEXT;
ALTER TABLE "calls" ADD COLUMN "ai_handled"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "calls" ADD COLUMN "job_request_id"  TEXT;

-- CreateTable: job_requests
CREATE TABLE "job_requests" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "business_id"    TEXT NOT NULL,
    "call_id"        TEXT,
    "issue"          TEXT,
    "address"        TEXT,
    "urgency"        TEXT NOT NULL DEFAULT 'normal',
    "disposition"    TEXT NOT NULL DEFAULT 'lead',
    "status"         TEXT NOT NULL DEFAULT 'new',
    "customer_name"  TEXT,
    "customer_phone" TEXT,
    "created_at"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_requests_business_id_fkey"
      FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "job_requests_business_id_idx" ON "job_requests"("business_id");
CREATE INDEX "job_requests_status_idx"      ON "job_requests"("status");

-- CreateTable: callback_requests
CREATE TABLE "callback_requests" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "business_id"  TEXT NOT NULL,
    "call_id"      TEXT,
    "caller_name"  TEXT,
    "caller_phone" TEXT NOT NULL,
    "reason"       TEXT,
    "urgency"      TEXT NOT NULL DEFAULT 'normal',
    "status"       TEXT NOT NULL DEFAULT 'pending',
    "notes"        TEXT,
    "created_at"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "callback_requests_business_id_fkey"
      FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "callback_requests_business_id_idx" ON "callback_requests"("business_id");
CREATE INDEX "callback_requests_status_idx"      ON "callback_requests"("status");
