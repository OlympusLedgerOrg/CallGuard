const { recordRequest, incrementInflight, decrementInflight } = require("../services/metrics");

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  incrementInflight();

  res.on("finish", () => {
    const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
    recordRequest(res.statusCode, durationMs);
    decrementInflight();
  });

  next();
}

module.exports = { metricsMiddleware };
