const { isoAgo, MINUTE, HOUR, DAY, cpu, mem, metadata, labelsFor, uid } = require('./helpers');
const { shortHash, fakeDigest, podIp, buildNode, buildContainerSpec, buildPods, buildDeployment, buildStatefulSet, buildDaemonSet } = require('./build');

function buildNamespaces(names) {
  return names.map((name) =>
    ({
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: metadata({ name, labels: { 'kubernetes.io/metadata.name': name }, extraAgeMs: 120 * DAY }),
      spec: { finalizers: ['kubernetes'] },
      status: { phase: 'Active' },
    }),
  );
}

function buildService({ name, namespace, selectorApp, ports, type = 'ClusterIP', headless = false }) {
  const spec = {
    selector: selectorApp ? { app: selectorApp } : undefined,
    ports,
    type,
  };
  if (headless) spec.clusterIP = 'None';
  else spec.clusterIP = `10.8.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}`;
  const svc = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: metadata({ name, namespace, labels: labelsFor(name, namespace), extraAgeMs: 20 * DAY }),
    spec,
    status: {},
  };
  if (type === 'LoadBalancer') {
    svc.status.loadBalancer = { ingress: [{ ip: '34.140.12.44' }] };
  }
  return svc;
}

function buildEndpoints({ service, pods }) {
  const readyPods = pods.filter((p) => p.status?.containerStatuses?.[0]?.ready);
  const notReadyPods = pods.filter((p) => !p.status?.containerStatuses?.[0]?.ready && p.status?.podIP);
  return {
    apiVersion: 'v1',
    kind: 'Endpoints',
    metadata: metadata({ name: service.metadata.name, namespace: service.metadata.namespace, labels: service.metadata.labels, extraAgeMs: 20 * DAY }),
    subsets: [
      {
        addresses: readyPods.map((p) => ({ ip: p.status.podIP, targetRef: { kind: 'Pod', name: p.metadata.name, namespace: p.metadata.namespace, uid: p.metadata.uid } })),
        notReadyAddresses: notReadyPods.map((p) => ({ ip: p.status.podIP, targetRef: { kind: 'Pod', name: p.metadata.name, namespace: p.metadata.namespace, uid: p.metadata.uid } })),
        ports: (service.spec.ports || []).map((p) => ({ name: p.name, port: p.targetPort || p.port, protocol: p.protocol || 'TCP' })),
      },
    ],
  };
}

function buildIngress({ name, namespace, host, serviceName, servicePort }) {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: metadata({ name, namespace, labels: labelsFor(name, namespace), annotations: { 'kubernetes.io/ingress.class': 'nginx' }, extraAgeMs: 15 * DAY }),
    spec: {
      rules: [{ host, http: { paths: [{ path: '/', pathType: 'Prefix', backend: { service: { name: serviceName, port: { number: servicePort } } } }] } }],
    },
    status: { loadBalancer: { ingress: [{ ip: '34.140.12.44' }] } },
  };
}

function buildConfigMap({ name, namespace, data }) {
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: metadata({ name, namespace, labels: labelsFor(name, namespace), extraAgeMs: 20 * DAY }),
    data,
  };
}

function buildSecret({ name, namespace, type = 'Opaque', keys }) {
  const data = {};
  for (const key of keys) data[key] = Buffer.from(`fake-${key}-value`).toString('base64');
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: metadata({ name, namespace, labels: labelsFor(name, namespace), extraAgeMs: 20 * DAY }),
    type,
    data,
  };
}

