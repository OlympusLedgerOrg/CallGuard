const metrics = {
  startTime: Date.now(),
  requestsTotal: 0,
  inflight: 0,
  durationMsSum: 0,
  durationMsCount: 0,
  responsesByStatus: new Map(),
};

function recordRequest(status, durationMs) {
  metrics.requestsTotal += 1;
  metrics.durationMsSum += durationMs;
  metrics.durationMsCount += 1;
  const current = metrics.responsesByStatus.get(status) || 0;
  metrics.responsesByStatus.set(status, current + 1);
}

function incrementInflight() {
  metrics.inflight += 1;
}

function decrementInflight() {
  metrics.inflight = Math.max(0, metrics.inflight - 1);
}

function formatPrometheus() {
  const lines = [];
  lines.push("# HELP callguard_requests_total Total HTTP requests.");
  lines.push("# TYPE callguard_requests_total counter");
  lines.push(`callguard_requests_total ${metrics.requestsTotal}`);
  lines.push("# HELP callguard_inflight_requests Inflight HTTP requests.");
  lines.push("# TYPE callguard_inflight_requests gauge");
  lines.push(`callguard_inflight_requests ${metrics.inflight}`);
  lines.push("# HELP callguard_request_duration_ms Request duration in milliseconds.");
  lines.push("# TYPE callguard_request_duration_ms summary");
  lines.push(`callguard_request_duration_ms_sum ${metrics.durationMsSum}`);
  lines.push(`callguard_request_duration_ms_count ${metrics.durationMsCount}`);
  lines.push("# HELP callguard_responses_total HTTP responses by status.");
  lines.push("# TYPE callguard_responses_total counter");
  for (const [status, count] of metrics.responsesByStatus.entries()) {
    lines.push(`callguard_responses_total{status="${status}"} ${count}`);
  }
  lines.push("# HELP callguard_uptime_seconds Process uptime in seconds.");
  lines.push("# TYPE callguard_uptime_seconds gauge");
  lines.push(`callguard_uptime_seconds ${Math.floor((Date.now() - metrics.startTime) / 1000)}`);
  return lines.join("\n");
}

module.exports = {
  recordRequest,
  incrementInflight,
  decrementInflight,
  formatPrometheus,
};
