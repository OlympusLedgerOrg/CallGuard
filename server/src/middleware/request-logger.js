const crypto = require("crypto");

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const entry = {
      ts: new Date().toISOString(),
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      ip: req.ip,
    };
    console.log(JSON.stringify(entry));
  });

  next();
}

module.exports = { requestLogger };