function buildPvcPv({ namePrefix, namespace, ordinal, storageGi }) {
  const pvcName = `${namePrefix}-${ordinal}`;
  const pvName = `pv-${shortHash(8)}`;
  const storage = mem(storageGi * 1024);
  const pvc = {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: metadata({ name: pvcName, namespace, labels: labelsFor(namePrefix.split('-')[0], namespace), extraAgeMs: 30 * DAY }),
    spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage } }, volumeName: pvName, storageClassName: 'standard-rwo' },
    status: { phase: 'Bound', capacity: { storage } },
  };
  const pv = {
    apiVersion: 'v1',
    kind: 'PersistentVolume',
    metadata: metadata({ name: pvName, labels: {}, extraAgeMs: 30 * DAY }),
    spec: {
      capacity: { storage },
      accessModes: ['ReadWriteOnce'],
      persistentVolumeReclaimPolicy: 'Delete',
      storageClassName: 'standard-rwo',
      claimRef: { namespace, name: pvcName, kind: 'PersistentVolumeClaim' },
      csi: { driver: 'pd.csi.storage.gke.io', volumeHandle: `projects/demo-prod/zones/europe-west1-b/disks/${pvName}` },
    },
    status: { phase: 'Bound' },
  };
  return { pvc, pv };
}

function buildHpa({ name, namespace, targetKind, targetName, minReplicas, maxReplicas, currentReplicas, desiredReplicas, metricName, targetUtilization, currentUtilization }) {
  return {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
    metadata: metadata({ name, namespace, labels: labelsFor(name, namespace), extraAgeMs: 20 * DAY }),
    spec: {
      scaleTargetRef: { apiVersion: 'apps/v1', kind: targetKind, name: targetName },
      minReplicas,
      maxReplicas,
      metrics: [{ type: 'Resource', resource: { name: metricName, target: { type: 'Utilization', averageUtilization: targetUtilization } } }],
    },
    status: {
      currentReplicas,
      desiredReplicas,
      currentMetrics: [{ type: 'Resource', resource: { name: metricName, current: { averageUtilization: currentUtilization } } }],
      conditions: [
        { type: 'AbleToScale', status: 'True', reason: 'ReadyForNewScale', message: 'recommended size matches current size', lastTransitionTime: isoAgo(2 * HOUR) },
        { type: 'ScalingActive', status: 'True', reason: 'ValidMetricFound', message: `the HPA was able to successfully calculate a replica count from ${metricName} resource utilization`, lastTransitionTime: isoAgo(2 * HOUR) },
      ],
      lastScaleTime: isoAgo(3 * HOUR),
    },
  };
}

function buildResourceQuota({ namespace, hard, used }) {
  return {
    apiVersion: 'v1',
    kind: 'ResourceQuota',
    metadata: metadata({ name: `${namespace}-quota`, namespace, labels: {}, extraAgeMs: 60 * DAY }),
    spec: { hard },
    status: { hard, used },
  };
}

function buildLimitRange({ namespace, defaultCpu, defaultMem, maxCpu, maxMem }) {
  return {
    apiVersion: 'v1',
    kind: 'LimitRange',
    metadata: metadata({ name: `${namespace}-limits`, namespace, labels: {}, extraAgeMs: 60 * DAY }),
    spec: {
      limits: [
        {
          type: 'Container',
          default: { cpu: defaultCpu, memory: defaultMem },
          defaultRequest: { cpu: defaultCpu, memory: defaultMem },
          max: { cpu: maxCpu, memory: maxMem },
        },
      ],
    },
  };
}

function buildNetworkPolicy({ name, namespace, podSelector, policyTypes, ingress, egress }) {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: metadata({ name, namespace, labels: {}, extraAgeMs: 30 * DAY }),
    spec: { podSelector, policyTypes, ingress, egress },
  };
}

function buildPdb({ name, namespace, selectorApp, minAvailable, maxUnavailable, currentHealthy, desiredHealthy, expectedPods, disruptionsAllowed }) {
  const spec = { selector: { matchLabels: { app: selectorApp } } };
  if (minAvailable != null) spec.minAvailable = minAvailable;
  if (maxUnavailable != null) spec.maxUnavailable = maxUnavailable;
  return {
    apiVersion: 'policy/v1',
    kind: 'PodDisruptionBudget',
    metadata: metadata({ name, namespace, labels: {}, extraAgeMs: 30 * DAY }),
    spec,
    status: { currentHealthy, desiredHealthy, expectedPods, disruptionsAllowed },
  };
}

