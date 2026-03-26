# CallGuard

AI-powered voice receptionist for local service businesses — built on Twilio, OpenAI, and PostgreSQL.

## Quick Start

### Option A: Automated Setup (recommended)

```bash
git clone https://github.com/wombatvagina69-crypto/CallGuard.git
cd CallGuard
./setup.sh
```

The setup script installs all dependencies, creates `.env` files from templates, and runs database migrations when a valid `DATABASE_URL` is configured. After setup, edit the env files with your credentials and start the server:

```bash
npm start              # → http://localhost:3000
```

### Option B: Docker (includes PostgreSQL)

```bash
git clone https://github.com/wombatvagina69-crypto/CallGuard.git
cd CallGuard
cp server/.env.example server/.env   # add your Twilio / Google / OpenAI keys
docker compose up                    # → http://localhost:3000
```

Docker Compose starts a PostgreSQL database and the CallGuard server together. No local Node.js or database install needed.

### Option C: Manual Setup

```bash
git clone https://github.com/wombatvagina69-crypto/CallGuard.git
cd CallGuard
npm install                          # root deps (Prisma)
cp .env.example .env                 # set DATABASE_URL
npm run db:migrate                   # create tables
npm run db:generate                  # generate Prisma client
cd server
npm install                          # server deps
cp .env.example .env                 # add API keys
npm start                            # → http://localhost:3000
```

### Environment Variables

| File | Variable | Description |
|------|----------|-------------|
| `.env` | `DATABASE_URL` | PostgreSQL connection string |
| `.env` | `NODE_ENV` | `development` or `production` |
| `server/.env` | `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `server/.env` | `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `server/.env` | `TWILIO_PHONE_NUMBER` | Your Twilio phone number |
| `server/.env` | `GOOGLE_CLIENT_EMAIL` | Google service account email |
| `server/.env` | `GOOGLE_PRIVATE_KEY` | Google service account private key |
| `server/.env` | `GOOGLE_CALENDAR_ID` | Google Calendar ID (default: `primary`) |
| `server/.env` | `OPENAI_API_KEY` | OpenAI API key |
| `server/.env` | `PORT` | Server port (default: `3000`) |
| `server/.env` | `BASE_URL` | Public URL for Twilio webhooks (e.g. ngrok) |

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
| `npm run db:migrate` | Run database migrations |
| `npm run db:migrate:dev` | Run migrations in dev mode |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:reset` | Drop and recreate the database (dev only) |

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

Configure store credentials in `mobile/eas.json` before submitting:

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
- **Mobile**: [Expo](https://expo.dev) (React Native) – iOS & Android

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org)
- **PostgreSQL** — local, [Supabase](https://supabase.com/), [Neon](https://neon.tech/), or via Docker Compose (included)

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
npm test
```

## Milestones

- [x] **Week 1** – Twilio webhook + basic TwiML response
- [x] **Week 2** – STT + dialogue engine + TTS round trip
- [x] **Week 3** – Booking flow + Google Calendar + SMS confirmation
- [x] **Week 4** – Owner dashboard API + WebSocket for live calls
- [x] **Week 5** – Mobile app for iOS & Android (Expo)
