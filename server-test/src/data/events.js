const { uid, isoAgo, MINUTE, HOUR } = require('./helpers');

let counter = 0;
function eventName(involvedObjectName) {
  counter += 1;
  return `${involvedObjectName}.${(17000000000000 + counter).toString(16)}`;
}

function involvedObjectFor(resource, kind) {
  return {
    kind,
    namespace: resource.metadata.namespace || undefined,
    name: resource.metadata.name,
    uid: resource.metadata.uid,
    apiVersion: resource.apiVersion,
    resourceVersion: resource.metadata.resourceVersion,
  };
}

function makeEvent({ involvedObject, reason, message, type = 'Normal', ageMs, count = 1, component = 'default-scheduler', namespace }) {
  return {
    apiVersion: 'v1',
    kind: 'Event',
    metadata: { name: eventName(involvedObject.name), namespace: namespace ?? involvedObject.namespace, uid: uid(), creationTimestamp: isoAgo(ageMs) },
    involvedObject,
    reason,
    message,
    type,
    count,
    firstTimestamp: isoAgo(ageMs + count * MINUTE),
    lastTimestamp: isoAgo(ageMs),
    source: { component, host: undefined },
  };
}

function podStartupEvents(pod, ageMs) {
  const podRef = involvedObjectFor(pod, 'Pod');
  const containerName = pod.spec.containers[0].name;
  const image = pod.spec.containers[0].image;
  return [
    makeEvent({ involvedObject: podRef, reason: 'Scheduled', message: `Successfully assigned ${pod.metadata.namespace}/${pod.metadata.name} to ${pod.spec.nodeName}`, ageMs: ageMs + 40 * 1000, component: 'default-scheduler' }),
    makeEvent({ involvedObject: podRef, reason: 'Pulled', message: `Container image "${image}" already present on machine`, ageMs: ageMs + 20 * 1000, component: 'kubelet' }),
    makeEvent({ involvedObject: podRef, reason: 'Created', message: `Created container ${containerName}`, ageMs: ageMs + 10 * 1000, component: 'kubelet' }),
    makeEvent({ involvedObject: podRef, reason: 'Started', message: `Started container ${containerName}`, ageMs, component: 'kubelet' }),
  ];
}

