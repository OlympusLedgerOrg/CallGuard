// config/businesses.js
// Default AI config per business type.
// In production this lives in the `ai_config` JSON column on the businesses table.
// Ava reads this at call-start to know what questions to ask, what to quote, and when to escalate.

const DEFAULT_HVAC_CONFIG = {
  business_type: "hvac",
  name: "Apex HVAC & Mechanical",
  phone: "+18285550100",
  address: "204 Oak Ave, Boone NC 28607",
  hours: { weekday: "8am-6pm", saturday: "9am-1pm", sunday: "closed" },
  emergency_service: true,
  walk_ins: false,

  services: [
    { id: "ac_repair",       label: "AC Repair",          price_range: "$85–$400",  duration_mins: 60  },
    { id: "heating_repair",  label: "Heating Repair",     price_range: "$85–$350",  duration_mins: 60  },
    { id: "installation",    label: "System Install",     price_range: "call for quote", duration_mins: 240 },
    { id: "maintenance",     label: "Tune-up / Service",  price_range: "$89",       duration_mins: 45  },
    { id: "emergency",       label: "Emergency Call-out", price_range: "$125 diag", duration_mins: 90  },
  ],

  // Questions Ava asks during the call (max 2 per gate)
  triage_questions: {
    ac:      ["Is it completely off or just not cooling enough?", "When did it stop working?"],
    heating: ["Is there no heat at all, or is it underperforming?", "What type of system — gas, heat pump, or electric?"],
    general: ["Can you describe what's happening?", "How long has this been going on?"],
  },

  // Slots Ava can offer (in production: query real calendar)
  available_slots: [
    { label: "today at 3pm",       iso: "2026-04-03T15:00:00" },
    { label: "today at 4:30pm",    iso: "2026-04-03T16:30:00" },
    { label: "tomorrow at 9am",    iso: "2026-04-04T09:00:00" },
    { label: "tomorrow at 11am",   iso: "2026-04-04T11:00:00" },
  ],

  escalation_triggers: [
    "speak to someone",
    "talk to the owner",
    "this is urgent",
    "it's an emergency",
  ],

  sms_templates: {
    booking_confirm: "✅ Confirmed! {{service}} on {{date}} at {{time}}. {{business_name}} — {{address}}. Reply CANCEL to cancel.",
    missed_call:     "📞 Missed call from {{caller_number}} at {{time}}. No booking made. Reply to this message to follow up.",
    owner_alert:     "🔔 New job request: {{issue}} — {{customer_name}}, {{phone}}. Disposition: {{disposition}}.",
    follow_up:       "Hey {{name}}, this is {{business_name}}. Looks like we missed your call — how can we help? Call {{phone}} or reply here.",
  },
};

const DEFAULT_MECHANIC_CONFIG = {
  business_type: "mechanic",
  name: "Apex Auto",
  phone: "+18285550101",
  address: "310 West King St, Boone NC 28607",
  hours: { weekday: "9am-5pm", saturday: "9am-2pm", sunday: "closed" },
  emergency_service: false,
  walk_ins: true,

  services: [
    { id: "brakes",       label: "Brakes",            price_range: "$200–$400", duration_mins: 90  },
    { id: "diagnostics",  label: "Diagnostics",        price_range: "$85",       duration_mins: 60  },
    { id: "oil_change",   label: "Oil Change",         price_range: "$45–$85",   duration_mins: 30  },
    { id: "engine",       label: "Engine Repair",      price_range: "call for quote", duration_mins: 180 },
    { id: "tires",        label: "Tires / Alignment",  price_range: "$80–$600",  duration_mins: 60  },
  ],

  triage_questions: {
    brakes:     ["Is it a grinding noise, squealing, or does the pedal feel soft?", "Does it happen on all four corners or just one side?"],
    engine:     ["Is the check engine light on? Any smoke or unusual smells?", "Did it happen suddenly or gradually get worse?"],
    wont_start: ["Does it click when you turn the key, or is it completely silent?", "Are you able to jump-start it?"],
    general:    ["Can you describe the symptom?", "Is it driveable right now?"],
  },

  available_slots: [
    { label: "today at 10am",   iso: "2026-04-03T10:00:00" },
    { label: "today at 2pm",    iso: "2026-04-03T14:00:00" },
    { label: "tomorrow at 9am", iso: "2026-04-04T09:00:00" },
    { label: "this Saturday at 10am", iso: "2026-04-05T10:00:00" },
  ],

  escalation_triggers: [
    "tow truck",
    "stranded",
    "smoking",
    "accident",
    "won't start at all",
  ],

  sms_templates: {
    booking_confirm: "✅ Booked! {{service}} on {{date}} at {{time}}. {{business_name}} — {{address}}. Reply CANCEL to cancel.",
    missed_call:     "📞 Missed call from {{caller_number}} at {{time}}.",
    owner_alert:     "🔔 New job: {{issue}} — {{customer_name}}, {{phone}}.",
    follow_up:       "Hey {{name}}, this is {{business_name}}. We saw your call — still need help with your vehicle? Reply here or call {{phone}}.",
  },
};

module.exports = { DEFAULT_HVAC_CONFIG, DEFAULT_MECHANIC_CONFIG };
