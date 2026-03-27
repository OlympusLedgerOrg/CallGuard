# CallGuard

AI-powered voice receptionist for local service businesses — built on Twilio, Ava (local dialogue engine), and SQLite.

**No external database needed.** Everything runs in the app.

## Quick Start

### Option A: Automated Setup (recommended)

```bash
git clone https://github.com/wombatvagina69-crypto/CallGuard.git
cd CallGuard
./setup.sh
```

The setup script installs all dependencies, creates the SQLite database, runs migrations, and generates the Prisma client automatically. After setup, add your API keys and start the server:

```bash
# Edit server/.env with your Twilio / Google Calendar keys
npm start              # → http://localhost:3000
```

### Option B: Docker

```bash
git clone https://github.com/wombatvagina69-crypto/CallGuard.git
cd CallGuard
cp server/.env.example server/.env   # add your Twilio / Google / OpenAI keys
docker compose up                    # → http://localhost:3000
```

Docker Compose starts the CallGuard server with a built-in SQLite database. No external database install needed.

### Option C: Manual Setup

```bash
git clone https://github.com/wombatvagina69-crypto/CallGuard.git
cd CallGuard
npm install                          # root deps (Prisma)
npm run db:migrate                   # create SQLite tables (data/callguard.db)
npm run db:generate                  # generate Prisma client
cd server
npm install                          # server deps
cp .env.example .env                 # add API keys
npm start                            # → http://localhost:3000
```

### Environment Variables

| File | Variable | Description |
|------|----------|-------------|
| `server/.env` | `NODE_ENV` | `development` or `production` |
| `server/.env` | `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `server/.env` | `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `server/.env` | `TWILIO_PHONE_NUMBER` | Your Twilio phone number |
| `server/.env` | `GOOGLE_CLIENT_EMAIL` | Google service account email |
| `server/.env` | `GOOGLE_PRIVATE_KEY` | Google service account private key |
| `server/.env` | `GOOGLE_CALENDAR_ID` | Google Calendar ID (default: `primary`) |
| `server/.env` | `OPENAI_API_KEY` | OpenAI API key (optional) |
| `server/.env` | `PORT` | Server port (default: `3000`) |
| `server/.env` | `BASE_URL` | Public URL for Twilio webhooks (e.g. ngrok) |
| `server/.env` | `OWNER_PHONE` | Phone number for missed-call / job-alert SMS |
| `server/.env` | `DASHBOARD_JWT_SECRET` | JWT signing key for dashboard/API auth |
| `server/.env` | `DASHBOARD_JWT_TTL` | JWT expiry window (default: `12h`) |
| `server/.env` | `DASHBOARD_USER` | Dashboard login username |
| `server/.env` | `DASHBOARD_PASSWORD` | Dashboard login password |
| `server/.env` | `DASHBOARD_PASSWORD_SALT` | Random salt for dashboard credential hashing |
| `server/.env` | `DASHBOARD_AUTH_REQUIRED` | Enforce auth even if secret missing (`true`/`false`) |
| `server/.env` | `CORS_ORIGINS` | Comma-separated allowed origins for API access |
| `server/.env` | `REQUEST_BODY_LIMIT` | Request body size limit (default: `200kb`) |
| `server/.env` | `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms (default: `60000`) |
| `server/.env` | `RATE_LIMIT_MAX` | Max requests per window (default: `120`) |

> **Dashboard auth:** Set `DASHBOARD_JWT_SECRET`, `DASHBOARD_USER`, and `DASHBOARD_PASSWORD` in `server/.env`. The dashboard will prompt for login and issue a JWT cookie + token for API calls.

### Security & Ops Notes

- **Twilio webhook validation:** Webhook routes validate `X-Twilio-Signature` when `TWILIO_AUTH_TOKEN` is set.
- **Metrics:** `/metrics` exposes Prometheus-style counters/gauges (JWT-protected).
- **Production secrets:** Use environment variables or a secrets manager (do not commit `.env` files).

### Exposing for Twilio Webhooks

CallGuard must be publicly reachable for Twilio to send webhooks. The simplest way in development:

```bash
npx ngrok http 3000
# Copy the https:// URL and set it as BASE_URL in server/.env
# Configure your Twilio number's voice webhook to: https://<ngrok-url>/twilio/voice
```

### NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | Run the automated setup wizard |
| `npm start` | Start the server |
| `npm run dev` | Start with hot-reload (watch mode) |
| `npm test` | Run the test suite |
| `npm run build:dashboard` | Precompile the dashboard bundle (production) |
| `npm run db:migrate` | Run database migrations |
| `npm run db:migrate:dev` | Run migrations in dev mode |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:reset` | Drop and recreate the database (dev only) |

