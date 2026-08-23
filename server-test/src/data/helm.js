const { isoAgo, DAY } = require('./helpers');

function ref(kind, name, namespace) {
  return { kind, name, namespace };
}

function buildHelmReleases(resources, profile) {
  const large = profile === 'production';

  const releases = [
    {
      name: 'ingress-nginx',
      namespace: 'kube-system',
      revision: 7,
      status: 'deployed',
      lastDeployed: isoAgo(15 * DAY),
      description: 'Upgrade complete',
      chart: 'ingress-nginx',
      chartVersion: '4.10.1',
      appVersion: '1.10.1',
      resources: [ref('Deployment', 'ingress-nginx-controller', 'kube-system'), ref('Service', 'ingress-nginx-controller', 'kube-system')],
    },
    {
      name: 'fluent-bit',
      namespace: 'kube-system',
      revision: 3,
      status: 'deployed',
      lastDeployed: isoAgo(40 * DAY),
      description: 'Upgrade complete',
      chart: 'fluent-bit',
      chartVersion: '0.46.6',
      appVersion: '3.0.7',
      resources: [ref('DaemonSet', 'fluent-bit', 'kube-system')],
    },
    {
      name: 'postgresql',
      namespace: 'data-pipeline',
      revision: 5,
      status: 'deployed',
      lastDeployed: isoAgo(30 * DAY),
      description: 'Upgrade complete',
      chart: 'postgresql',
      chartVersion: '15.5.5',
      appVersion: '15.6.0',
      resources: [ref('StatefulSet', 'postgresql', 'data-pipeline'), ref('Secret', 'postgresql-credentials', 'data-pipeline'), ref('Service', 'postgresql', 'data-pipeline')],
    },
    {
      name: 'redis',
      namespace: 'data-pipeline',
      revision: 4,
      status: 'deployed',
      lastDeployed: isoAgo(30 * DAY),
      description: 'Upgrade complete',
      chart: 'redis-cluster',
      chartVersion: '10.2.3',
      appVersion: '7.2.4',
      resources: [ref('StatefulSet', 'redis-cluster', 'data-pipeline'), ref('Service', 'redis-cluster', 'data-pipeline')],
    },
    {
      name: 'core-api',
      namespace: 'core-api',
      revision: 12,
      status: 'deployed',
      lastDeployed: isoAgo(20 * 60 * 60 * 1000),
      description: 'Upgrade complete',
      chart: 'core-api',
      chartVersion: '1.8.2',
      appVersion: '1.8.2',
      resources: [
        ref('Deployment', 'core-api', 'core-api'),
        ref('Deployment', 'core-api-worker', 'core-api'),
        ref('ConfigMap', 'core-api-config', 'core-api'),
        ref('Secret', 'core-api-secrets', 'core-api'),
        ref('HorizontalPodAutoscaler', 'core-api', 'core-api'),
        ref('HorizontalPodAutoscaler', 'core-api-worker', 'core-api'),
        ref('Ingress', 'api-ingress', 'core-api'),
      ],
    },
  ];

  if (large) {
    releases.push({
      name: 'observability-stack',
      namespace: 'observability',
      revision: 4,
      status: 'failed',
      lastDeployed: isoAgo(3 * 60 * 60 * 1000),
      description: 'Upgrade "observability-stack" failed: timed out waiting for the condition',
      chart: 'kube-prometheus-stack',
      chartVersion: '58.2.1',
      appVersion: '0.73.2',
      resources: [ref('Deployment', 'grafana', 'observability'), ref('Deployment', 'prometheus-adapter', 'observability'), ref('DaemonSet', 'node-exporter', 'observability')],
    });
  }

  return releases;
}

module.exports = { buildHelmReleases };
