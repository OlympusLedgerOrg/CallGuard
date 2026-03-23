# CallGuard

AI-powered voice receptionist for local service businesses — built on Twilio, OpenAI, and PostgreSQL.

## Overview

CallGuard handles inbound calls for local service businesses (plumbers, electricians, HVAC, etc.), qualifies leads, books appointments, and sends SMS summaries to the business owner — all automatically.

## Database Schema

The database is designed around 7 core tables:

| Table | Purpose |
|---|---|
| `businesses` | Business owner accounts and configuration |
| `twilio_numbers` | Twilio phone numbers linked to businesses |
| `calls` | One row per inbound call (core call log) |
| `transcripts` | Full conversation transcripts (separated for scale) |
| `appointments` | Booked appointments (synced with Google Calendar) |
| `oauth_tokens` | Google OAuth tokens for calendar access |
| `sms_logs` | Audit log for SMS notifications to owners |

## Tech Stack

- **Runtime**: Node.js
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: PostgreSQL (Supabase / Neon / self-hosted)
- **Voice**: Twilio + OpenAI Realtime API
- **Calendar**: Google Calendar API

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL instance (local, [Supabase](https://supabase.com/), or [Neon](https://neon.tech/))

### Setup

1. **Clone and install dependencies**

   ```bash
   git clone https://github.com/wombatvagina69-crypto/CallGuard.git
   cd CallGuard
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env and set DATABASE_URL to your PostgreSQL connection string
   ```

3. **Run database migrations**

   ```bash
   npm run db:migrate
   ```

4. **Generate Prisma client**

   ```bash
   npm run db:generate
   ```

5. **Explore data (optional)**

   ```bash
   npm run db:studio
   ```

## Data Flow

1. **Onboard a business** → insert into `businesses`
2. **Assign a Twilio number** → insert into `twilio_numbers`
3. **On every call**:
   - Create a `calls` record when the call starts (using Twilio `CallSid`)
   - Update it with `outcome`, `appointment_id`, etc. after the call
   - Insert into `transcripts` if storing conversation
   - If an appointment is booked, create an `appointments` record and link to the call
4. **Google Calendar integration**:
   - Use `oauth_tokens` to get a fresh access token
   - On successful event creation, store the `google_event_id`
5. **SMS summaries** → log in `sms_logs` for audit

## Development Scripts

| Command | Description |
|---|---|
| `npm run db:migrate` | Run migrations in production |
| `npm run db:migrate:dev` | Run migrations in development (creates new migration if schema changed) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:studio` | Open Prisma Studio (visual database browser) |
| `npm run db:reset` | Drop and recreate the database (dev only) |
