# CallGuard

AI-powered receptionist that answers phone calls, books appointments, and keeps business owners in the loop — all in real time.

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

## Quick start

```bash
cd server
cp .env.example .env   # fill in your Twilio & Google creds
npm install
npm start              # http://localhost:3000
```

Expose the server with ngrok and point your Twilio number's voice webhook at `https://<ngrok>.ngrok.io/twilio/voice`.

## API endpoints

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

## Tests

```bash
cd server
npm test
```

## Milestones

- [x] **Week 1** – Twilio webhook + basic TwiML response
- [x] **Week 2** – STT + dialogue engine + TTS round trip
- [x] **Week 3** – Booking flow + Google Calendar + SMS confirmation
- [x] **Week 4** – Owner dashboard API + WebSocket for live calls
