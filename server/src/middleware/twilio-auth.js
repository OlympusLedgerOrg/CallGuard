const twilio = require("twilio");
const cfg = require("../config");

/**
 * Express middleware that validates incoming Twilio webhook requests.
 * Skips validation when auth token is not configured (dev mode).
 */
function twilioAuth(req, res, next) {
  if (!cfg.twilioAuthToken) {
    return next(); // skip in dev / test
  }

  const signature = req.headers["x-twilio-signature"] || "";
  const url = cfg.baseUrl + req.originalUrl;

  const isValid = twilio.validateRequest(
    cfg.twilioAuthToken,
    signature,
    url,
    req.body || {}
  );

  if (!isValid) {
    return res.status(403).send("Forbidden – invalid Twilio signature");
  }
  next();
}

module.exports = twilioAuth;