function buildJob({ name, namespace, ownerCronJob, succeeded, ageMs, durationMs }) {
  const status = succeeded
    ? { succeeded: 1, startTime: isoAgo(ageMs), completionTime: isoAgo(ageMs - durationMs), conditions: [{ type: 'Complete', status: 'True', lastTransitionTime: isoAgo(ageMs - durationMs) }] }
    : { failed: 1, startTime: isoAgo(ageMs), conditions: [{ type: 'Failed', status: 'True', reason: 'BackoffLimitExceeded', message: 'Job has reached the specified backoff limit', lastTransitionTime: isoAgo(ageMs - durationMs) }] };
  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: metadata({
      name,
      namespace,
      labels: labelsFor(name, namespace),
      ownerReferences: ownerCronJob ? [{ apiVersion: 'batch/v1', kind: 'CronJob', name: ownerCronJob.metadata.name, uid: ownerCronJob.metadata.uid, controller: true }] : undefined,
      extraAgeMs: ageMs,
    }),
    spec: { selector: { matchLabels: { app: name, 'job-name': name } }, template: { metadata: { labels: { app: name, 'job-name': name } }, spec: {} } },
    status,
  };
}

function buildJobPod({ job, namespace, image, succeeded, ageMs, durationMs, ipCounter }) {
  const podIpValue = podIp(ipCounter);
  const phase = succeeded ? 'Succeeded' : 'Failed';
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: metadata({ name: `${job.metadata.name}-${shortHash(5)}`, namespace, labels: { app: job.metadata.name, 'job-name': job.metadata.name }, extraAgeMs: ageMs }),
    spec: { containers: [buildContainerSpec({ name: job.metadata.name, image, cpuRequest: 200, cpuLimit: 500, memRequest: 256, memLimit: 512 })], restartPolicy: 'Never' },
    status: {
      phase,
      podIP: podIpValue,
      startTime: isoAgo(ageMs),
      containerStatuses: [
        {
          name: job.metadata.name,
          image,
          ready: false,
          started: false,
          restartCount: succeeded ? 0 : 1,
          state: { terminated: { reason: succeeded ? 'Completed' : 'Error', exitCode: succeeded ? 0 : 1, startedAt: isoAgo(ageMs), finishedAt: isoAgo(ageMs - durationMs) } },
        },
      ],
    },
  };
}

function buildCronJob({ name, namespace, schedule, lastScheduleMs }) {
  return {
    apiVersion: 'batch/v1',
    kind: 'CronJob',
    metadata: metadata({ name, namespace, labels: labelsFor(name, namespace), extraAgeMs: 60 * DAY }),
    spec: { schedule, jobTemplate: { spec: {} }, concurrencyPolicy: 'Forbid', suspend: false },
    status: { lastScheduleTime: isoAgo(lastScheduleMs), lastSuccessfulTime: isoAgo(lastScheduleMs) },
  };
}

// ---------------------------------------------------------------------------
// Ensamblado completo de un cluster demo
// ---------------------------------------------------------------------------

