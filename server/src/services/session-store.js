// src/services/session-store.js
// ══════════════════════════════════════════════════════════════════
// Session Persistence — SQLite-backed session storage
// Survives server restarts without requiring Redis.
//
// Features:
//   - Auto-persist sessions on every update
//   - TTL-based expiration (default: 1 hour)
//   - Recovery on server restart
//   - Cleanup of expired sessions
// ══════════════════════════════════════════════════════════════════

const db = require("../db/client");

// Session TTL in milliseconds (1 hour default)
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS || "3600000", 10);

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let cleanupTimer = null;

// ── Persist a session to SQLite ──────────────────────────────────
async function persistSession(callSid, session, businessId) {
  try {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const sessionData = JSON.stringify(session);

    await db.activeSessions.upsert({
      where: { callSid },
      create: {
        callSid,
        businessId: businessId || session.bizConfig?.businessId || "unknown",
        sessionData,
        gate: session.gate || "greeting",
        expiresAt,
      },
      update: {
        sessionData,
        gate: session.gate || "greeting",
        expiresAt,
      },
    });
  } catch (err) {
    console.error(`[SessionStore] Persist error for ${callSid}:`, err.message);
  }
}

// ── Load a session from SQLite ───────────────────────────────────
async function loadSession(callSid) {
  try {
    const record = await db.activeSessions.findUnique({
      where: { callSid },
    });

    if (!record) return null;

    // Check if expired
    if (new Date(record.expiresAt) < new Date()) {
      await deleteSession(callSid);
      return null;
    }

    return JSON.parse(record.sessionData);
  } catch (err) {
    console.error(`[SessionStore] Load error for ${callSid}:`, err.message);
    return null;
  }
}

// ── Delete a session ─────────────────────────────────────────────
async function deleteSession(callSid) {
  try {
    await db.activeSessions.delete({
      where: { callSid },
    });
  } catch (err) {
    // Ignore "not found" errors
    if (!err.message.includes("not found")) {
      console.error(`[SessionStore] Delete error for ${callSid}:`, err.message);
    }
  }
}

// ── Get all active sessions (for recovery) ───────────────────────
async function getAllActiveSessions() {
  try {
    const records = await db.activeSessions.findMany({
      where: {
        expiresAt: { gt: new Date() },
      },
    });

    return records.map(r => ({
      callSid: r.callSid,
      businessId: r.businessId,
      session: JSON.parse(r.sessionData),
      gate: r.gate,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    console.error(`[SessionStore] GetAll error:`, err.message);
    return [];
  }
}

// ── Cleanup expired sessions ─────────────────────────────────────
async function cleanupExpiredSessions() {
  try {
    const result = await db.activeSessions.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      console.log(`[SessionStore] Cleaned up ${result.count} expired sessions`);
    }
  } catch (err) {
    console.error(`[SessionStore] Cleanup error:`, err.message);
  }
}

// ── Start cleanup timer ──────────────────────────────────────────
function startCleanupTimer() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS);
  console.log(`[SessionStore] Cleanup timer started (every ${CLEANUP_INTERVAL_MS / 1000}s)`);
}

// ── Stop cleanup timer ───────────────────────────────────────────
function stopCleanupTimer() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

// ── Recover sessions on startup ──────────────────────────────────
async function recoverSessions(restoreCallback) {
  const sessions = await getAllActiveSessions();

  if (sessions.length === 0) {
    console.log(`[SessionStore] No sessions to recover`);
    return 0;
  }

  console.log(`[SessionStore] Recovering ${sessions.length} sessions...`);

  for (const { callSid, session } of sessions) {
    try {
      restoreCallback(callSid, session);
    } catch (err) {
      console.error(`[SessionStore] Recovery failed for ${callSid}:`, err.message);
    }
  }

  return sessions.length;
}

// ── Get session count ────────────────────────────────────────────
async function getSessionCount() {
  try {
    return await db.activeSessions.count({
      where: {
        expiresAt: { gt: new Date() },
      },
    });
  } catch {
    return 0;
  }
}

module.exports = {
  persistSession,
  loadSession,
  deleteSession,
  getAllActiveSessions,
  cleanupExpiredSessions,
  startCleanupTimer,
  stopCleanupTimer,
  recoverSessions,
  getSessionCount,
  SESSION_TTL_MS,
};
