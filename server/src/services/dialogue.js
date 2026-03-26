/**
 * Dialogue engine – classifies caller intent and produces a reply.
 *
 * In production this would call an LLM (e.g. OpenAI). The built-in local
 * engine uses simple keyword matching so the system works without an API key.
 */

// Intent order matters – more specific intents are checked first.
const INTENT_LIST = [
  {
    name: "emergency",
    keywords: ["emergency", "urgent", "pain", "broken", "leak", "flood"],
    response:
      "I understand this is urgent. Let me connect you with our on-call team right away. Please hold for just a moment.",
  },
  {
    name: "cancel",
    keywords: ["cancel", "reschedule", "change appointment", "move appointment"],
    response:
      "I can help you with that. Could you please provide your name or the appointment reference so I can look it up?",
  },
  {
    name: "thanks",
    keywords: ["thank", "thanks", "bye", "goodbye", "that's all"],
    response:
      "You're welcome! Thanks for calling CallGuard. Have a great day!",
  },
  {
    name: "booking",
    keywords: ["book", "appointment", "schedule", "reserve", "available", "slot", "opening"],
    response:
      "I'd be happy to help you book an appointment! Let me check our availability. What service are you looking for?",
  },
  {
    name: "hours",
    keywords: ["hours", "open", "close", "when are you"],
    response:
      "Our office hours are Monday through Friday, 9 AM to 5 PM. Would you like to schedule an appointment during those hours?",
  },
  {
    name: "services",
    keywords: ["service", "offer", "provide", "what do you", "menu", "options", "price", "cost"],
    response:
      "We offer a full range of services. I can help you book any of them. Would you like to hear more details or go ahead and schedule?",
  },
  {
    name: "greeting",
    keywords: ["hello", "good morning", "good afternoon"],
    patterns: [/\bhi\b/i, /\bhey\b/i],
    response:
      "Hello! Thanks for calling CallGuard. How can I help you today? I can help you book an appointment, answer questions about our services, or connect you with our team.",
  },
];

const FALLBACK = {
  name: "fallback",
  response:
    "I'm sorry, I didn't quite catch that. Could you please repeat or let me know if you'd like to book an appointment, learn about our services, or speak with our team?",
};

// Build a lookup map for external consumers (e.g. tests that check INTENTS)
const INTENTS = {};
for (const intent of INTENT_LIST) {
  INTENTS[intent.name] = { keywords: intent.keywords, response: intent.response };
}
INTENTS.fallback = { keywords: [], response: FALLBACK.response };

/**
 * Classify a text utterance into an intent.
 * @param {string} text – caller's spoken text (from STT)
 * @returns {{ intent: string, response: string }}
 */
function classifyIntent(text) {
  const lower = (text || "").toLowerCase();

  for (const { name, keywords, patterns, response } of INTENT_LIST) {
    const keywordMatch = keywords.some((kw) => lower.includes(kw));
    const patternMatch = (patterns || []).some((re) => re.test(lower));
    if (keywordMatch || patternMatch) {
      return { intent: name, response };
    }
  }

  return { intent: "fallback", response: FALLBACK.response };
}

/**
 * Produce a dialogue reply for a given call.
 * Maintains a simple turn history keyed by callSid.
 */
const sessions = new Map();

function getReply(callSid, userText) {
  if (!sessions.has(callSid)) {
    sessions.set(callSid, []);
  }
  const history = sessions.get(callSid);
  const { intent, response } = classifyIntent(userText);
  history.push({ role: "user", text: userText, intent });
  history.push({ role: "assistant", text: response, intent });
  return { intent, response, turnCount: history.length / 2 };
}

function endSession(callSid) {
  sessions.delete(callSid);
}

function getSession(callSid) {
  return sessions.get(callSid) || [];
}

module.exports = { classifyIntent, getReply, endSession, getSession, INTENTS };
