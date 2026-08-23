const { metadata, isoAgo, DAY } = require('./helpers');

function buildCrds() {
  const crds = [
    {
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      metadata: metadata({ name: 'certificates.cert-manager.io', labels: {}, extraAgeMs: 60 * DAY }),
      spec: {
        group: 'cert-manager.io',
        names: { kind: 'Certificate', plural: 'certificates', singular: 'certificate', listKind: 'CertificateList' },
        scope: 'Namespaced',
        versions: [{ name: 'v1', served: true, storage: true }],
      },
      status: { acceptedNames: { kind: 'Certificate', plural: 'certificates' } },
    },
    {
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      metadata: metadata({ name: 'servicemonitors.monitoring.coreos.com', labels: {}, extraAgeMs: 60 * DAY }),
      spec: {
        group: 'monitoring.coreos.com',
        names: { kind: 'ServiceMonitor', plural: 'servicemonitors', singular: 'servicemonitor', listKind: 'ServiceMonitorList' },
        scope: 'Namespaced',
        versions: [{ name: 'v1', served: true, storage: true }],
      },
      status: { acceptedNames: { kind: 'ServiceMonitor', plural: 'servicemonitors' } },
    },
  ];

  const instancesByKey = {
    'cert-manager.io/v1/certificates': [
      {
        apiVersion: 'cert-manager.io/v1',
        kind: 'Certificate',
        metadata: metadata({ name: 'app-demo-internal-tls', namespace: 'web-app', labels: {}, extraAgeMs: 15 * DAY }),
        spec: { secretName: 'app-demo-internal-tls', dnsNames: ['app.demo.internal'], issuerRef: { name: 'letsencrypt-prod', kind: 'ClusterIssuer' } },
        status: { conditions: [{ type: 'Ready', status: 'True', reason: 'Ready', message: 'Certificate is up to date and has not expired' }] },
      },
      {
        apiVersion: 'cert-manager.io/v1',
        kind: 'Certificate',
        metadata: metadata({ name: 'api-demo-internal-tls', namespace: 'core-api', labels: {}, extraAgeMs: 15 * DAY }),
        spec: { secretName: 'api-demo-internal-tls', dnsNames: ['api.demo.internal'], issuerRef: { name: 'letsencrypt-prod', kind: 'ClusterIssuer' } },
        status: { conditions: [{ type: 'Ready', status: 'True', reason: 'Ready', message: 'Certificate is up to date and has not expired' }] },
      },
    ],
    'monitoring.coreos.com/v1/servicemonitors': [
      {
        apiVersion: 'monitoring.coreos.com/v1',
        kind: 'ServiceMonitor',
        metadata: metadata({ name: 'core-api', namespace: 'core-api', labels: {}, extraAgeMs: 20 * DAY }),
        spec: { selector: { matchLabels: { app: 'core-api' } }, endpoints: [{ port: 'http', path: '/metrics', interval: '30s' }] },
      },
      {
        apiVersion: 'monitoring.coreos.com/v1',
        kind: 'ServiceMonitor',
        metadata: metadata({ name: 'ingress-nginx-controller', namespace: 'kube-system', labels: {}, extraAgeMs: 40 * DAY }),
        spec: { selector: { matchLabels: { app: 'ingress-nginx-controller' } }, endpoints: [{ port: 'http', path: '/metrics', interval: '30s' }] },
      },
    ],
  };

  return { crds, instancesByKey };
}

module.exports = { buildCrds };