> **Production UI build:** Run `npm run build:dashboard` to generate `server/public/app.js`. If the bundle is missing, the server falls back to in-browser Babel compilation.

> **Scaling note:** SQLite runs in WAL mode by default for better concurrency, but for high write volume consider migrating to PostgreSQL, using sticky sessions/Redis pub-sub for WebSocket fanout, and moving retries (calendar/SMS) into a queue worker.

## Mobile App (iOS & Android)

The `mobile/` directory contains an [Expo](https://expo.dev) React Native app that wraps the CallGuard dashboard as a native iOS and Android application. It adds push notifications for incoming calls, native splash screen, and proper app store distribution.

### Quick Start

```bash
cd mobile
npm install
npx expo start          # opens Expo dev tools
```

Scan the QR code with **Expo Go** ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)) to run the app on your phone.

> **Note:** Set your server URL in `mobile/src/config.js` to your machine's LAN IP (e.g. `http://192.168.1.42:3000`) so the phone can reach the backend over your local network.

### Build for App Stores

CallGuard uses [EAS Build](https://docs.expo.dev/build/introduction/) to create production binaries:

```bash
cd mobile
npm install -g eas-cli
eas login                          # sign in to your Expo account
eas build --platform ios           # → .ipa for App Store
eas build --platform android       # → .aab for Google Play
```

Configure store credentials in `mobile/eas.json` before submitting. For iOS, you need your Apple ID, [App Store Connect](https://appstoreconnect.apple.com/) app ID, and team ID. For Android, create a [Google Play service account](https://docs.expo.dev/submit/android/) JSON key.

```bash
eas submit --platform ios          # upload to App Store Connect
eas submit --platform android      # upload to Google Play Console
```

### Mobile Scripts

| Command | Description |
|---------|-------------|
| `npx expo start` | Start Expo dev server |
| `npx expo start --ios` | Launch in iOS Simulator |
| `npx expo start --android` | Launch in Android Emulator |
| `npm run build:ios` | Build iOS binary via EAS |
| `npm run build:android` | Build Android binary via EAS |
| `npm run build:all` | Build both platforms |
| `npm run submit:ios` | Submit to App Store Connect |
| `npm run submit:android` | Submit to Google Play Console |

### Features

- **WebView shell** – wraps the full CallGuard web dashboard natively
- **Push notifications** – native alerts for incoming calls
- **Android back button** – navigates within the app
- **Dark theme** – matches the web UI's dark palette
- **Error recovery** – shows a retry screen when the server is unreachable
- **Deep linking** – notification taps open the relevant screen
- **Splash screen** – native splash while the app loads

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

### Ava Dialogue Engine

The Ava engine adds a production-grade call flow with a stateful gate-based dialogue system:

```
Caller dials your Twilio number
        ↓
POST /ava/voice/inbound
  → create calls + transcripts in DB
  → Ava greets caller (TwiML Gather)
        ↓
Caller speaks → Twilio STT → POST /ava/voice/input
  → Ava.processInput() classifies intent (regex, no LLM)
  → routes through gate (TRIAGE → LOGISTICS → OFFER → CAPTURE)
  → returns next TwiML
  → pushes transcript line to WebSocket
        ↓
... turns repeat until CONFIRMED / LEAD / CALLBACK / EMERGENCY ...
        ↓
Call ends → POST /ava/voice/status
  → creates job_request in DB
  → if booked: creates appointment + sends customer SMS confirmation
  → if missed/lead: sends owner alert SMS
  → closes session
```

Configure Twilio webhooks for the Ava engine:
- **Incoming call (Voice):** `POST https://your-url/ava/voice/inbound`
- **Call status callback:** `POST https://your-url/ava/voice/status`

## Database Schema

The database is designed around 8 core tables:

| Table | Purpose |
|---|---|
| `businesses` | Business owner accounts, AI config, and settings |
| `twilio_numbers` | Twilio phone numbers linked to businesses |
| `calls` | One row per inbound call (disposition, AI handled, owner joined) |
| `transcripts` | Full conversation transcripts as JSON lines |
| `job_requests` | HVAC / mechanic job requests (issue, urgency, disposition) |
| `appointments` | Booked appointments (synced with Google Calendar) |
| `oauth_tokens` | Google OAuth tokens for calendar access |
| `sms_logs` | Audit log for all SMS (booking confirm, missed call, owner alert) |

## Tech Stack

- **Runtime**: Node.js
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: SQLite (built-in, file-based — no external server needed)
- **Voice**: Twilio (handles PSTN/SIP call routing)
- **Dialogue**: Ava — local rule engine, regex intent matching, no LLM (zero per-call cost)
- **Calendar**: Google Calendar API (free tier)
- **SMS**: Twilio SMS (optional, cheap)
- **Mobile**: [Expo](https://expo.dev) (React Native) – iOS & Android

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org)
- **Twilio account** — [Sign up](https://www.twilio.com/try-twilio) (for phone number + SMS)
- No database server needed — SQLite is built in

## API Endpoints

### Original Routes

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

### Ava Engine Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ava/voice/inbound` | New call arrives — starts Ava session |
| POST | `/ava/voice/input` | Caller spoke — STT result → Ava → TwiML |
| POST | `/ava/voice/fallback` | No speech detected — re-prompt |
| POST | `/ava/voice/status` | Call lifecycle (completed, missed, failed) |
| GET | `/ava/api/health` | Server health check |
| GET | `/ava/api/stats?businessId=` | Home screen KPIs (calls, AI rate, bookings) |
| GET | `/ava/api/calls?businessId=` | Call history with transcript summaries |
| GET | `/ava/api/calls/:id/transcript` | Full transcript lines for one call |
| GET | `/ava/api/jobs?businessId=` | Job requests (new, scheduled, lead) |
| GET | `/ava/api/appointments?businessId=` | Upcoming appointments |
| POST | `/ava/api/appointments` | Manual booking from the app |
| POST | `/ava/api/calls/:callSid/sms` | Send mid-call info SMS to caller |
| POST | `/ava/api/jobs/:id/follow-up` | Send follow-up SMS to a lead |

### WebSocket

| Path | Description |
|------|-------------|
| WS `/ws` | Real-time call events (original) |
| WS `/ws?callSid=X&role=owner` | Ava live call room (transcript streaming, take-over, mid-call SMS) |

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
npm test
```

## Milestones

- [x] **Week 1** – Twilio webhook + basic TwiML response
- [x] **Week 2** – STT + dialogue engine + TTS round trip
- [x] **Week 3** – Booking flow + Google Calendar + SMS confirmation
- [x] **Week 4** – Owner dashboard API + WebSocket for live calls
- [x] **Week 5** – Mobile app for iOS & Android (Expo)
- [x] **Week 6** – Ava dialogue engine (gate-based state machine, job requests, SMS templates, live call WebSocket)

## Adding a New Business Type

1. Add a config object in `config/businesses.js`
2. Set `business_type` on the `businesses` table row
3. Add any new intent patterns in `server/src/dialogue/ava.js` → `INTENTS`
4. Ava reads the config at call start — no code changes needed per customer

## Cost at Zero Customers

| Service | Cost |
|---|---|
| Twilio phone number | $1/month |
| Twilio per-minute (inbound) | $0.013/min |
| Twilio SMS | $0.0079/message |
| SQLite database | **$0** (built-in) |
| Ava dialogue engine | **$0** (local, no LLM) |
| Google Calendar API | **$0** (free tier) |
| Hosting (Railway / VPS) | ~$5/month |
| **Total fixed** | **~$6/month** |

Scales with call volume — no flat LLM API bill. No database hosting costs.
