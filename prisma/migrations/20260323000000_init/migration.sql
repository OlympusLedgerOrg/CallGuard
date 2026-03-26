-- CreateTable: businesses
CREATE TABLE "businesses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "service_area" TEXT[],
    "service_categories" TEXT[],
    "hours_of_operation" JSONB,
    "emergency_rate" INTEGER,
    "emergency_hours" JSONB,
    "system_prompt" TEXT,
    "voice" VARCHAR(20) NOT NULL DEFAULT 'alloy',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: twilio_numbers
CREATE TABLE "twilio_numbers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "phone_number" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "twilio_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: calls
CREATE TABLE "calls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "twilio_call_sid" TEXT NOT NULL,
    "caller_number" TEXT NOT NULL,
    "caller_name" TEXT,
    "zip_code" TEXT,
    "service_type" TEXT,
    "urgency" TEXT,
    "outcome" TEXT,
    "appointment_id" UUID,
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable: transcripts
CREATE TABLE "transcripts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "call_id" UUID NOT NULL,
    "raw_text" TEXT,
    "segments" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: appointments
CREATE TABLE "appointments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "call_id" UUID,
    "google_event_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "scheduled_for" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: oauth_tokens
CREATE TABLE "oauth_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expiry" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sms_logs
CREATE TABLE "sms_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "call_id" UUID,
    "recipient" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT,
    "twilio_sid" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "businesses_email_key" ON "businesses"("email");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "twilio_numbers_phone_number_key" ON "twilio_numbers"("phone_number");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "twilio_numbers_sid_key" ON "twilio_numbers"("sid");

-- CreateIndex: twilio_numbers.business_id
CREATE INDEX "twilio_numbers_business_id_idx" ON "twilio_numbers"("business_id");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "calls_twilio_call_sid_key" ON "calls"("twilio_call_sid");

-- CreateIndex: calls.business_id
CREATE INDEX "calls_business_id_idx" ON "calls"("business_id");

-- CreateIndex: calls.created_at
CREATE INDEX "calls_created_at_idx" ON "calls"("created_at");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "transcripts_call_id_key" ON "transcripts"("call_id");

-- CreateIndex: appointments.business_id
CREATE INDEX "appointments_business_id_idx" ON "appointments"("business_id");

-- CreateIndex: appointments.scheduled_for
CREATE INDEX "appointments_scheduled_for_idx" ON "appointments"("scheduled_for");

-- CreateUniqueIndex: oauth_tokens (business_id, provider)
CREATE UNIQUE INDEX "oauth_tokens_business_id_provider_key" ON "oauth_tokens"("business_id", "provider");

-- CreateIndex: sms_logs.business_id
CREATE INDEX "sms_logs_business_id_idx" ON "sms_logs"("business_id");

-- AddForeignKey: twilio_numbers.business_id → businesses.id
ALTER TABLE "twilio_numbers" ADD CONSTRAINT "twilio_numbers_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: calls.business_id → businesses.id
ALTER TABLE "calls" ADD CONSTRAINT "calls_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: calls.appointment_id → appointments.id
ALTER TABLE "calls" ADD CONSTRAINT "calls_appointment_id_fkey"
    FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: transcripts.call_id → calls.id
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_call_id_fkey"
    FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: appointments.business_id → businesses.id
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: oauth_tokens.business_id → businesses.id
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: sms_logs.business_id → businesses.id
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: sms_logs.call_id → calls.id
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_call_id_fkey"
    FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