function buildEvents(resources, meta) {
  const events = [];

  // Normal startup for a sample of healthy pods, so the Events view has "background" volume.
  const healthyPods = resources.pods.filter((p) => p.status.phase === 'Running' && p.status.containerStatuses?.[0]?.ready).slice(0, 22);
  for (const pod of healthyPods) {
    const ageMs = 5 * MINUTE + Math.floor(Math.random() * 110) * MINUTE;
    events.push(...podStartupEvents(pod, ageMs));
  }

  // Pod in CrashLoopBackOff.
  if (meta.crashloopPod) {
    const pod = meta.crashloopPod;
    const podRef = involvedObjectFor(pod, 'Pod');
    const containerName = pod.spec.containers[0].name;
    const image = pod.spec.containers[0].image;
    events.push(
      makeEvent({ involvedObject: podRef, reason: 'Scheduled', message: `Successfully assigned ${pod.metadata.namespace}/${pod.metadata.name} to ${pod.spec.nodeName}`, ageMs: 90 * MINUTE, component: 'default-scheduler' }),
      makeEvent({ involvedObject: podRef, reason: 'Pulled', message: `Container image "${image}" already present on machine`, ageMs: 89 * MINUTE, component: 'kubelet' }),
      makeEvent({ involvedObject: podRef, reason: 'Started', message: `Started container ${containerName}`, ageMs: 45 * MINUTE, count: 13, component: 'kubelet' }),
      makeEvent({ involvedObject: podRef, reason: 'BackOff', message: `Back-off restarting failed container ${containerName} in pod ${pod.metadata.name}_${pod.metadata.namespace}(${pod.metadata.uid})`, type: 'Warning', ageMs: 2 * MINUTE, count: 14, component: 'kubelet' }),
      makeEvent({ involvedObject: podRef, reason: 'Unhealthy', message: `Container ${containerName} was OOMKilled`, type: 'Warning', ageMs: 3 * MINUTE, count: 6, component: 'kubelet' }),
    );
  }

  // Pod in ImagePullBackOff.
  if (meta.imagePullBackOffPod) {
    const pod = meta.imagePullBackOffPod;
    const podRef = involvedObjectFor(pod, 'Pod');
    const image = pod.spec.containers[0].image;
    events.push(
      makeEvent({ involvedObject: podRef, reason: 'Scheduled', message: `Successfully assigned ${pod.metadata.namespace}/${pod.metadata.name} to ${pod.spec.nodeName}`, ageMs: 30 * MINUTE, component: 'default-scheduler' }),
      makeEvent({
        involvedObject: podRef,
        reason: 'Failed',
        message: `Failed to pull image "${image}": rpc error: code = NotFound desc = failed to pull and unpack image "${image}": failed to resolve reference: not found`,
        type: 'Warning',
        ageMs: 25 * MINUTE,
        count: 4,
        component: 'kubelet',
      }),
      makeEvent({ involvedObject: podRef, reason: 'BackOff', message: `Back-off pulling image "${image}"`, type: 'Warning', ageMs: 4 * MINUTE, count: 9, component: 'kubelet' }),
    );
  }

  // Pod pending with no resources available.
  if (meta.pendingPod) {
    const pod = meta.pendingPod;
    const podRef = involvedObjectFor(pod, 'Pod');
    events.push(
      makeEvent({
        involvedObject: podRef,
        reason: 'FailedScheduling',
        message: '0/5 nodes are available: 3 Insufficient cpu, 1 node(s) had untolerated taint {node.kubernetes.io/unreachable: }, 1 node(s) were unschedulable.',
        type: 'Warning',
        ageMs: 4 * MINUTE,
        count: 8,
        component: 'default-scheduler',
      }),
    );
  }

  // NotReady node.
  if (meta.notReadyNode) {
    const node = meta.notReadyNode;
    const nodeRef = involvedObjectFor(node, 'Node');
    events.push(
      makeEvent({ involvedObject: nodeRef, reason: 'NodeNotReady', message: `Node ${node.metadata.name} status is now: NodeNotReady`, type: 'Warning', ageMs: 14 * MINUTE, component: 'node-controller' }),
      makeEvent({ involvedObject: nodeRef, reason: 'NodeNotSchedulable', message: `Node ${node.metadata.name} status is now: NodeNotSchedulable`, type: 'Warning', ageMs: 13 * MINUTE, component: 'kubelet' }),
    );
  }

  // Failed job.
  if (meta.failedJob) {
    const job = meta.failedJob;
    const jobRef = involvedObjectFor(job, 'Job');
    events.push(
      makeEvent({ involvedObject: jobRef, reason: 'SuccessfulCreate', message: `Created pod: ${job.metadata.name}-x`, ageMs: 6 * HOUR + 2 * MINUTE, component: 'job-controller' }),
      makeEvent({ involvedObject: jobRef, reason: 'BackoffLimitExceeded', message: 'Job has reached the specified backoff limit', type: 'Warning', ageMs: 5 * HOUR + 45 * MINUTE, component: 'job-controller' }),
    );
    if (meta.failedJobCronJob) {
      const cronRef = involvedObjectFor(meta.failedJobCronJob, 'CronJob');
      events.push(makeEvent({ involvedObject: cronRef, reason: 'SawCompletedJob', message: `Saw completed job: ${job.metadata.name}, status: Failed`, type: 'Warning', ageMs: 5 * HOUR + 44 * MINUTE, component: 'cronjob-controller' }));
    }
  }

  // CronJobs: SuccessfulCreate for each registered Job.
  for (const job of resources.jobs) {
    const ownerRef = (job.metadata.ownerReferences || [])[0];
    if (!ownerRef) continue;
    const cronJob = resources.cronjobs.find((c) => c.metadata.uid === ownerRef.uid);
    if (!cronJob) continue;
    const cronRef = involvedObjectFor(cronJob, 'CronJob');
    const jobAgeMs = Date.now() - new Date(job.metadata.creationTimestamp).getTime();
    events.push(makeEvent({ involvedObject: cronRef, reason: 'SuccessfulCreate', message: `Created job ${job.metadata.name}`, ageMs: jobAgeMs, component: 'cronjob-controller' }));
  }

  // HPA: a rescale event for the worker under pressure.
  const workerHpa = resources.horizontalpodautoscalers.find((h) => h.metadata.name === 'core-api-worker');
  if (workerHpa) {
    const hpaRef = involvedObjectFor(workerHpa, 'HorizontalPodAutoscaler');
    events.push(
      makeEvent({
        involvedObject: hpaRef,
        reason: 'SuccessfulRescale',
        message: 'New size: 4; reason: cpu resource utilization (percentage of request) above target',
        ageMs: 38 * MINUTE,
        component: 'horizontal-pod-autoscaler',
      }),
    );
  }

  return events.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
}

module.exports = { buildEvents };
