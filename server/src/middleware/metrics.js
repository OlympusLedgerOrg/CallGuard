const { recordRequest, incrementInflight, decrementInflight } = require("../services/metrics");

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  incrementInflight();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    recordRequest(res.statusCode, Math.round(durationMs));
    decrementInflight();
  });

  next();
}

module.exports = { metricsMiddleware };
