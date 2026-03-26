# CallGuard

AI-powered voice receptionist for local service businesses — built on Twilio, OpenAI, and PostgreSQL.

## Overview

CallGuard handles inbound calls for local service businesses (plumbers, electricians, HVAC, etc.), qualifies leads, books appointments, and sends SMS summaries to the business owner — all automatically.

## Architecture

```
 Caller ──► Twilio ──► /twilio/voice  (Week 1: webhook + TwiML)
                           │
                    ┌──────┴──────┐
                    ▼              ▼
              /voice/respond   /booking/*   (Week 2: STT→dialogue→TTS)
              (dialogue engine) (calendar)  (Week 3: booking + Calendar + SMS)
                    │              │
                    └──────┬──────┘
                           ▼
               /api/dashboard/*  ◄── Owner app
               WebSocket /ws     ◄── Live call stream  (Week 4)
```

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

### Server (Twilio + API)

```bash
cd server
cp .env.example .env   # fill in your Twilio & Google creds
npm install
npm start              # http://localhost:3000
```

Expose the server with ngrok and point your Twilio number's voice webhook at `https://<ngrok>.ngrok.io/twilio/voice`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/twilio/voice` | Twilio incoming-call webhook (TwiML) |
| POST | `/twilio/status` | Twilio call-status callback |
| POST | `/voice/respond` | STT → dialogue engine → TTS reply |
| POST | `/booking/start` | Voice booking: ask for service |
| POST | `/booking/collect-date` | Voice booking: ask for date |
| POST | `/booking/collect-time` | Voice booking: ask for time |
| POST | `/booking/confirm` | Voice booking: confirm + Calendar + SMS |
| GET | `/booking/availability?date=YYYY-MM-DD` | Available time slots |
| POST | `/booking/create` | REST: create a booking |
| GET | `/api/dashboard/stats` | Dashboard stats |
| GET | `/api/dashboard/calls/active` | Active calls |
| GET | `/api/dashboard/calls/log` | Recent call log |
| POST | `/api/dashboard/sms` | Send SMS from dashboard |
| WS | `/ws` | Real-time call events |

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

## Tests

```bash
cd server
npm test
```

## Development Scripts

| Command | Description |
|---|---|
| `npm run db:migrate` | Run migrations in production |
| `npm run db:migrate:dev` | Run migrations in development (creates new migration if schema changed) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:studio` | Open Prisma Studio (visual database browser) |
| `npm run db:reset` | Drop and recreate the database (dev only) |

## Milestones

- [x] **Week 1** – Twilio webhook + basic TwiML response
- [x] **Week 2** – STT + dialogue engine + TTS round trip
- [x] **Week 3** – Booking flow + Google Calendar + SMS confirmation
- [x] **Week 4** – Owner dashboard API + WebSocket for live calls
