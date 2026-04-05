/**
 * Google Calendar integration – check availability and create events.
 *
 * Uses a Google Service Account. Set GOOGLE_CLIENT_EMAIL and
 * GOOGLE_PRIVATE_KEY in your .env file.
 *
 * VibeVoice: Now supports per-business timezone configuration.
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
 * @param {string} timezone – IANA timezone, e.g. "America/New_York"
 * @returns {Promise<Array<{start: string, end: string}>>} busy periods
 */
async function getBusySlots(dateStr, timezone = "America/New_York") {
  const cal = getCalendar();
  
  // Construct timestamps in the target timezone
  // Google Calendar API accepts date strings without Z suffix and uses timeZone field
  const timeMin = `${dateStr}T00:00:00`;
  const timeMax = `${dateStr}T23:59:59`;

  const res = await cal.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone: timezone,
      items: [{ id: cfg.googleCalendarId }],
    },
  });

  return res.data.calendars[cfg.googleCalendarId].busy;
}

/**
 * Create a calendar event for a booking.
 * Includes double-booking prevention via optimistic conflict check.
 * 
 * @param {{ summary: string, description: string, startTime: string, endTime: string, attendeeEmail?: string, timezone?: string }} opts
 * @returns {Promise<object>} created event
 * @throws {Error} if time slot is already booked
 */
async function createEvent({ summary, description, startTime, endTime, attendeeEmail, timezone = "America/New_York" }) {
  const cal = getCalendar();

  // ── Double-booking prevention ──────────────────────────────────
  // Check if the slot is still available before creating the event
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  const dateStr = startDate.toISOString().split("T")[0];

  const busySlots = await getBusySlots(dateStr, timezone);
  const hasConflict = busySlots.some(slot => {
    const slotStart = new Date(slot.start);
    const slotEnd = new Date(slot.end);
    return startDate < slotEnd && endDate > slotStart;
  });

  if (hasConflict) {
    const error = new Error("This time slot is no longer available. Please select a different time.");
    error.code = "TIME_SLOT_CONFLICT";
    throw error;
  }

  // ── Create the event ───────────────────────────────────────────
  const event = {
    summary,
    description,
    start: { dateTime: startTime, timeZone: timezone },
    end: { dateTime: endTime, timeZone: timezone },
  };

  if (attendeeEmail) {
    event.attendees = [{ email: attendeeEmail }];
  }

  const res = await cal.events.insert({
    calendarId: cfg.googleCalendarId,
    requestBody: event,
    // Use conferenceDataVersion to support Google Meet links if needed
  });

  return res.data;
}

/**
 * Generate available 30-min slots for a date, excluding busy periods.
 * Business hours: 09:00 – 17:00 (configurable)
 * 
 * @param {string} dateStr – "YYYY-MM-DD"
 * @param {object} options – { timezone, startHour, endHour, slotMinutes }
 * @returns {Promise<Array<{iso: string, label: string}>>} available slots
 */
async function getAvailableSlots(dateStr, options = {}) {
  const {
    timezone = "America/New_York",
    startHour = 9,
    endHour = 17,
    slotMinutes = 30,
  } = options;

  const busySlots = await getBusySlots(dateStr, timezone);

  const slots = [];
  const dayStart = new Date(`${dateStr}T${String(startHour).padStart(2, "0")}:00:00`);
  const dayEnd = new Date(`${dateStr}T${String(endHour).padStart(2, "0")}:00:00`);
  const slotDuration = slotMinutes * 60 * 1000;

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
      // Generate human-friendly label
      const hour = slotStart.getHours();
      const minute = slotStart.getMinutes();
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const displayMinute = minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`;
      
      slots.push({
        iso: slotStart.toISOString(),
        label: `${displayHour}${displayMinute} ${ampm}`,
      });
    }
  }

  return slots;
}

module.exports = { getBusySlots, createEvent, getAvailableSlots };
