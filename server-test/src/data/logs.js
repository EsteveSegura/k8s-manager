function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function hex(len) {
  let out = '';
  while (out.length < len) out += Math.floor(Math.random() * 16).toString(16);
  return out.slice(0, len);
}

function ip() {
  return `10.4.${randomInt(0, 3)}.${randomInt(2, 250)}`;
}

// Each role has a list of templates (functions) instead of fixed lines: each
// call generates different values (ids, durations, ips...) so that two pods of the
// same role -or two requests to the same pod- don't repeat exactly the same log line.
const ROLE_TEMPLATES = {
  api: [
    () => `level=info msg="incoming request" method=${pick(['GET', 'GET', 'POST'])} path=${pick(['/v1/health', '/v1/mix/render', '/v1/voices', '/v1/auth/refresh', '/v1/user/preferences', '/v1/presets', '/v1/session'])} status=${pick([200, 200, 200, 201, 204, 400, 404, 500])} duration_ms=${randomInt(2, 320)}`,
    () => `level=info msg="cache hit" key=voices:catalog:v${randomInt(1, 5)}`,
    () => `level=info msg="cache miss" key=user:prefs:u_${randomInt(1000, 99999)}`,
    () => `level=warn msg="slow downstream call" service=${pick(['billing-service', 'auth-service', 'redis-proxy'])} duration_ms=${randomInt(400, 1200)}`,
    () => `level=info msg="rate limit check" client_ip=${ip()} remaining=${randomInt(0, 1000)}`,
    () => `level=info msg="request completed" request_id=${hex(8)} status=${pick([200, 200, 201, 304])}`,
  ],
  'core-api-worker': [
    () => `level=info msg="picked up job" queue=render-queue job_id=${hex(6)}`,
    () => `level=info msg="processing render job" job_id=${hex(6)} voice=${pick(['robot', 'deep', 'helium', 'radio', 'alien', 'chorus'])}`,
    () => `level=info msg="render complete" job_id=${hex(6)} duration_ms=${randomInt(80, 950)}`,
    () => `level=warn msg="retrying job" job_id=${hex(6)} attempt=${randomInt(2, 4)}`,
    () => `level=info msg="queue depth" queue=render-queue size=${randomInt(0, 40)}`,
  ],
  'web-frontend': [
    () => `${ip()} - - "GET / HTTP/1.1" 200 ${randomInt(2000, 5000)}`,
    () => `${ip()} - - "GET /assets/app.js HTTP/1.1" 200 ${randomInt(60000, 95000)}`,
    () => `${ip()} - - "GET /assets/app.css HTTP/1.1" 200 ${randomInt(9000, 18000)}`,
    () => `${ip()} - - "GET /favicon.ico HTTP/1.1" ${pick([200, 304])} ${randomInt(0, 600)}`,
    () => `${ip()} - - "GET /api/health HTTP/1.1" 200 ${randomInt(10, 60)}`,
    () => `${ip()} - - "GET /assets/logo.svg HTTP/1.1" ${pick([200, 304])} ${randomInt(400, 3000)}`,
  ],
  'auth-service': [
    () => `level=info msg="token issued" user_id=u_${randomInt(1000, 99999)} ttl=3600`,
    () => `level=info msg="token refreshed" user_id=u_${randomInt(1000, 99999)}`,
    () => `level=info msg="login success" user_id=u_${randomInt(1000, 99999)} provider=${pick(['google', 'github', 'password'])}`,
    () => `level=warn msg="login failed" reason=${pick(['invalid_password', 'unknown_user', 'expired_code'])} attempts=${randomInt(1, 4)}`,
  ],
  'billing-service': [
    () => `level=info msg="invoice generated" account_id=acc_${randomInt(1000, 9999)} amount_cents=${randomInt(499, 9999)}`,
    () => `level=info msg="webhook received" provider=stripe event=${pick(['invoice.paid', 'invoice.payment_failed', 'customer.updated'])}`,
    () => `level=info msg="subscription renewed" account_id=acc_${randomInt(1000, 9999)} plan=${pick(['pro', 'team', 'enterprise'])}`,
  ],
  'image-processor': [
    () => `level=info msg="processing image" job_id=img_${randomInt(1000, 9999)} format=${pick(['png', 'jpeg', 'webp'])}`,
    () => `level=info msg="resize complete" job_id=img_${randomInt(1000, 9999)} duration_ms=${randomInt(80, 450)}`,
    () => `level=info msg="uploading result" job_id=img_${randomInt(1000, 9999)} bucket=media-assets`,
  ],
  'redis-proxy': [
    () => `level=info msg="connection accepted" client=${ip()}:${randomInt(1024, 65000)}`,
    () => `level=info msg="command" cmd=${pick(['GET', 'SET', 'DEL', 'EXPIRE'])} key=session:${randomInt(1000, 9999)}`,
    () => `level=info msg="command" cmd=SET key=session:${randomInt(1000, 9999)} ttl=${pick([300, 900, 1800])}`,
  ],
  postgresql: [
    () => 'LOG:  database system is ready to accept connections',
    () => `LOG:  checkpoint starting: ${pick(['time', 'wal', 'immediate'])}`,
    () => `LOG:  checkpoint complete: wrote ${randomInt(40, 300)} buffers (${(Math.random() * 2).toFixed(1)}%)`,
    () => 'LOG:  autovacuum launcher started',
    () => `LOG:  automatic vacuum of table "public.${pick(['users', 'sessions', 'jobs', 'events'])}"`,
  ],
  'redis-cluster': [
    () => '* Ready to accept connections tcp',
    () => `* ${randomInt(1, 40)} changes in 900 seconds. Saving...`,
    () => '* Background saving terminated with success',
    () => `* DB saved on disk in ${(Math.random() * 2).toFixed(3)} seconds`,
  ],
  kafka: [
    () => '[KafkaServer id=0] started (kafka.server.KafkaServer)',
    () => `[GroupCoordinator 0]: Assignment received from leader for group ${pick(['render-consumers', 'billing-consumers', 'audit-consumers'])}`,
    () => `[Log partition=events-${randomInt(0, 5)}] Rolled new log segment`,
  ],
  grafana: [
    () => 'logger=http.server t=now level=info msg="HTTP Server Listen" address=[::]:3000',
    () => 'logger=provisioning.datasources t=now level=info msg="inserting datasource from configuration"',
    () => `logger=context t=now level=info msg="Request Completed" status=${pick([200, 200, 302])} duration_ms=${randomInt(3, 90)}`,
  ],
  'prometheus-adapter': [
    () => 'I metrics_server.go: Generating self-signed cert',
    () => 'I serve.go: Serving securely on [::]:6443',
    () => `I request.go: scraped ${randomInt(200, 900)} series`,
  ],
  'ingress-nginx-controller': [
    () => `${ip()} - - "GET /healthz HTTP/1.1" 200`,
    () => 'I controller.go: Backend successfully reloaded',
    () => `${ip()} - - "GET / HTTP/1.1" ${pick([200, 301, 404])}`,
  ],
  'node-exporter': [
    () => 'level=info msg="Starting node_exporter" version=1.8.1',
    () => 'level=info msg="Listening on address :9100"',
    () => `level=info msg="collected metrics" duration_ms=${randomInt(2, 20)}`,
  ],
  'fluent-bit': [
    () => '[info] [engine] started',
    () => `[info] [input:tail] inotify_fs_add(): inode=${randomInt(900, 2000)} watch_fd=${randomInt(1, 10)}`,
    () => `[info] [output:es] flushed ${randomInt(10, 300)} records`,
  ],
  'db-backup': [
    () => 'level=info msg="starting dump of database app_prod"',
    () => `level=info msg="dump finished" size_mb=${randomInt(380, 620)}`,
    () => 'level=info msg="uploading to gs://demo-backups/"',
  ],
  'report-generator': [
    () => 'level=info msg="generating weekly usage report"',
    () => `level=info msg="report generated" file=report-${randomInt(1, 28)}.csv`,
    () => 'level=info msg="uploaded to gs://demo-reports/"',
  ],
  'notification-service': [
    () => `level=info msg="sending push notification" user_id=u_${randomInt(1000, 99999)}`,
    () => `level=info msg="notification delivered" user_id=u_${randomInt(1000, 99999)} latency_ms=${randomInt(40, 600)}`,
    () => `level=warn msg="notification bounced" user_id=u_${randomInt(1000, 99999)} reason=token_expired`,
  ],
};

