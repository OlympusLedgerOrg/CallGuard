const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const cfg = require("./config");
const twilioRoutes = require("./routes/twilio");
const voiceRoutes = require("./routes/voice");
const bookingRoutes = require("./routes/booking");
const dashboardRoutes = require("./routes/dashboard");
const authRoutes = require("./routes/auth");
const { initWebSocket } = require("./ws/live-calls");
const rateLimit = require("express-rate-limit");
const { requestLogger } = require("./middleware/request-logger");
const { metricsMiddleware } = require("./middleware/metrics");
const { formatPrometheus } = require("./services/metrics");
const { requireDashboardAuth } = require("./middleware/dashboard-auth");

// ── Ava dialogue engine modules (from cg.zip) ──
const avaVoiceRoutes = require("./routes/ava-voice");
const avaApiRoutes   = require("./routes/ava-api");
const { attachWebSocketServer } = require("./ws/liveCall");
const db = require("./db/client");

function createApp() {
  const app = express();
  const corsOptions = {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (!cfg.corsOrigins.length || cfg.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin denied: ${origin}`));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  };

  app.use(cors(corsOptions));
  app.use(express.urlencoded({ extended: false, limit: cfg.requestBodyLimit }));
  app.use(express.json({ limit: cfg.requestBodyLimit }));

  app.use(requestLogger);
  app.use(metricsMiddleware);

  // Health check
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  const apiLimiter = rateLimit({
    windowMs: cfg.rateLimitWindowMs,
    max: cfg.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.get("/metrics", apiLimiter, requireDashboardAuth, (_req, res) => {
    res.type("text/plain").send(formatPrometheus());
  });

  // Week 1 – Twilio webhook + TwiML
  app.use("/twilio", twilioRoutes);

  // Week 2 – STT / dialogue / TTS round-trip (original)
  app.use("/voice", voiceRoutes);

  // Week 3 – Booking flow + Google Calendar + SMS
  app.use("/booking", bookingRoutes);

  // Week 4 – Owner dashboard REST API (original)
  app.use("/api/auth", apiLimiter, authRoutes);
  app.use("/api/dashboard", apiLimiter, requireDashboardAuth, dashboardRoutes);

  // ── Ava engine routes ──
  // Voice webhooks: POST /ava/voice/inbound, /ava/voice/input, /ava/voice/status, /ava/voice/fallback
  app.use("/ava/voice", avaVoiceRoutes);
  // Dashboard REST API: GET /ava/api/stats, /ava/api/calls, /ava/api/jobs, etc.
  app.use("/ava/api", apiLimiter, requireDashboardAuth, avaApiRoutes);

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

  // Error handler
  app.use((err, req, res, _next) => {
    if (err && err.message?.startsWith("CORS origin denied")) {
      return res.status(403).json({ error: "CORS origin denied" });
    }
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        requestId: req.requestId,
        message: err?.message || "Unhandled error",
      })
    );
    return res.status(500).json({ error: "Internal server error" });
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
      // $executeRaw is unavailable when Prisma is stubbed (e.g., in tests).
      if (db.$executeRaw) {
        try {
          await db.$executeRaw`PRAGMA journal_mode=WAL;`;
          await db.$executeRaw`PRAGMA synchronous=NORMAL;`;
          await db.$executeRaw`PRAGMA busy_timeout=5000;`;
          const modeResult = await db.$queryRaw`PRAGMA journal_mode;`;
          const mode = Array.isArray(modeResult) ? modeResult[0]?.journal_mode : null;
          if (mode && String(mode).toUpperCase() === "WAL") {
            console.log("✅ SQLite WAL mode enabled");
          } else {
            console.error(`❌ SQLite WAL mode not enabled (mode: ${mode || "unknown"})`);
          }
        } catch (pragmaErr) {
          console.error("❌ SQLite WAL mode not enabled:", pragmaErr.message);
        }
      }
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
