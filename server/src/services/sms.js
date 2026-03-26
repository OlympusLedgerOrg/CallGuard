/**
 * SMS service – sends confirmation messages via Twilio.
 */

const twilio = require("twilio");
const cfg = require("../config");

function getClient() {
  return twilio(cfg.twilioAccountSid, cfg.twilioAuthToken);
}

/**
 * Send a booking confirmation SMS.
 * @param {{ to: string, customerName: string, service: string, dateTime: string }} opts
 * @returns {Promise<object>} Twilio message resource
 */
async function sendBookingConfirmation({ to, customerName, service, dateTime }) {
  const body =
    `Hi ${customerName}! Your ${service} appointment has been confirmed ` +
    `for ${dateTime}. Reply CANCEL to cancel. – CallGuard`;

  const client = getClient();
  return client.messages.create({
    body,
    from: cfg.twilioPhoneNumber,
    to,
  });
}

/**
 * Send a generic SMS.
 * @param {{ to: string, body: string }} opts
 * @returns {Promise<object>}
 */
async function sendSms({ to, body }) {
  const client = getClient();
  return client.messages.create({
    body,
    from: cfg.twilioPhoneNumber,
    to,
  });
}

module.exports = { sendBookingConfirmation, sendSms };
