const { isoAgo, MINUTE, HOUR, DAY, cpu, mem, metadata, labelsFor, uid } = require('./helpers');

const crypto = require('node:crypto');

function shortHash(len = 5) {
  return crypto.randomBytes(4).toString('hex').slice(0, len);
}

function fakeDigest(seed) {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function podIp(counter) {
  const n = counter.value++;
  return `10.4.${Math.floor(n / 254)}.${(n % 254) + 1}`;
}

function nodeInternalIp(index) {
  return `10.128.0.${index + 10}`;
}

// ---------------------------------------------------------------------------
// Nodos
// ---------------------------------------------------------------------------

function buildNode({ name, pool, ready }, index) {
  const capacity = pool === 'db' ? { cpu: '8', memory: '32Gi', pods: '110' } : { cpu: '4', memory: '16Gi', pods: '110' };
  return {
    apiVersion: 'v1',
    kind: 'Node',
    metadata: metadata({
      name,
      labels: {
        'kubernetes.io/hostname': name,
        'node.kubernetes.io/instance-type': pool === 'db' ? 'n2-highmem-8' : 'e2-standard-4',
        'topology.kubernetes.io/zone': 'europe-west1-b',
        'cloud.google.com/gke-nodepool': `${pool}-pool`,
      },
      extraAgeMs: 30 * DAY,
    }),
    spec: { podCIDR: `10.4.${index}.0/24`, unschedulable: ready ? undefined : true },
    status: {
      capacity,
      allocatable: capacity,
      nodeInfo: {
        kubeletVersion: 'v1.29.4-gke.1043002',
        osImage: 'Container-Optimized OS from Google',
        containerRuntimeVersion: 'containerd://1.7.13',
        kernelVersion: '6.1.78+',
        architecture: 'amd64',
      },
      conditions: [
        {
          type: 'Ready',
          status: ready ? 'True' : 'False',
          reason: ready ? 'KubeletReady' : 'KubeletNotReady',
          message: ready ? 'kubelet is posting ready status' : 'container runtime network not ready: NetworkNotReady',
          lastHeartbeatTime: isoAgo(1 * MINUTE),
          lastTransitionTime: isoAgo(ready ? 20 * DAY : 14 * MINUTE),
        },
        { type: 'MemoryPressure', status: 'False', reason: 'KubeletHasSufficientMemory', lastHeartbeatTime: isoAgo(1 * MINUTE), lastTransitionTime: isoAgo(20 * DAY) },
        { type: 'DiskPressure', status: 'False', reason: 'KubeletHasNoDiskPressure', lastHeartbeatTime: isoAgo(1 * MINUTE), lastTransitionTime: isoAgo(20 * DAY) },
      ],
      addresses: [
        { type: 'InternalIP', address: nodeInternalIp(index) },
        { type: 'Hostname', address: name },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Pods + apps (Deployment / StatefulSet / DaemonSet)
// ---------------------------------------------------------------------------

function buildContainerSpec({ name, image, port, cpuRequest, cpuLimit, memRequest, memLimit, env, envFrom, volumeMounts }) {
  const container = {
    name,
    image,
    imagePullPolicy: 'IfNotPresent',
    resources: {
      requests: { cpu: cpu(cpuRequest), memory: mem(memRequest) },
      limits: { cpu: cpu(cpuLimit), memory: mem(memLimit) },
    },
  };
  if (port) container.ports = [{ name: 'http', containerPort: port, protocol: 'TCP' }];
  if (env) container.env = env;
  if (envFrom) container.envFrom = envFrom;
  if (volumeMounts) container.volumeMounts = volumeMounts;
  return container;
}

function buildContainerStatus({ name, image, special, restartAgeMs }) {
  if (special === 'crashloop') {
    return {
      name,
      image,
      imageID: `${image}@sha256:${fakeDigest(name)}`,
      ready: false,
      started: false,
      restartCount: 14,
      state: {
        waiting: {
          reason: 'CrashLoopBackOff',
          message: 'back-off 5m0s restarting failed container=' + name,
        },
      },
      lastState: {
        terminated: {
          reason: 'OOMKilled',
          exitCode: 137,
          startedAt: isoAgo(restartAgeMs + 4 * MINUTE),
          finishedAt: isoAgo(restartAgeMs),
        },
      },
    };
  }
  if (special === 'imagepullbackoff') {
    return {
      name,
      image,
      ready: false,
      started: false,
      restartCount: 0,
      state: {
        waiting: {
          reason: 'ImagePullBackOff',
          message: `Back-off pulling image "${image}"`,
        },
      },
      lastState: {},
    };
  }
  return {
    name,
    image,
    imageID: `${image}@sha256:${fakeDigest(name)}`,
    ready: true,
    started: true,
    restartCount: 0,
    state: { running: { startedAt: isoAgo(restartAgeMs) } },
    lastState: {},
  };
}

// Genera los pods de un "app" (Deployment/StatefulSet/DaemonSet). `specialByIndex`
// permite forzar algún pod concreto a un estado no sano (crashloop/imagepullbackoff/pending)
// para alimentar la demo de Dashboard/Events/Logs.
function buildPods({ ownerName, namespace, replicas, image, port, cpuRequest, cpuLimit, memRequest, memLimit, env, envFrom, volumes, volumeMounts, nodeNames, ipCounter, extraLabels = {}, specialByIndex = {}, statefulOrdinals = false }) {
  const labels = { ...labelsFor(ownerName, namespace), ...extraLabels };
  const pods = [];
  for (let i = 0; i < replicas; i++) {
    const special = specialByIndex[i];
    const podName = statefulOrdinals ? `${ownerName}-${i}` : `${ownerName}-${shortHash(9)}-${shortHash(5)}`;
    const containerSpec = buildContainerSpec({ name: ownerName, image, port, cpuRequest, cpuLimit, memRequest, memLimit, env, envFrom, volumeMounts });

    if (special === 'pending') {
      pods.push({
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: metadata({ name: podName, namespace, labels, extraAgeMs: 4 * MINUTE }),
        spec: { containers: [containerSpec], restartPolicy: 'Always', volumes },
        status: {
          phase: 'Pending',
          conditions: [{ type: 'PodScheduled', status: 'False', reason: 'Unschedulable', message: '0/5 nodes are available: insufficient cpu.' }],
        },
      });
      continue;
    }

    const nodeName = nodeNames[i % nodeNames.length];
    const restartAgeMs = (6 + i) * HOUR;
    const containerStatus = buildContainerStatus({ name: ownerName, image, special, restartAgeMs: special ? 25 * MINUTE : restartAgeMs });
    const phase = 'Running';
    const podIpValue = podIp(ipCounter);

    pods.push({
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: metadata({ name: podName, namespace, labels, extraAgeMs: restartAgeMs + 2 * MINUTE }),
      spec: {
        nodeName,
        containers: [containerSpec],
        restartPolicy: 'Always',
        volumes,
      },
      status: {
        phase,
        podIP: podIpValue,
        podIPs: [{ ip: podIpValue }],
        hostIP: nodeName ? undefined : undefined,
        startTime: isoAgo(restartAgeMs),
        conditions: [
          { type: 'Initialized', status: 'True' },
          { type: 'Ready', status: containerStatus.ready ? 'True' : 'False' },
          { type: 'ContainersReady', status: containerStatus.ready ? 'True' : 'False' },
          { type: 'PodScheduled', status: 'True' },
        ],
        containerStatuses: [containerStatus],
      },
    });
  }
  return pods;
}

function buildDeployment({ name, namespace, replicas, readyReplicas }) {
  const labels = labelsFor(name, namespace);
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: metadata({ name, namespace, labels, extraAgeMs: 20 * DAY }),
    spec: {
      replicas,
      selector: { matchLabels: { app: name } },
      strategy: { type: 'RollingUpdate', rollingUpdate: { maxSurge: '25%', maxUnavailable: '25%' } },
      template: { metadata: { labels }, spec: {} },
    },
    status: {
      replicas,
      readyReplicas,
      availableReplicas: readyReplicas,
      updatedReplicas: replicas,
      observedGeneration: 4,
      conditions: [
        {
          type: 'Available',
          status: readyReplicas === replicas ? 'True' : 'False',
          reason: readyReplicas === replicas ? 'MinimumReplicasAvailable' : 'MinimumReplicasUnavailable',
          message: readyReplicas === replicas ? 'Deployment has minimum availability.' : 'Deployment does not have minimum availability.',
          lastTransitionTime: isoAgo(25 * MINUTE),
        },
        { type: 'Progressing', status: 'True', reason: 'NewReplicaSetAvailable', message: 'ReplicaSet has successfully progressed.', lastTransitionTime: isoAgo(20 * DAY) },
      ],
    },
  };
}

function buildStatefulSet({ name, namespace, replicas, readyReplicas, volumeClaimTemplateName, storageGi }) {
  const labels = labelsFor(name, namespace);
  return {
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    metadata: metadata({ name, namespace, labels, extraAgeMs: 40 * DAY }),
    spec: {
      replicas,
      serviceName: name,
      selector: { matchLabels: { app: name } },
      template: { metadata: { labels }, spec: {} },
      volumeClaimTemplates: [
        {
          metadata: { name: volumeClaimTemplateName },
          spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage: mem(storageGi * 1024) } } },
        },
      ],
    },
    status: { replicas, readyReplicas, currentReplicas: readyReplicas, updatedReplicas: replicas, observedGeneration: 2 },
  };
}

function buildDaemonSet({ name, namespace, desiredNumberScheduled, numberReady }) {
  const labels = labelsFor(name, namespace);
  return {
    apiVersion: 'apps/v1',
    kind: 'DaemonSet',
    metadata: metadata({ name, namespace, labels, extraAgeMs: 40 * DAY }),
    spec: { selector: { matchLabels: { app: name } }, template: { metadata: { labels }, spec: {} } },
    status: {
      currentNumberScheduled: desiredNumberScheduled,
      desiredNumberScheduled,
      numberReady,
      numberAvailable: numberReady,
      numberMisscheduled: 0,
      updatedNumberScheduled: desiredNumberScheduled,
    },
  };
}

module.exports = {
  shortHash,
  fakeDigest,
  podIp,
  nodeInternalIp,
  buildNode,
  buildContainerSpec,
  buildContainerStatus,
  buildPods,
  buildDeployment,
  buildStatefulSet,
  buildDaemonSet,
};