function roleFor(pod) {
  return pod.metadata.labels?.app || 'api';
}

function templatesForRole(role) {
  if (ROLE_TEMPLATES[role]) return ROLE_TEMPLATES[role];
  const strippedNumericSuffix = role.replace(/-\d+$/, '');
  return ROLE_TEMPLATES[strippedNumericSuffix] || ROLE_TEMPLATES.api;
}

// Picks the next template at random, avoiding repeating the same one twice
// in a row, so the log window doesn't look like a robotic loop.
function nextTemplateIndex(templates, lastIndex) {
  if (templates.length === 1) return 0;
  let index = lastIndex;
  while (index === lastIndex) index = randomInt(0, templates.length - 1);
  return index;
}

function formatLine(text, timeMs, timestamps) {
  return timestamps ? `${new Date(timeMs).toISOString()} ${text}` : text;
}

// Throws an error with `code`/`message` mimicking what @kubernetes/client-node does
// when the container has never managed to start (`readNamespacedPodLog` returns 400).
class PodLogError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function getPodLogs(pod, meta, { container, tailLines = 200, timestamps = false }) {
  const containers = pod.spec.containers || [];
  const containerName = container || containers[0]?.name;
  const status = (pod.status.containerStatuses || []).find((cs) => cs.name === containerName);

