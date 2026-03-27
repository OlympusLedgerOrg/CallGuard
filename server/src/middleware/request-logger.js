const crypto = require("crypto");

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const maskIp = (ip) => {
    if (!ip) return "";
    if (ip.includes(":")) {
      const parts = ip.split(":");
      return parts.slice(0, -2).concat(["*","*"]).join(":");
    }
    const octets = ip.split(".");
    if (octets.length === 4) {
      octets[3] = "0";
      return octets.join(".");
    }
    return ip;
  };

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const entry = {
      ts: new Date().toISOString(),
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      ip: maskIp(req.ip),
    };
    console.log(JSON.stringify(entry));
  });

  next();
}

module.exports = { requestLogger };