function buildCluster(profile) {
  const large = profile === 'production';
  const ipCounter = { value: 10 };

  const namespaceNames = ['default', 'core-api', 'web-app', 'data-pipeline', 'observability', 'kube-system'];
  const namespaces = buildNamespaces(namespaceNames);

  const nodeDefs = large
    ? [
        { name: 'gke-demo-prod-pool-general-9f3a1', pool: 'general', ready: true },
        { name: 'gke-demo-prod-pool-general-9f3a2', pool: 'general', ready: true },
        { name: 'gke-demo-prod-pool-general-9f3a3', pool: 'general', ready: true },
        { name: 'gke-demo-prod-pool-general-9f3a4', pool: 'general', ready: false },
        { name: 'gke-demo-prod-pool-db-1c7e1', pool: 'db', ready: true },
      ]
    : [
        { name: 'gke-demo-staging-pool-general-77aa1', pool: 'general', ready: true },
        { name: 'gke-demo-staging-pool-general-77aa2', pool: 'general', ready: true },
        { name: 'gke-demo-staging-pool-db-33bb1', pool: 'db', ready: true },
      ];
  const nodes = nodeDefs.map((n, i) => buildNode(n, i));
  const generalNodeNames = nodeDefs.filter((n) => n.pool === 'general' && n.ready).map((n) => n.name);
  const dbNodeNames = nodeDefs.filter((n) => n.pool === 'db' && n.ready).map((n) => n.name);
  const notReadyNode = nodeDefs.find((n) => !n.ready) ? nodes.find((n) => n.status.conditions[0].status === 'False') : null;

  const deployments = [];
  const statefulsets = [];
  const daemonsets = [];
  const pods = [];
  const services = [];
  const endpointsList = [];

  function addApp({ kind, name, namespace, replicas, image, port, cpuRequest, cpuLimit, memRequest, memLimit, env, envFrom, volumes, volumeMounts, specialByIndex, statefulOrdinals, storageGi, volumeClaimTemplateName, nodePool = 'general', serviceType = 'ClusterIP', headlessService = false }) {
    const nodeNames = kind === 'DaemonSet' ? generalNodeNames.concat(dbNodeNames) : nodePool === 'db' ? dbNodeNames : generalNodeNames;
    const appPods = buildPods({
      ownerName: name,
      namespace,
      replicas,
      image,
      port,
      cpuRequest,
      cpuLimit,
      memRequest,
      memLimit,
      env,
      envFrom,
      volumes,
      volumeMounts,
      nodeNames,
      ipCounter,
      specialByIndex: specialByIndex || {},
      statefulOrdinals: !!statefulOrdinals,
    });
    pods.push(...appPods);
    const readyReplicas = appPods.filter((p) => p.status.phase === 'Running' && p.status.containerStatuses?.[0]?.ready).length;

    let appObject;
    if (kind === 'Deployment') {
      appObject = buildDeployment({ name, namespace, replicas, readyReplicas });
      appObject.spec.template.spec = { containers: [buildContainerSpec({ name, image, port, cpuRequest, cpuLimit, memRequest, memLimit, env, envFrom, volumeMounts })], volumes };
      deployments.push(appObject);
    } else if (kind === 'StatefulSet') {
      appObject = buildStatefulSet({ name, namespace, replicas, readyReplicas, volumeClaimTemplateName, storageGi });
      appObject.spec.template.spec = { containers: [buildContainerSpec({ name, image, port, cpuRequest, cpuLimit, memRequest, memLimit, env, envFrom, volumeMounts })] };
      statefulsets.push(appObject);
    } else if (kind === 'DaemonSet') {
      appObject = buildDaemonSet({ name, namespace, desiredNumberScheduled: nodeNames.length, numberReady: readyReplicas });
      appObject.spec.template.spec = { containers: [buildContainerSpec({ name, image, port, cpuRequest, cpuLimit, memRequest, memLimit, env, envFrom, volumeMounts })] };
      daemonsets.push(appObject);
    }

    if (port) {
      const svc = buildService({
        name,
        namespace,
        selectorApp: name,
        ports: [{ name: 'http', port, targetPort: port, protocol: 'TCP' }],
        type: serviceType,
        headless: headlessService,
      });
      services.push(svc);
      if (!headlessService) endpointsList.push(buildEndpoints({ service: svc, pods: appPods }));
    }

    return { appObject, pods: appPods };
  }

  // --- core-api ---
  const coreApiConfig = buildConfigMap({ name: 'core-api-config', namespace: 'core-api', data: { LOG_LEVEL: 'info', FEATURE_FLAGS: '{"newMixer":true}' } });
  const coreApiSecrets = buildSecret({ name: 'core-api-secrets', namespace: 'core-api', keys: ['DATABASE_URL', 'JWT_SECRET'] });
  const envFromApi = [{ configMapRef: { name: coreApiConfig.metadata.name } }, { secretRef: { name: coreApiSecrets.metadata.name } }];

  addApp({ kind: 'Deployment', name: 'core-api', namespace: 'core-api', replicas: large ? 4 : 2, image: 'registry.demo.internal/core-api:1.8.2', port: 8080, cpuRequest: 200, cpuLimit: 500, memRequest: 256, memLimit: 512, envFrom: envFromApi });
  addApp({ kind: 'Deployment', name: 'core-api-worker', namespace: 'core-api', replicas: large ? 3 : 2, image: 'registry.demo.internal/core-api-worker:1.8.2', cpuRequest: 300, cpuLimit: 700, memRequest: 512, memLimit: 1024, envFrom: envFromApi, specialByIndex: { [large ? 2 : 1]: 'crashloop' } });
  addApp({ kind: 'Deployment', name: 'auth-service', namespace: 'core-api', replicas: 2, image: 'registry.demo.internal/auth-service:2.3.0', port: 8080, cpuRequest: 150, cpuLimit: 400, memRequest: 192, memLimit: 384 });
  addApp({ kind: 'Deployment', name: 'billing-service', namespace: 'core-api', replicas: 2, image: 'registry.demo.internal/billing-service:1.1.5', port: 8080, cpuRequest: 150, cpuLimit: 400, memRequest: 192, memLimit: 384 });

  // --- web-app ---
  const webFrontendConfig = buildConfigMap({ name: 'web-frontend-config', namespace: 'web-app', data: { API_BASE_URL: 'https://api.demo.internal' } });
  const registryPullSecret = buildSecret({ name: 'registry-pull-secret', namespace: 'web-app', type: 'kubernetes.io/dockerconfigjson', keys: ['.dockerconfigjson'] });

  addApp({
    kind: 'Deployment',
    name: 'web-frontend',
    namespace: 'web-app',
    replicas: large ? 3 : 2,
    image: 'registry.demo.internal/web-frontend:4.0.1',
    port: 80,
    cpuRequest: 100,
    cpuLimit: 300,
    memRequest: 128,
    memLimit: 256,
    volumes: [{ name: 'config', configMap: { name: webFrontendConfig.metadata.name } }],
    volumeMounts: [{ name: 'config', mountPath: '/etc/web-frontend' }],
    serviceType: 'LoadBalancer',
  });
  const notificationSpecial = large ? { 1: 'imagepullbackoff' } : {};
  const { pods: notificationPods } = addApp({ kind: 'Deployment', name: 'notification-service', namespace: 'web-app', replicas: 2, image: 'registry.demo.internal/notification-service:1.0.9', port: 8080, cpuRequest: 150, cpuLimit: 350, memRequest: 192, memLimit: 384, specialByIndex: notificationSpecial });
  for (const pod of notificationPods) pod.spec.imagePullSecrets = [{ name: registryPullSecret.metadata.name }];

  const ingressWeb = buildIngress({ name: 'public-ingress', namespace: 'web-app', host: 'app.demo.internal', serviceName: 'web-frontend', servicePort: 80 });
  const ingressApi = buildIngress({ name: 'api-ingress', namespace: 'core-api', host: 'api.demo.internal', serviceName: 'core-api', servicePort: 8080 });

  // --- data-pipeline ---
  const pdbNamespace = 'data-pipeline';
  const imageProcessorSpecial = large ? { 2: 'pending' } : {};
  addApp({ kind: 'Deployment', name: 'image-processor', namespace: pdbNamespace, replicas: large ? 3 : 2, image: 'registry.demo.internal/image-processor:3.2.0', port: 8080, cpuRequest: 500, cpuLimit: 1000, memRequest: 512, memLimit: 1024, specialByIndex: imageProcessorSpecial });
  addApp({ kind: 'Deployment', name: 'redis-proxy', namespace: pdbNamespace, replicas: 2, image: 'registry.demo.internal/redis-proxy:1.4.0', port: 6379, cpuRequest: 100, cpuLimit: 250, memRequest: 128, memLimit: 256 });

  const postgresqlCredentials = buildSecret({ name: 'postgresql-credentials', namespace: pdbNamespace, keys: ['POSTGRES_PASSWORD'] });
  const { pods: postgresqlPods } = addApp({
    kind: 'StatefulSet',
    name: 'postgresql',
    namespace: pdbNamespace,
    replicas: 3,
    image: 'postgres:15.6',
    port: 5432,
    cpuRequest: 400,
    cpuLimit: 1000,
    memRequest: 1024,
    memLimit: 2048,
    env: [{ name: 'POSTGRES_PASSWORD', valueFrom: { secretKeyRef: { name: postgresqlCredentials.metadata.name, key: 'POSTGRES_PASSWORD' } } }],
    volumeMounts: [{ name: 'data', mountPath: '/var/lib/postgresql/data' }],
    statefulOrdinals: true,
    storageGi: 20,
    volumeClaimTemplateName: 'data',
    nodePool: 'db',
    headlessService: true,
  });
  const { pods: redisClusterPods } = addApp({ kind: 'StatefulSet', name: 'redis-cluster', namespace: pdbNamespace, replicas: 3, image: 'redis:7.2.4', port: 6379, cpuRequest: 200, cpuLimit: 500, memRequest: 512, memLimit: 1024, volumeMounts: [{ name: 'data', mountPath: '/data' }], statefulOrdinals: true, storageGi: 5, volumeClaimTemplateName: 'data', headlessService: true });
  const { pods: kafkaPods } = addApp({ kind: 'StatefulSet', name: 'kafka', namespace: pdbNamespace, replicas: 3, image: 'bitnami/kafka:3.7.0', port: 9092, cpuRequest: 500, cpuLimit: 1200, memRequest: 1024, memLimit: 2048, volumeMounts: [{ name: 'data', mountPath: '/bitnami/kafka' }], statefulOrdinals: true, storageGi: 50, volumeClaimTemplateName: 'data', headlessService: true });

  const pvcPvPairs = [];
  for (const [prefix, ns, count, storageGi, statefulPods] of [
    ['data-postgresql', pdbNamespace, 3, 20, postgresqlPods],
    ['data-redis-cluster', pdbNamespace, 3, 5, redisClusterPods],
    ['data-kafka', pdbNamespace, 3, 50, kafkaPods],
  ]) {
    for (let i = 0; i < count; i++) {
      const pair = buildPvcPv({ namePrefix: prefix, namespace: ns, ordinal: i, storageGi });
      pvcPvPairs.push(pair);
      // El pod ordinal `i` de un StatefulSet monta el PVC generado a partir de su volumeClaimTemplate
      // con este mismo nombre (`<template>-<statefulset>-<ordinal>`) — necesario para que
      // `podsForPersistentVolumeClaim` (k8s-relations.ts) encuentre el pod correcto.
      const pod = statefulPods[i];
      if (pod) pod.spec.volumes = [{ name: 'data', persistentVolumeClaim: { claimName: pair.pvc.metadata.name } }];
    }
  }

  // --- observability ---
  addApp({ kind: 'Deployment', name: 'grafana', namespace: 'observability', replicas: 1, image: 'grafana/grafana:10.4.2', port: 3000, cpuRequest: 150, cpuLimit: 400, memRequest: 256, memLimit: 512 });
  addApp({ kind: 'Deployment', name: 'prometheus-adapter', namespace: 'observability', replicas: 1, image: 'registry.k8s.io/prometheus-adapter/prometheus-adapter:v0.11.2', port: 6443, cpuRequest: 100, cpuLimit: 250, memRequest: 128, memLimit: 256 });
  const nodeExporterNodeCount = generalNodeNames.length + dbNodeNames.length;
  addApp({ kind: 'DaemonSet', name: 'node-exporter', namespace: 'observability', replicas: nodeExporterNodeCount, image: 'prom/node-exporter:v1.8.1', port: 9100, cpuRequest: 50, cpuLimit: 100, memRequest: 64, memLimit: 128 });

  // --- kube-system ---
  addApp({ kind: 'Deployment', name: 'ingress-nginx-controller', namespace: 'kube-system', replicas: 2, image: 'registry.k8s.io/ingress-nginx/controller:v1.10.1', port: 80, cpuRequest: 200, cpuLimit: 500, memRequest: 256, memLimit: 512, serviceType: 'NodePort' });
  addApp({ kind: 'DaemonSet', name: 'fluent-bit', namespace: 'kube-system', replicas: nodeExporterNodeCount, image: 'fluent/fluent-bit:3.0.7', cpuRequest: 50, cpuLimit: 150, memRequest: 64, memLimit: 128 });

  // node-exporter DaemonSet should reflect the not-ready node as missing a scheduled pod
  const nodeExporterDs = daemonsets.find((d) => d.metadata.name === 'node-exporter');
  if (notReadyNode) {
    nodeExporterDs.status.desiredNumberScheduled = nodeExporterNodeCount + 1;
    nodeExporterDs.status.currentNumberScheduled = nodeExporterNodeCount;
  }

  // --- CronJobs + Jobs ---
  const cronJobDbBackup = buildCronJob({ name: 'db-backup', namespace: pdbNamespace, schedule: '0 3 * * *', lastScheduleMs: 6 * HOUR });
  const cronJobReport = buildCronJob({ name: 'report-generator', namespace: 'core-api', schedule: '0 6 * * 1', lastScheduleMs: 2 * DAY });

  const jobDefs = [
    { cronJob: cronJobDbBackup, namespace: pdbNamespace, image: 'registry.demo.internal/db-backup-tool:2.1.0', succeeded: true, ageMs: 54 * HOUR, durationMs: 12 * MINUTE },
    { cronJob: cronJobDbBackup, namespace: pdbNamespace, image: 'registry.demo.internal/db-backup-tool:2.1.0', succeeded: true, ageMs: 30 * HOUR, durationMs: 11 * MINUTE },
    { cronJob: cronJobDbBackup, namespace: pdbNamespace, image: 'registry.demo.internal/db-backup-tool:2.1.0', succeeded: !large, ageMs: 6 * HOUR, durationMs: 9 * MINUTE },
    { cronJob: cronJobReport, namespace: 'core-api', image: 'registry.demo.internal/report-generator:1.2.0', succeeded: true, ageMs: 9 * DAY, durationMs: 4 * MINUTE },
    { cronJob: cronJobReport, namespace: 'core-api', image: 'registry.demo.internal/report-generator:1.2.0', succeeded: true, ageMs: 2 * DAY, durationMs: 4 * MINUTE },
  ];

  const jobs = [];
  const jobPods = [];
  let failedJob = null;
  for (let i = 0; i < jobDefs.length; i++) {
    const def = jobDefs[i];
    const name = `${def.cronJob.metadata.name}-${28900000 + i * 733}`;
    const job = buildJob({ name, namespace: def.namespace, ownerCronJob: def.cronJob, succeeded: def.succeeded, ageMs: def.ageMs, durationMs: def.durationMs });
    jobs.push(job);
    jobPods.push(buildJobPod({ job, namespace: def.namespace, image: def.image, succeeded: def.succeeded, ageMs: def.ageMs, durationMs: def.durationMs, ipCounter }));
    if (!def.succeeded) failedJob = job;
  }
  pods.push(...jobPods);

  // --- HPAs ---
  const hpas = [
    buildHpa({ name: 'core-api', namespace: 'core-api', targetKind: 'Deployment', targetName: 'core-api', minReplicas: 2, maxReplicas: 8, currentReplicas: large ? 4 : 2, desiredReplicas: large ? 4 : 2, metricName: 'cpu', targetUtilization: 60, currentUtilization: 45 }),
    buildHpa({ name: 'core-api-worker', namespace: 'core-api', targetKind: 'Deployment', targetName: 'core-api-worker', minReplicas: 2, maxReplicas: 6, currentReplicas: large ? 3 : 2, desiredReplicas: large ? 4 : 2, metricName: 'cpu', targetUtilization: 70, currentUtilization: 82 }),
    buildHpa({ name: 'image-processor', namespace: pdbNamespace, targetKind: 'Deployment', targetName: 'image-processor', minReplicas: 2, maxReplicas: 5, currentReplicas: large ? 3 : 2, desiredReplicas: large ? 3 : 2, metricName: 'memory', targetUtilization: 75, currentUtilization: 68 }),
  ];

  // --- ResourceQuotas + LimitRanges ---
  const resourcequotas = [
    buildResourceQuota({ namespace: 'core-api', hard: { 'requests.cpu': '4', 'requests.memory': '8Gi', pods: '20' }, used: { 'requests.cpu': '1650m', 'requests.memory': '2816Mi', pods: String(large ? 11 : 6) } }),
    buildResourceQuota({ namespace: pdbNamespace, hard: { 'requests.cpu': '8', 'requests.memory': '16Gi', pods: '30' }, used: { 'requests.cpu': '3300m', 'requests.memory': '7168Mi', pods: String(large ? 17 : 11) } }),
  ];
  const limitranges = [
    buildLimitRange({ namespace: 'core-api', defaultCpu: '250m', defaultMem: '256Mi', maxCpu: '1', maxMem: '1Gi' }),
    buildLimitRange({ namespace: pdbNamespace, defaultCpu: '250m', defaultMem: '256Mi', maxCpu: '2', maxMem: '2Gi' }),
  ];

  // --- NetworkPolicies ---
  const networkpolicies = [
    buildNetworkPolicy({
      name: 'default-deny-ingress',
      namespace: 'core-api',
      podSelector: {},
      policyTypes: ['Ingress'],
      ingress: [{ from: [{ namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'kube-system' } }, podSelector: { matchLabels: { app: 'ingress-nginx-controller' } } }], ports: [{ protocol: 'TCP', port: 8080 }] }],
    }),
    buildNetworkPolicy({
      name: 'allow-redis-from-image-processor',
      namespace: pdbNamespace,
      podSelector: { matchLabels: { app: 'redis-proxy' } },
      policyTypes: ['Ingress'],
      ingress: [{ from: [{ podSelector: { matchLabels: { app: 'image-processor' } } }], ports: [{ protocol: 'TCP', port: 6379 }] }],
    }),
  ];

  // --- PodDisruptionBudgets ---
  const poddisruptionbudgets = [
    buildPdb({ name: 'core-api-pdb', namespace: 'core-api', selectorApp: 'core-api', minAvailable: 2, currentHealthy: large ? 4 : 2, desiredHealthy: 2, expectedPods: large ? 4 : 2, disruptionsAllowed: large ? 2 : 0 }),
    buildPdb({ name: 'web-frontend-pdb', namespace: 'web-app', selectorApp: 'web-frontend', maxUnavailable: 1, currentHealthy: large ? 3 : 2, desiredHealthy: large ? 2 : 1, expectedPods: large ? 3 : 2, disruptionsAllowed: 1 }),
    buildPdb({ name: 'postgresql-pdb', namespace: pdbNamespace, selectorApp: 'postgresql', minAvailable: 2, currentHealthy: 3, desiredHealthy: 2, expectedPods: 3, disruptionsAllowed: 1 }),
  ];

  const configmaps = [coreApiConfig, webFrontendConfig];
  const secrets = [coreApiSecrets, registryPullSecret, postgresqlCredentials];
  const ingresses = [ingressWeb, ingressApi];
  const cronjobs = [cronJobDbBackup, cronJobReport];
  const persistentvolumeclaims = pvcPvPairs.map((p) => p.pvc);
  const persistentvolumes = pvcPvPairs.map((p) => p.pv);

  const crashloopPod = pods.find((p) => p.status?.containerStatuses?.[0]?.state?.waiting?.reason === 'CrashLoopBackOff') || null;
  const imagePullBackOffPod = pods.find((p) => p.status?.containerStatuses?.[0]?.state?.waiting?.reason === 'ImagePullBackOff') || null;
  const pendingPod = pods.find((p) => p.status?.phase === 'Pending') || null;

  const resources = {
    deployments,
    services,
    pods,
    statefulsets,
    daemonsets,
    jobs,
    cronjobs,
    ingresses,
    configmaps,
    secrets,
    persistentvolumeclaims,
    persistentvolumes,
    nodes,
    horizontalpodautoscalers: hpas,
    namespaces,
    resourcequotas,
    limitranges,
    networkpolicies,
    endpoints: endpointsList,
    poddisruptionbudgets,
  };

  const meta = {
    crashloopPod,
    imagePullBackOffPod,
    pendingPod,
    notReadyNode,
    failedJob,
    failedJobCronJob: failedJob ? cronJobDbBackup : null,
    profile,
  };

  return { resources, meta };
}

module.exports = { buildCluster };