  if (pod.status.phase === 'Pending' && !status) {
    throw new PodLogError(400, `container "${containerName}" in pod "${pod.metadata.name}" is waiting to start: PodInitializing`);
  }
  if (status?.state?.waiting && !status.lastState?.terminated) {
    throw new PodLogError(400, `container "${containerName}" in pod "${pod.metadata.name}" is waiting to start: ${status.state.waiting.reason}`);
  }

  const role = roleFor(pod);
  const templates = templatesForRole(role);
  const now = Date.now();
  const isCrashloop = pod === meta.crashloopPod;
  const total = Math.min(tailLines, isCrashloop ? 46 : 60);

  const lines = [];
  let lastIndex = -1;
  let timeMs = now - total * randomInt(1500, 5000);
  for (let i = 0; i < total; i++) {
    lastIndex = nextTemplateIndex(templates, lastIndex);
    lines.push(formatLine(templates[lastIndex](), timeMs, timestamps));
    timeMs += randomInt(400, 6000);
  }

  if (isCrashloop) {
    const panicAt = now - 3000;
    lines.push(
      formatLine(`level=error msg="unhandled exception while processing job" job_id=${hex(6)} error="out of memory"`, panicAt, timestamps),
      formatLine('panic: runtime: out of memory', panicAt + 200, timestamps),
      formatLine('goroutine 42 [running]:', panicAt + 210, timestamps),
      formatLine('main.processRenderJob(...)', panicAt + 220, timestamps),
      formatLine(`\t/app/worker/render.go:${randomInt(80, 160)} +0x2a4`, panicAt + 230, timestamps),
      formatLine('Back-off restarting failed container', panicAt + 500, timestamps),
    );
  }

  return lines.slice(-tailLines);
}

module.exports = { getPodLogs, PodLogError };
