/**
 * CallGuard API client — bridges the React UI to the Express backend.
 *
 * Works in two modes:
 *   • Connected (BASE set) – fetches real data from the server
 *   • Offline  (no BASE)   – returns null so the UI falls back to mock data
 *
 * Usage inside React:
 *   import { api, useCallSocket } from "./api.js";
 *   const stats = await api.getStats();     // null when offline
 *   useCallSocket(onStart, onTranscript, onEnd);
 */

// Resolve the base URL from the page origin (served by Express)
const BASE = typeof window !== "undefined" ? window.location.origin : "";
const TOKEN_KEY = "callguard_auth_token";
let authToken = null;

if (typeof window !== "undefined") {
  authToken = window.localStorage?.getItem(TOKEN_KEY) || null;
}

function setAuthToken(token) {
  authToken = token || null;
  if (typeof window !== "undefined" && window.localStorage) {
    if (authToken) {
      window.localStorage.setItem(TOKEN_KEY, authToken);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  }
}

/* ──────────────── REST helpers ──────────────── */

async function json(method, path, body) {
  try {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    };
    if (authToken) {
      opts.headers.Authorization = `Bearer ${authToken}`;
    }
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, opts);
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null; // offline / unreachable
  }
}

async function raw(method, path, body) {
  try {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    };
    if (authToken) {
      opts.headers.Authorization = `Bearer ${authToken}`;
    }
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, opts);
    const data = res.ok ? await res.json() : null;
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

const api = {
  /* ── Auth ── */
  login:  (username, password) => json("POST", "/api/auth/login", { username, password }),
  logout: () => json("POST", "/api/auth/logout"),
  getSession: () => raw("GET", "/api/auth/session"),
  setAuthToken,

  /* ── Dashboard (Week 4) ── */
  getStats:       ()           => json("GET",  "/api/dashboard/stats"),
  getActiveCalls: ()           => json("GET",  "/api/dashboard/calls/active"),
  getCallLog:     (limit = 50) => json("GET",  `/api/dashboard/calls/log?limit=${limit}`),
  sendSms:        (to, body)   => json("POST", "/api/dashboard/sms", { to, body }),

  /* ── Booking (Week 3) ── */
  getAvailability: (date) => json("GET", `/booking/availability?date=${date}`),
  createBooking:   (data) => json("POST", "/booking/create", data),

  /* ── Test My AI ── */
  testCall:      (sessionId, text, businessType) => json("POST", "/ava/api/test-call", { sessionId, text, businessType }),
  endTestCall:   (sessionId)                     => json("DELETE", `/ava/api/test-call/${sessionId}`),

  /* ── Script Wizard ── */
  getScripts:    (businessId)          => json("GET", `/ava/api/scripts?businessId=${businessId}`),
  updateScripts: (businessId, scripts) => json("PUT", "/ava/api/scripts", { businessId, scripts }),

  /* ── Call Me Back Queue ── */
  getCallbacks:    (businessId, status) => json("GET", `/ava/api/callbacks?businessId=${businessId}${status ? `&status=${status}` : ""}`),
  createCallback:  (data)              => json("POST", "/ava/api/callbacks", data),
  updateCallback:  (id, data)          => json("PATCH", `/ava/api/callbacks/${id}`, data),

  /* ── Health ── */
  health: () => json("GET", "/health"),
};

/* ──────────────── WebSocket (Week 4) ──────────────── */

/**
 * Connect to the live-call WebSocket and dispatch events.
 *
 * @param {object} handlers
 * @param {function} handlers.onSnapshot    – initial active call list
 * @param {function} handlers.onCallStart   – new call started
 * @param {function} handlers.onTranscript  – new transcript turn
 * @param {function} handlers.onCallEnd     – call completed
 * @returns {function} close – call to disconnect
 */
function connectCallSocket(handlers = {}) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/ws`;
  let ws;

  try {
    ws = new WebSocket(url);
  } catch {
    return () => {}; // WebSocket not available
  }

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      switch (msg.event) {
        case "snapshot":
          handlers.onSnapshot?.(msg.data);
          break;
        case "call:start":
          handlers.onCallStart?.(msg.data);
          break;
        case "call:transcript":
          handlers.onTranscript?.(msg.data);
          break;
        case "call:end":
          handlers.onCallEnd?.(msg.data);
          break;
      }
    } catch { /* ignore malformed messages */ }
  };

  ws.onerror = () => {};
  ws.onclose = () => {};

  return () => {
    try { ws.close(); } catch { /* noop */ }
  };
}

// Make available globally when loaded via script tag (no bundler)
if (typeof window !== "undefined") {
  window.CallGuardAPI = api;
  window.CallGuardSocket = connectCallSocket;
}

export { api, connectCallSocket };
