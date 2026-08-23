const crypto = require('node:crypto');

const START_TIME = Date.now();

function uid() {
  return crypto.randomUUID();
}

let resourceVersionCounter = 100000;
function nextResourceVersion() {
  resourceVersionCounter += 1;
  return String(resourceVersionCounter);
}

// Timestamp ISO relativo al arranque del proceso, `msAgo` milisegundos atrás.
function isoAgo(msAgo) {
  return new Date(START_TIME - msAgo).toISOString();
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function cpu(millicores) {
  return `${Math.round(millicores)}m`;
}

function mem(mebibytes) {
  if (mebibytes >= 1024 && mebibytes % 1024 === 0) return `${mebibytes / 1024}Gi`;
  return `${Math.round(mebibytes)}Mi`;
}

function metadata({ name, namespace, labels = {}, annotations, ownerReferences, extraAgeMs = 3 * DAY }) {
  const meta = {
    name,
    uid: uid(),
    resourceVersion: nextResourceVersion(),
    creationTimestamp: isoAgo(extraAgeMs),
    labels,
  };
  if (namespace) meta.namespace = namespace;
  if (annotations) meta.annotations = annotations;
  if (ownerReferences) meta.ownerReferences = ownerReferences;
  return meta;
}

function labelsFor(app, namespace, extra = {}) {
  return {
    app,
    'app.kubernetes.io/name': app,
    'app.kubernetes.io/instance': app,
    'app.kubernetes.io/managed-by': 'Helm',
    namespace,
    ...extra,
  };
}

module.exports = {
  uid,
  nextResourceVersion,
  isoAgo,
  MINUTE,
  HOUR,
  DAY,
  cpu,
  mem,
  metadata,
  labelsFor,
};
