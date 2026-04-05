// src/dialogue/ava.js
// ══════════════════════════════════════════════════════════════════
// AVA — Dialogue Engine
// Stateful, turn-by-turn conversation manager for inbound calls.
//
// Architecture:
//   CallSession  →  Gate (triage|logistics|offer|capture|end)
//               →  Intent classifier (regex → fuse.js fuzzy fallback)
//               →  Response builder
//               →  Disposition emitter
//
// No LLM required. Pure rule-based with regex intent matching and
// fuse.js fuzzy-match fallback for misheard / mis-transcribed words.
// Reads business config (services, hours, slots) at session start.
// ══════════════════════════════════════════════════════════════════

const Fuse = require("fuse.js");

// ── Call session store (in-memory; replace with Redis for multi-instance) ──
const sessions = new Map();

// ── Gate definitions ──────────────────────────────────────────────
const GATES = {
  GREETING:   "greeting",
  TRIAGE:     "triage",        // understand the issue
  LOGISTICS:  "logistics",     // get address/location
  OFFER:      "offer",         // present time slots
  CAPTURE:    "capture",       // confirm name + number
  CONFIRMED:  "confirmed",     // booking locked in
  LEAD:       "lead",          // not bookable yet — capture contact
  CALLBACK:   "callback",      // owner needs to call back
  EMERGENCY:  "emergency",     // escalate immediately
  END:        "end",
};

