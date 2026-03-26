const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const cfg = require("./config");
const twilioRoutes = require("./routes/twilio");
const voiceRoutes = require("./routes/voice");
const bookingRoutes = require("./routes/booking");
const dashboardRoutes = require("./routes/dashboard");
const { initWebSocket } = require("./ws/live-calls");

// ── Ava dialogue engine modules (from cg.zip) ──
const avaVoiceRoutes = require("./routes/ava-voice");
const avaApiRoutes   = require("./routes/ava-api");
const { attachWebSocketServer } = require("./ws/liveCall");
const db = require("./db/client");

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // Request logger
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Health check
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Week 1 – Twilio webhook + TwiML
  app.use("/twilio", twilioRoutes);

  // Week 2 – STT / dialogue / TTS round-trip (original)
  app.use("/voice", voiceRoutes);

  // Week 3 – Booking flow + Google Calendar + SMS
  app.use("/booking", bookingRoutes);

  // Week 4 – Owner dashboard REST API (original)
  app.use("/api/dashboard", dashboardRoutes);

  // ── Ava engine routes ──
  // Voice webhooks: POST /ava/voice/inbound, /ava/voice/input, /ava/voice/status, /ava/voice/fallback
  app.use("/ava/voice", avaVoiceRoutes);
  // Dashboard REST API: GET /ava/api/stats, /ava/api/calls, /ava/api/jobs, etc.
  app.use("/ava/api", avaApiRoutes);

  // ── UI: serve the React frontend ──
  // Vendor libraries from node_modules
  const nodeModules = path.join(__dirname, "../node_modules");
  app.get("/vendor/react.production.min.js", (_req, res) => {
    res.sendFile(path.join(nodeModules, "react/umd/react.production.min.js"));
  });
  app.get("/vendor/react-dom.production.min.js", (_req, res) => {
    res.sendFile(path.join(nodeModules, "react-dom/umd/react-dom.production.min.js"));
  });
  app.get("/vendor/babel.min.js", (_req, res) => {
    res.sendFile(path.join(nodeModules, "@babel/standalone/babel.min.js"));
  });

  // Serve callguard-app.jsx from repo root so the HTML shell can load it
  const repoRoot = path.resolve(__dirname, "../..");
  app.get("/callguard-app.jsx", (_req, res) => {
    res.type("text/babel").sendFile(path.join(repoRoot, "callguard-app.jsx"));
  });

  // Static files (index.html, api.js)
  app.use(express.static(path.join(__dirname, "../public")));

  // SPA fallback – serve index.html for any unmatched GET
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
  });

  return app;
}

/* istanbul ignore next */
function startServer() {
  const app = createApp();
  const server = http.createServer(app);

  // Week 4 – WebSocket for live calls (original)
  initWebSocket(server);

  // Ava live call WebSocket (enhanced — /ws with call rooms)
  attachWebSocketServer(server);

  server.listen(cfg.port, async () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║   CallGuard · Ava Backend · v2.0                  ║
╠═══════════════════════════════════════════════════╣
║   HTTP  →  http://localhost:${cfg.port}                  ║
║   WS    →  ws://localhost:${cfg.port}/ws                 ║
╠═══════════════════════════════════════════════════╣
║   Original routes:                                ║
║     POST /twilio/voice    ← Twilio webhook        ║
║     POST /voice/respond   ← dialogue round-trip   ║
║     /booking/*            ← booking flow          ║
║     /api/dashboard/*      ← dashboard API         ║
╠═══════════════════════════════════════════════════╣
║   Ava engine routes:                              ║
║     POST /ava/voice/inbound  ← new call           ║
║     POST /ava/voice/input    ← caller spoke       ║
║     POST /ava/voice/status   ← call lifecycle     ║
║     GET  /ava/api/stats      ← home screen stats  ║
║     GET  /ava/api/calls      ← call history       ║
║     GET  /ava/api/jobs       ← job requests       ║
║     GET  /ava/api/appointments ← calendar         ║
║     POST /ava/api/calls/:sid/sms ← mid-call SMS   ║
╚═══════════════════════════════════════════════════╝
    `);

    // Test DB connection
    try {
      await db.$connect();
      console.log("✅ Database connected");
    } catch (err) {
      console.error("❌ Database connection failed:", err.message);
      console.error("   Server will run without database — UI still works");
    }
  });

  return server;
}

// Graceful shutdown
/* istanbul ignore next */
process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  try { await db.$disconnect(); } catch {}
  process.exit(0);
});

// Start when run directly
/* istanbul ignore next */
if (require.main === module) {
  startServer();
}

module.exports = { createApp, startServer };
