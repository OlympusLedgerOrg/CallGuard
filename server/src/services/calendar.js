/**
 * Google Calendar integration – check availability and create events.
 *
 * Uses a Google Service Account. Set GOOGLE_CLIENT_EMAIL and
 * GOOGLE_PRIVATE_KEY in your .env file.
 */

const { google } = require("googleapis");
const cfg = require("../config");

function getAuthClient() {
  return new google.auth.JWT(
    cfg.googleClientEmail,
    null,
    cfg.googlePrivateKey,
    ["https://www.googleapis.com/auth/calendar"]
  );
}

function getCalendar() {
  return google.calendar({ version: "v3", auth: getAuthClient() });
}

/**
 * List free/busy slots for a given day.
 * @param {string} dateStr – ISO date string, e.g. "2026-04-01"
 * @returns {Promise<Array<{start: string, end: string}>>} busy periods
 */
async function getBusySlots(dateStr) {
  const cal = getCalendar();
  const timeMin = new Date(`${dateStr}T00:00:00`).toISOString();
  const timeMax = new Date(`${dateStr}T23:59:59`).toISOString();

  const res = await cal.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: cfg.googleCalendarId }],
    },
  });

  return res.data.calendars[cfg.googleCalendarId].busy;
}

/**
 * Create a calendar event for a booking.
 * @param {{ summary: string, description: string, startTime: string, endTime: string, attendeeEmail?: string }} opts
 * @returns {Promise<object>} created event
 */
async function createEvent({ summary, description, startTime, endTime, attendeeEmail }) {
  const cal = getCalendar();

  const event = {
    summary,
    description,
    start: { dateTime: startTime, timeZone: "America/New_York" },
    end: { dateTime: endTime, timeZone: "America/New_York" },
  };

  if (attendeeEmail) {
    event.attendees = [{ email: attendeeEmail }];
  }

  const res = await cal.events.insert({
    calendarId: cfg.googleCalendarId,
    requestBody: event,
  });

  return res.data;
}

/**
 * Generate available 30-min slots for a date, excluding busy periods.
 * Business hours: 09:00 – 17:00
 * @param {string} dateStr – "YYYY-MM-DD"
 * @returns {Promise<string[]>} available slot start times as ISO strings
 */
async function getAvailableSlots(dateStr) {
  const busySlots = await getBusySlots(dateStr);

  const slots = [];
  const dayStart = new Date(`${dateStr}T09:00:00`);
  const dayEnd = new Date(`${dateStr}T17:00:00`);
  const slotDuration = 30 * 60 * 1000; // 30 minutes

  for (
    let t = dayStart.getTime();
    t + slotDuration <= dayEnd.getTime();
    t += slotDuration
  ) {
    const slotStart = new Date(t);
    const slotEnd = new Date(t + slotDuration);
    const isBusy = busySlots.some((b) => {
      const bStart = new Date(b.start);
      const bEnd = new Date(b.end);
      return slotStart < bEnd && slotEnd > bStart;
    });
    if (!isBusy) {
      slots.push(slotStart.toISOString());
    }
  }

  return slots;
}

module.exports = { getBusySlots, createEvent, getAvailableSlots };