// ── Intent patterns ───────────────────────────────────────────────
const INTENTS = {
  // Issue types
  ac:          [/\bac\b|air.?cond|cool|not cool|too hot|compressor|refrigerant|freon/i],
  heating:     [/heat|furnace|no heat|boiler|heat pump|warm/i],
  install:     [/install|replace.*unit|new system|new ac|new heat/i],
  maintenance: [/tune.?up|service|mainten|filter|annual|check.?up/i],

  brakes:      [/brake|stopping|squeal|grind|pedal|rotor|caliper/i],
  engine:      [/engine|check.?engine|light.*on|misfire|stall|overheat|smoke/i],
  wont_start:  [/won.t start|won't start|dead|click|no power|battery/i],
  oil:         [/oil|lube|oil change/i],
  tires:       [/tire|tyre|alignment|flat|puncture|rotation/i],
  transmission:[/transmission|trans|shifting|gear/i],

  // Logistics
  address:     [/\d{1,5}\s\w+|street|avenue|road|drive|lane|blvd|my address|i.m at|located at/i],
  has_address: [/yes.*address|sure|it.s at|address is/i],

  // Scheduling
  today:       [/today|right now|as soon|this afternoon|this morning|urgent|asap/i],
  tomorrow:    [/tomorrow|next.*morning|next.*day/i],
  first_slot:  [/first|earliest|soonest|slot one|\b1\b|yes.*first/i],
  second_slot: [/second|slot two|\b2\b|yes.*second|other one/i],
  yes:         [/^(yes|yeah|yep|sure|ok|okay|sounds good|perfect|great|that works|confirm|please|go ahead)[\s.,!]*$/i],
  no:          [/^(no|nope|not now|later|maybe later|never mind|nevermind|no thanks)[\s.,!]*$/i],

  // Pricing
  price:       [/how much|cost|price|fee|rate|charge|quote|estimate/i],
  hours:       [/hour|open|close|when.*open|saturday|sunday|weekend/i],
  emergency_q: [/emergency|after.?hour|tonight|weekend.*urgent/i],

  // Escalation
  escalate:    [/speak.*owner|talk.*human|real person|manager|owner|transfer|operator/i],
  callback:    [/call.*back|callback|not sure|need to think|maybe later|busy/i],

  // Info / misc
  address_ask: [/where.*you|your address|location|find you|directions/i],
  affirm_name: [/.+/],  // catch-all for name capture — any non-empty response
};

// ── Fuzzy intent corpus ───────────────────────────────────────────
// Single-keyword entries — fuse.js matches individual words from the
// caller's speech against these terms so STT mis-transcriptions like
// "squeling" (squealing) or "kompressor" (compressor) are caught.
// Covers only TECHNICAL intents; binary/conversational ones (yes/no/
// today/slots) use strict regex only to avoid false positives.
const FUZZY_CORPUS = [
  // AC / cooling
  { intent: "ac",           phrase: "conditioning" },
  { intent: "ac",           phrase: "compressor"   },
  { intent: "ac",           phrase: "refrigerant"  },
  { intent: "ac",           phrase: "coolant"      },
  // Heating
  { intent: "heating",      phrase: "furnace"   },
  { intent: "heating",      phrase: "boiler"    },
  { intent: "heating",      phrase: "radiator"  },
  // Install / replace
  { intent: "install",      phrase: "installation" },
  { intent: "install",      phrase: "replacement"  },
  // Maintenance
  { intent: "maintenance",  phrase: "maintenance"  },
  { intent: "maintenance",  phrase: "inspection"   },
  // Brakes
  { intent: "brakes",       phrase: "squealing"    },
  { intent: "brakes",       phrase: "caliper"      },
  { intent: "brakes",       phrase: "grinding"     },
  // Engine
  { intent: "engine",       phrase: "misfiring"    },
  { intent: "engine",       phrase: "overheating"  },
  { intent: "engine",       phrase: "stalling"     },
  // Won't start
  { intent: "wont_start",   phrase: "battery"      },
  { intent: "wont_start",   phrase: "starter"      },
  // Oil
  { intent: "oil",          phrase: "lubrication"  },
  // Tires
  { intent: "tires",        phrase: "alignment"    },
  { intent: "tires",        phrase: "puncture"     },
  { intent: "tires",        phrase: "rotation"     },
  // Transmission
  { intent: "transmission", phrase: "transmission" },
  { intent: "transmission", phrase: "gearbox"      },
  // Price / hours
  { intent: "price",        phrase: "estimate"     },
  { intent: "price",        phrase: "quotation"    },
  { intent: "hours",        phrase: "schedule"     },
  // Emergency / escalate
  { intent: "emergency_q",  phrase: "emergency"    },
  { intent: "escalate",     phrase: "supervisor"   },
  { intent: "escalate",     phrase: "manager"      },
];

// Intents that benefit from fuzzy fallback (technical vocabulary / issue types).
// Binary/conversational intents (yes, no, today, tomorrow, first_slot, second_slot,
// callback) rely on regex only to avoid false positives on short phrases.
const FUZZY_ELIGIBLE = new Set([
  "ac", "heating", "install", "maintenance",
  "brakes", "engine", "wont_start", "oil", "tires", "transmission",
  "price", "hours", "emergency_q", "escalate",
]);

const _fuse = new Fuse(FUZZY_CORPUS, {
  keys: ["phrase"],
  threshold: 0.3,    // per-word matching: 0.3 catches ~1-2 char STT errors
  includeScore: true,
  minMatchCharLength: 4,
});

/**
 * fuzzyMatchIntent — returns the best-matching intent key for `text`
 * using fuse.js word-level matching.  Each word in `text` is checked
 * individually against the keyword corpus so single mis-transcribed
 * terms (e.g. "squeling" → squealing → brakes) are caught even when
 * the surrounding words are different.
 *
 * Restricted to FUZZY_ELIGIBLE intents; binary/conversational intents
 * always return null.
 */
function fuzzyMatchIntent(text, ...keys) {
  const eligibleKeys = keys.length
    ? keys.filter(k => FUZZY_ELIGIBLE.has(k))
    : [...FUZZY_ELIGIBLE];
  if (eligibleKeys.length === 0) return null;

  const words = text.toLowerCase().split(/\s+/).filter(w => w.length >= 6);
  for (const word of words) {
    const results = _fuse.search(word);
    for (const result of results) {
      const candidate = result.item.intent;
      if (eligibleKeys.includes(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function matchIntent(text, ...keys) {
  // 1. Try strict regex first (fast path)
  for (const key of keys) {
    const patterns = INTENTS[key] || [];
    if (patterns.some(r => r.test(text))) return key;
  }
  // 2. Fuzzy fallback for misheard / mis-transcribed technical speech
  return fuzzyMatchIntent(text, ...keys);
}

// ── Response templates ────────────────────────────────────────────
function r(strings) {
  // Pick a random variant to keep Ava from sounding robotic
  const arr = Array.isArray(strings) ? strings : [strings];
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── TwiML helpers ────────────────────────────────────────────────
// These produce the speech text Twilio will say.

function say(text) {
  return { type: "say", text: text.trim() };
}

function gather(text, hints = "") {
  // Tells Twilio to speak `text` then listen for speech/DTMF
  return { type: "gather", text: text.trim(), hints };
}

function hangup(text) {
  return { type: "hangup", text: text?.trim() };
}

// ── Main dialogue step processor ────────────────────────────────
function processInput(callSid, rawText, bizConfig) {
  const text = (rawText || "").trim();

  // Get or create session
  if (!sessions.has(callSid)) {
    sessions.set(callSid, {
      callSid,
      bizConfig,
      gate: GATES.GREETING,
      issue: null,
      issue_type: null,
      triage_q_index: 0,
      address: null,
      slot: null,
      customer_name: null,
      customer_phone: null,
      disposition: null,
      transcript: [],
      // VibeVoice additions
      paused: false,
      fallbackCount: 0,
      missedIntentCount: 0,
      turnCount: 0,
      createdAt: Date.now(),
    });
  }

  const session = sessions.get(callSid);

  // If session is paused (owner takeover), don't process
  if (session.paused) {
    return {
      action: { type: "paused", text: null },
      session: { ...session },
      done: false,
    };
  }

  // Increment turn count
  session.turnCount++;

  // Log caller turn
  if (text) {
    session.transcript.push({ from: "caller", text, ts: Date.now() });
  }

  const response = routeGate(session, text);

  // Log Ava turn
  if (response.text) {
    session.transcript.push({ from: "ava", text: response.text, ts: Date.now() });
  }

  return {
    action: response,       // { type: "say"|"gather"|"hangup", text, hints }
    session: { ...session }, // current state snapshot for DB write
    done: session.gate === GATES.END,
  };
}

// ── Fallback handler (no speech detected) ────────────────────────
function processFallback(callSid) {
  const session = sessions.get(callSid);
  if (!session) {
    return {
      action: {
        type: "gather",
        text: "I'm sorry, I didn't catch that. How can I help you today?",
        hints: "appointment, repair, price, emergency, hours",
      },
      session: null,
      done: false,
      maxFallbacksReached: false,
    };
  }

  // Increment fallback count
  session.fallbackCount++;

  // Max fallbacks reached — transfer to callback queue
  if (session.fallbackCount >= 3) {
    session.gate = GATES.END;
    session.disposition = "stt_failure";
    return {
      action: {
        type: "hangup",
        text: "I'm having trouble hearing you. I'll have someone from the team call you back. Thanks for calling!",
      },
      session: { ...session },
      done: true,
      maxFallbacksReached: true,
    };
  }

  // Re-prompt based on current gate
  const prompts = {
    [GATES.TRIAGE]: "I didn't quite catch that. What can we help you with today?",
    [GATES.LOGISTICS]: "Sorry, I missed that. What's the address for the service call?",
    [GATES.OFFER]: "I didn't hear your response. Would you like the first or second time slot?",
    [GATES.CAPTURE]: "I couldn't hear that. Could you repeat your name or phone number?",
    [GATES.LEAD]: "Sorry, I missed that. What's the best number to reach you?",
    [GATES.CALLBACK]: "I didn't catch your name. Could you say it again?",
  };

  const text = prompts[session.gate] || "I'm sorry, I didn't catch that. How can I help you today?";

  return {
    action: {
      type: "gather",
      text,
      hints: "appointment, repair, price, emergency, hours, name, phone number",
    },
    session: { ...session },
    done: false,
    maxFallbacksReached: false,
  };
}

// ── Gate router ──────────────────────────────────────────────────
function routeGate(session, text) {
  const biz = session.bizConfig;

  // ── GREETING ── first contact, no input yet ──────────────────
  if (session.gate === GATES.GREETING) {
    session.gate = GATES.TRIAGE;
    const greetings = [
      `Thanks for calling ${biz.name}. I'm Ava, your AI receptionist. How can I help you today?`,
      `Hi, you've reached ${biz.name}. I'm Ava. What can we help you with?`,
    ];
    return gather(r(greetings), "appointment, repair, price, hours, emergency");
  }

  // ── Check for escalation anywhere ───────────────────────────
  if (matchIntent(text, "escalate")) {
    session.gate = GATES.CALLBACK;
    session.disposition = "callback";
    return gather(
      `No problem. I'll make sure ${biz.name} calls you back shortly. Can I get your name?`,
      "name"
    );
  }

  // ── Check for emergency anywhere ────────────────────────────
  if (
    matchIntent(text, "emergency_q") ||
    biz.escalation_triggers?.some(t => text.toLowerCase().includes(t))
  ) {
    session.gate = GATES.EMERGENCY;
    session.disposition = "emergency";
    return handleEmergency(session, text);
  }

  // ── TRIAGE ── understand the issue ──────────────────────────
  if (session.gate === GATES.TRIAGE) {
    // Detect service type
    const issueType = detectIssueType(text, biz.business_type);

    if (!issueType && !session.issue) {
      // Couldn't understand — ask again
      return gather(
        "I want to make sure I get the right person out to you. Can you describe what's going on?",
        "repair, appointment, price, AC, heating, brakes, engine"
      );
    }

    if (issueType) {
      session.issue_type = issueType;
      session.issue = text; // raw description
    }

    // Handle price / hours queries inline
    if (matchIntent(text, "price")) {
      const info = getPriceInfo(session.issue_type || "general", biz);
      return gather(`${info} Would you like to book a time to come in?`, "yes, no");
    }

    if (matchIntent(text, "hours")) {
      const hrs = formatHours(biz.hours);
      return gather(`We're open ${hrs}. Would you like to schedule something?`, "yes, no");
    }

    // Ask first triage question
    const questions = getTriageQuestions(session.issue_type, biz);
    if (session.triage_q_index < questions.length) {
      const q = questions[session.triage_q_index];
      session.triage_q_index++;
      return gather(q);
    }

    // Done triaging — move to logistics
    session.gate = GATES.LOGISTICS;
    return gather(
      biz.walk_ins
        ? "Got it. Are you able to bring it in, or do you need us to come to you?"
        : `Got it. What's the address? I'll check if we have a tech available near you.`,
      "address, come to me, bring it in"
    );
  }

  // ── LOGISTICS ── get address or drop-off preference ─────────
  if (session.gate === GATES.LOGISTICS) {
    // Extract address if present
    const addr = extractAddress(text);
    if (addr) {
      session.address = addr;
    } else if (text.length > 3) {
      session.address = text; // store whatever they said
    }

    session.gate = GATES.OFFER;
    return offerSlots(session, biz);
  }

  // ── OFFER ── present available time slots ────────────────────
  if (session.gate === GATES.OFFER) {
    const slots = biz.available_slots || [];

    if (matchIntent(text, "yes", "first_slot", "today")) {
      session.slot = slots[0];
    } else if (matchIntent(text, "second_slot", "tomorrow")) {
      session.slot = slots[1] || slots[0];
    } else if (matchIntent(text, "no", "callback")) {
      // Doesn't want to book now — capture as lead
      session.gate = GATES.LEAD;
      session.disposition = "lead";
      return gather(
        "No problem. Can I get your name and the best number to reach you? Someone will call you back.",
        "name"
      );
    } else {
      // Re-offer
      return offerSlots(session, biz);
    }

    // Slot selected — get name
    session.gate = GATES.CAPTURE;
    return gather(
      `Perfect. I've got ${session.slot.label} reserved. What name should I put on the booking?`,
      "name"
    );
  }

  // ── CAPTURE ── get name ──────────────────────────────────────
  if (session.gate === GATES.CAPTURE) {
    if (!session.customer_name && text.length > 1) {
      session.customer_name = capitalise(text);
      return gather(
        `Got it, ${session.customer_name}. And what's the best mobile number to text the confirmation to?`,
        "phone number"
      );
    }

    // Name already set — this must be the phone number
    const phone = extractPhone(text);
    if (phone) {
      session.customer_phone = phone;
      session.gate = GATES.CONFIRMED;
      session.disposition = "booked";
      return confirmBooking(session, biz);
    }

    return gather("Sorry, I didn't quite catch that number. Can you repeat it?", "phone number");
  }

  // ── LEAD ── capture contact without booking ─────────────────
  if (session.gate === GATES.LEAD) {
    if (!session.customer_name && text.length > 1) {
      session.customer_name = capitalise(text);
      return gather("And the best number to reach you?", "phone number");
    }

    const phone = extractPhone(text);
    if (phone) {
      session.customer_phone = phone;
      session.gate = GATES.END;
      return hangup(
        `Great. I've passed your info to the team. Someone from ${biz.name} will reach out to you soon. Have a good one!`
      );
    }

    return gather("Can you repeat that number for me?", "phone number");
  }

  // ── CALLBACK ── just need name ───────────────────────────────
  if (session.gate === GATES.CALLBACK) {
    if (!session.customer_name) {
      session.customer_name = capitalise(text);
      session.gate = GATES.END;
      return hangup(
        `Thanks, ${session.customer_name}. I'll let the team know. Someone will call you back shortly. Take care!`
      );
    }
  }

  // ── CONFIRMED ── booking done, wind down ─────────────────────
  if (session.gate === GATES.CONFIRMED) {
    session.gate = GATES.END;
    return hangup();
  }

  // ── END / fallback ───────────────────────────────────────────
  session.gate = GATES.END;
  return hangup(`Is there anything else I can help with? Have a great day!`);
}

// ── Sub-handlers ─────────────────────────────────────────────────

function handleEmergency(session, text) {
  const biz = session.bizConfig;
  if (!biz.emergency_service) {
    session.gate = GATES.END;
    return hangup(
      `I want to help, but we don't offer emergency after-hours service. Please call 911 if it's a safety issue, or call back during our regular hours. Take care!`
    );
  }
  session.gate = GATES.CAPTURE;
  return gather(
    `This sounds urgent. I'm flagging this as an emergency call right now. Can I get your name so we can get someone out to you as fast as possible?`,
    "name"
  );
}

function offerSlots(session, biz) {
  const slots = biz.available_slots || [];
  if (slots.length === 0) {
    session.gate = GATES.LEAD;
    session.disposition = "callback";
    return gather(
      "Let me have someone from the team call you back to find a time that works. What's your name?",
      "name"
    );
  }
  const s1 = slots[0]?.label || "today";
  const s2 = slots[1]?.label || "tomorrow";
  return gather(
    `We have availability ${s1} or ${s2}. Which works better for you?`,
    `${s1}, ${s2}, neither, call me back`
  );
}

function confirmBooking(session, biz) {
  const { customer_name, slot, issue_type, address } = session;
  const serviceLabel = getServiceLabel(issue_type, biz);
  const addr = address ? ` We'll be at ${address}.` : "";

  session.gate = GATES.END;
  return hangup(
    `Perfect, ${customer_name}. You're booked in for ${serviceLabel} ${slot.label}.${addr} ` +
    `I'll text a confirmation to ${session.customer_phone} right now. ` +
    `If anything changes, reply CANCEL to that message. Thanks for calling ${biz.name} — see you soon!`
  );
}

// ── Utility functions ────────────────────────────────────────────

function detectIssueType(text, bizType) {
  if (bizType === "hvac") {
    if (matchIntent(text, "ac"))          return "ac";
    if (matchIntent(text, "heating"))     return "heating";
    if (matchIntent(text, "install"))     return "installation";
    if (matchIntent(text, "maintenance")) return "maintenance";
  }
  if (bizType === "mechanic") {
    if (matchIntent(text, "brakes"))       return "brakes";
    if (matchIntent(text, "engine"))       return "engine";
    if (matchIntent(text, "wont_start"))   return "wont_start";
    if (matchIntent(text, "oil"))          return "oil";
    if (matchIntent(text, "tires"))        return "tires";
    if (matchIntent(text, "transmission")) return "transmission";
  }
  // Cross-type
  if (matchIntent(text, "price"))       return "price_query";
  if (matchIntent(text, "hours"))       return "hours_query";
  return null;
}

function getTriageQuestions(issueType, biz) {
  const q = biz.triage_questions || {};
  return q[issueType] || q.general || ["Can you describe the problem in a bit more detail?"];
}

function getPriceInfo(issueType, biz) {
  const svc = biz.services?.find(s => s.id === issueType || s.id.includes(issueType));
  if (svc) return `${svc.label} typically runs ${svc.price_range}.`;
  return `Pricing depends on the job. Diagnostics start at $85 and go toward the repair.`;
}

function getServiceLabel(issueType, biz) {
  const svc = biz.services?.find(s => s.id === issueType || s.id.includes(issueType));
  return svc?.label || "your service";
}

function formatHours(hours) {
  if (!hours) return "regular business hours";
  const parts = [];
  if (hours.weekday)  parts.push(`Monday through Friday ${hours.weekday}`);
  if (hours.saturday) parts.push(`Saturday ${hours.saturday}`);
  if (hours.sunday)   parts.push(`Sunday ${hours.sunday}`);
  return parts.join(", ");
}

function extractAddress(text) {
  // Simple heuristic: starts with a number followed by a word
  const m = text.match(/\d{1,5}\s+[A-Za-z][\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Blvd|Way|Court|Ct)/i);
  return m ? m[0] : null;
}

function extractPhone(text) {
  // Strip non-numeric, accept 10 or 11 digit strings
  const digits = text.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function capitalise(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase()).trim();
}

// ── Session cleanup ───────────────────────────────────────────────
function endSession(callSid) {
  const session = sessions.get(callSid);
  sessions.delete(callSid);
  return session;
}

function getSession(callSid) {
  return sessions.get(callSid);
}

// ── Pause/resume session (for owner takeover) ─────────────────────
function setSessionPaused(callSid, paused) {
  const session = sessions.get(callSid);
  if (session) {
    session.paused = paused;
    return true;
  }
  return false;
}

function isSessionPaused(callSid) {
  const session = sessions.get(callSid);
  return session?.paused || false;
}

// ── Get all active sessions (for recovery) ────────────────────────
function getAllSessions() {
  return Array.from(sessions.entries()).map(([callSid, session]) => ({
    callSid,
    gate: session.gate,
    disposition: session.disposition,
    createdAt: session.createdAt,
  }));
}

// ── Restore session from persistence ──────────────────────────────
function restoreSession(callSid, sessionData) {
  sessions.set(callSid, sessionData);
}

module.exports = {
  processInput,
  processFallback,
  endSession,
  getSession,
  setSessionPaused,
  isSessionPaused,
  getAllSessions,
  restoreSession,
  GATES,
  matchIntent,
  fuzzyMatchIntent,
};
