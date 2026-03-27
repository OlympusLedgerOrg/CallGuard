const cfg = require("../config");

function getClientId(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

function createRateLimiter({ windowMs = cfg.rateLimitWindowMs, max = cfg.rateLimitMax } = {}) {
  const hits = new Map();
  const maxEntries = 10000;
  let lastCleanup = Date.now();

  return function rateLimiter(req, res, next) {
    const key = getClientId(req);
    const now = Date.now();
    let existing = hits.get(key);
    if (!existing) {
      if (hits.size >= maxEntries) {
        for (const [entryKey, entry] of hits.entries()) {
          if (entry.resetAt < now) {
            hits.delete(entryKey);
          }
          if (hits.size < maxEntries) break;
        }
        if (hits.size >= maxEntries) {
          const oldestKey = hits.keys().next().value;
          if (oldestKey) hits.delete(oldestKey);
        }
      }
      existing = { count: 0, resetAt: now + windowMs };
    } else {
      hits.delete(key);
      hits.set(key, existing);
    }

    if (now - lastCleanup > windowMs) {
      for (const [entryKey, entry] of hits.entries()) {
        if (entry.resetAt < now) hits.delete(entryKey);
      }
      lastCleanup = now;
    }

    if (now > existing.resetAt) {
      existing.count = 0;
      existing.resetAt = now + windowMs;
    }

    existing.count += 1;
    hits.set(key, existing);

    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - existing.count));
    res.setHeader("RateLimit-Reset", Math.ceil(existing.resetAt / 1000));

    if (existing.count > max) {
      return res.status(429).json({ error: "Too many requests" });
    }

    return next();
  };
}

module.exports = { createRateLimiter };
