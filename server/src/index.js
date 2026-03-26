const express = require("express");
const cors = require("cors");
const http = require("http");
const cfg = require("./config");
const twilioRoutes = require("./routes/twilio");
const voiceRoutes = require("./routes/voice");
const bookingRoutes = require("./routes/booking");
const dashboardRoutes = require("./routes/dashboard");
const { initWebSocket } = require("./ws/live-calls");

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Week 1 – Twilio webhook + TwiML
  app.use("/twilio", twilioRoutes);

  // Week 2 – STT / dialogue / TTS round-trip
  app.use("/voice", voiceRoutes);

  // Week 3 – Booking flow + Google Calendar + SMS
  app.use("/booking", bookingRoutes);

  // Week 4 – Owner dashboard REST API
  app.use("/api/dashboard", dashboardRoutes);

  return app;
}

/* istanbul ignore next */
function startServer() {
  const app = createApp();
  const server = http.createServer(app);

  // Week 4 – WebSocket for live calls
  initWebSocket(server);

  server.listen(cfg.port, () => {
    console.log(`CallGuard server listening on port ${cfg.port}`);
  });
  return server;
}

// Start when run directly
/* istanbul ignore next */
if (require.main === module) {
  startServer();
}

module.exports = { createApp, startServer };
