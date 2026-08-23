const { cpu, mem } = require('./helpers');

// Hash estable de un string a un número en [0, 1) para asignar una fase por pod/nodo
// (así cada uno oscila desfasado del resto, en vez de todos a la vez).
function phaseFor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100000;
  return (h % 1000) / 1000;
}

function oscillate(base, amplitude, key, periodMs) {
  const phase = phaseFor(key) * Math.PI * 2;
  const t = Date.now() / periodMs;
  const jitter = (Math.sin(t * 13 + phase * 7) * 0.15 + (phaseFor(key + 'jitter') - 0.5) * 0.1) * amplitude;
  return Math.max(0, base + amplitude * Math.sin(t + phase) + jitter);
}

function parseCpuLimit(pod) {
  const raw = pod.spec.containers?.[0]?.resources?.limits?.cpu;
  if (!raw) return 500;
  return Number.parseFloat(raw);
}

function parseMemLimitMi(pod) {
  const raw = pod.spec.containers?.[0]?.resources?.limits?.memory;
  if (!raw) return 512;
  const match = String(raw).match(/^(\d+)Mi$/);
  if (match) return Number.parseInt(match[1], 10);
  const gi = String(raw).match(/^(\d+)Gi$/);
  if (gi) return Number.parseInt(gi[1], 10) * 1024;
  return 512;
}

// `image-processor` está deliberadamente cerca (a veces por encima) de su límite de CPU,
// para que la gráfica de histórico de uso (UsageHistoryChart) muestre algo visualmente notable.
const HOT_APP = 'image-processor';

function buildPodMetrics(pods) {
  const items = [];
  for (const pod of pods) {
    const status = pod.status.containerStatuses?.[0];
    if (!status || !status.ready) continue; // sin métricas para pods no-Running / no-ready, como el metrics-server real

    const cpuLimitM = parseCpuLimit(pod);
    const memLimitMi = parseMemLimitMi(pod);
    const key = `${pod.metadata.namespace}/${pod.metadata.name}`;
    const isHot = pod.metadata.labels?.app === HOT_APP;

    const cpuBase = isHot ? cpuLimitM * 0.85 : cpuLimitM * 0.35;
    const cpuAmplitude = isHot ? cpuLimitM * 0.3 : cpuLimitM * 0.15;
    const cpuUsage = oscillate(cpuBase, cpuAmplitude, key, 20000);

    const memBase = memLimitMi * 0.5;
    const memAmplitude = memLimitMi * 0.12;
    const memUsage = oscillate(memBase, memAmplitude, key + 'mem', 35000);

    items.push({
      metadata: { name: pod.metadata.name, namespace: pod.metadata.namespace },
      timestamp: new Date().toISOString(),
      window: '20s',
      containers: [{ name: pod.spec.containers[0].name, usage: { cpu: cpu(cpuUsage), memory: mem(memUsage) } }],
    });
  }
  return items;
}

function buildNodeMetrics(nodes) {
  const items = [];
  for (const node of nodes) {
    const ready = node.status.conditions.find((c) => c.type === 'Ready')?.status === 'True';
    if (!ready) continue;
    const capacityCpu = Number.parseFloat(node.status.capacity.cpu) * 1000;
    const capacityMemMi = Number.parseInt(node.status.capacity.memory, 10) * 1024;
    const key = node.metadata.name;
    const cpuUsage = oscillate(capacityCpu * 0.4, capacityCpu * 0.12, key, 25000);
    const memUsage = oscillate(capacityMemMi * 0.55, capacityMemMi * 0.08, key + 'mem', 40000);
    items.push({
      metadata: { name: node.metadata.name },
      timestamp: new Date().toISOString(),
      window: '20s',
      usage: { cpu: cpu(cpuUsage), memory: mem(memUsage) },
    });
  }
  return items;
}

module.exports = { buildPodMetrics, buildNodeMetrics };
