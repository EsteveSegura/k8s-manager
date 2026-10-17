import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiError, loadApp, requireSrc } from './helpers/load-app.js';

const LAST_APPLIED = 'kubectl.kubernetes.io/last-applied-configuration';

// Every kind returned by GET /:context/resources and the API call that feeds it.
const FETCHERS = {
  deployments: ['appsApi', 'listDeploymentForAllNamespaces'],
  services: ['coreApi', 'listServiceForAllNamespaces'],
  pods: ['coreApi', 'listPodForAllNamespaces'],
  statefulsets: ['appsApi', 'listStatefulSetForAllNamespaces'],
  daemonsets: ['appsApi', 'listDaemonSetForAllNamespaces'],
  jobs: ['batchApi', 'listJobForAllNamespaces'],
  cronjobs: ['batchApi', 'listCronJobForAllNamespaces'],
  ingresses: ['networkingApi', 'listIngressForAllNamespaces'],
  configmaps: ['coreApi', 'listConfigMapForAllNamespaces'],
  secrets: ['coreApi', 'listSecretForAllNamespaces'],
  persistentvolumeclaims: ['coreApi', 'listPersistentVolumeClaimForAllNamespaces'],
  persistentvolumes: ['coreApi', 'listPersistentVolume'],
  nodes: ['coreApi', 'listNode'],
  horizontalpodautoscalers: ['autoscalingApi', 'listHorizontalPodAutoscalerForAllNamespaces'],
  namespaces: ['coreApi', 'listNamespace'],
  resourcequotas: ['coreApi', 'listResourceQuotaForAllNamespaces'],
  limitranges: ['coreApi', 'listLimitRangeForAllNamespaces'],
  networkpolicies: ['networkingApi', 'listNetworkPolicyForAllNamespaces'],
  endpoints: ['coreApi', 'listEndpointsForAllNamespaces'],
  poddisruptionbudgets: ['policyApi', 'listPodDisruptionBudgetForAllNamespaces'],
};

// Fake API objects where each list method returns one item tagged with the
// method that produced it, so the test can tell which call fed which kind.
function fakeApis(overrides = {}) {
  const apis = {};
  for (const [apiName, method] of Object.values(FETCHERS)) {
    apis[apiName] ??= {};
    apis[apiName][method] = async (...args) => {
      apis.calls.push({ method, args });
      if (overrides[method]) return overrides[method]();
      return { items: [{ metadata: { name: `from-${method}` } }] };
    };
  }
  apis.calls = [];
  return apis;
}

function secret(overrides = {}) {
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    type: 'Opaque',
    metadata: {
      name: 'db-credentials',
      namespace: 'prod',
      labels: { app: 'db' },
      annotations: {
        [LAST_APPLIED]: '{"apiVersion":"v1","data":{"password":"c3VwZXItc2VjcmV0"},"kind":"Secret"}',
        'example.com/owner': 'team-db',
      },
    },
    data: { username: 'YWRtaW4=', password: 'c3VwZXItc2VjcmV0' },
    ...overrides,
  };
}

describe('redactSecret', () => {
  const { redactSecret } = requireSrc('routes/resources');

  it('drops data and the last-applied annotation but keeps everything else', () => {
    const redacted = redactSecret(secret());
    expect(redacted).toEqual({
      apiVersion: 'v1',
      kind: 'Secret',
      type: 'Opaque',
      metadata: {
        name: 'db-credentials',
        namespace: 'prod',
        labels: { app: 'db' },
        annotations: { 'example.com/owner': 'team-db' },
      },
      dataKeys: ['username', 'password'],
    });
  });

  it('never leaks any secret value anywhere in the serialized output', () => {
    const serialized = JSON.stringify(redactSecret(secret({ stringData: { token: 'plain-token' } })));
    expect(serialized).not.toContain('YWRtaW4=');
    expect(serialized).not.toContain('c3VwZXItc2VjcmV0');
    expect(serialized).not.toContain('plain-token');
    expect(serialized).not.toContain(LAST_APPLIED);
    expect(serialized).not.toContain('"data"');
    expect(serialized).not.toContain('"stringData"');
  });

  it('takes dataKeys from stringData when there is no data', () => {
    const redacted = redactSecret(secret({ data: undefined, stringData: { token: 'x', 'ca.crt': 'y' } }));
    expect(redacted.dataKeys).toEqual(['token', 'ca.crt']);
    expect(redacted).not.toHaveProperty('stringData');
  });

  it('reports no keys for a secret without data', () => {
    const { data, ...withoutData } = secret();
    expect(redactSecret(withoutData).dataKeys).toEqual([]);
  });

  it('does not mutate the input secret', () => {
    const input = secret();
    const snapshot = structuredClone(input);
    redactSecret(input);
    expect(input).toEqual(snapshot);
  });

  it('keeps annotations untouched when there is no last-applied annotation', () => {
    const input = secret();
    delete input.metadata.annotations[LAST_APPLIED];
    expect(redactSecret(input).metadata).toEqual({
      name: 'db-credentials',
      namespace: 'prod',
      labels: { app: 'db' },
      annotations: { 'example.com/owner': 'team-db' },
    });
  });

  it('strips the last-applied annotation even when it is the only one', () => {
    const input = secret();
    input.metadata.annotations = { [LAST_APPLIED]: '{}' };
    expect(redactSecret(input).metadata.annotations).toEqual({});
  });

  it('handles secrets without annotations or without metadata', () => {
    const input = secret();
    delete input.metadata.annotations;
    expect(redactSecret(input).metadata).toEqual({ name: 'db-credentials', namespace: 'prod', labels: { app: 'db' } });

    const { metadata, ...withoutMetadata } = secret();
    expect(redactSecret(withoutMetadata)).toEqual({ apiVersion: 'v1', kind: 'Secret', type: 'Opaque', dataKeys: ['username', 'password'] });
  });
});

describe('GET /api/:context/resources', () => {
  let app;
  let k8s;

  beforeEach(() => {
    ({ app, k8s } = loadApp());
  });

  it('lists every kind from its own API call and reports no errors', async () => {
    const apis = fakeApis();
    k8s.createApis.mockReturnValue(apis);

    const res = await request(app).get('/api/my-ctx/resources');

    expect(res.status).toBe(200);
    expect(k8s.createApis).toHaveBeenCalledExactlyOnceWith('my-ctx');
    expect(Object.keys(res.body).sort()).toEqual([...Object.keys(FETCHERS), 'errors'].sort());
    for (const [kind, [, method]] of Object.entries(FETCHERS)) {
      if (kind === 'secrets') continue;
      expect(res.body[kind], kind).toEqual([{ metadata: { name: `from-${method}` } }]);
    }
    expect(res.body.secrets).toEqual([{ metadata: { name: 'from-listSecretForAllNamespaces' }, dataKeys: [] }]);
    expect(res.body.errors).toEqual({});
    // List calls are made without filters (all namespaces).
    expect(apis.calls).toHaveLength(Object.keys(FETCHERS).length);
    expect(apis.calls.every(({ args }) => args.length === 0)).toBe(true);
  });

  it('redacts secrets before sending them', async () => {
    k8s.createApis.mockReturnValue(fakeApis({ listSecretForAllNamespaces: () => ({ items: [secret()] }) }));

    const res = await request(app).get('/api/my-ctx/resources');

    expect(res.status).toBe(200);
    expect(res.body.secrets).toEqual([
      {
        apiVersion: 'v1',
        kind: 'Secret',
        type: 'Opaque',
        metadata: { name: 'db-credentials', namespace: 'prod', labels: { app: 'db' }, annotations: { 'example.com/owner': 'team-db' } },
        dataKeys: ['username', 'password'],
      },
    ]);
    expect(res.text).not.toContain('c3VwZXItc2VjcmV0');
    expect(res.text).not.toContain(LAST_APPLIED);
  });

  it('isolates per-kind failures: failed kinds are empty and carry their own error', async () => {
    k8s.createApis.mockReturnValue(
      fakeApis({
        listSecretForAllNamespaces: () => Promise.reject(apiError(403, 'secrets is forbidden: User "dev" cannot list resource "secrets"')),
        listNode: () => Promise.reject(apiError(403, 'nodes is forbidden', { bodyAsString: true })),
        listPodDisruptionBudgetForAllNamespaces: () => Promise.reject(new Error('fetch failed')),
      }),
    );

    const res = await request(app).get('/api/my-ctx/resources');

    expect(res.status).toBe(200);
    expect(res.body.errors).toEqual({
      secrets: 'secrets is forbidden: User "dev" cannot list resource "secrets"',
      nodes: 'nodes is forbidden',
      poddisruptionbudgets: 'fetch failed',
    });
    expect(res.body.secrets).toEqual([]);
    expect(res.body.nodes).toEqual([]);
    expect(res.body.poddisruptionbudgets).toEqual([]);
    expect(res.body.pods).toEqual([{ metadata: { name: 'from-listPodForAllNamespaces' } }]);
    expect(res.body.deployments).toEqual([{ metadata: { name: 'from-listDeploymentForAllNamespaces' } }]);
  });

  it('still answers 200 with every kind empty when everything fails', async () => {
    const overrides = Object.fromEntries(Object.values(FETCHERS).map(([, method]) => [method, () => Promise.reject(apiError(401, 'Unauthorized'))]));
    k8s.createApis.mockReturnValue(fakeApis(overrides));

    const res = await request(app).get('/api/my-ctx/resources');

    expect(res.status).toBe(200);
    for (const kind of Object.keys(FETCHERS)) {
      expect(res.body[kind], kind).toEqual([]);
      expect(res.body.errors[kind], kind).toBe('Unauthorized');
    }
  });

  it('answers 502 when the API clients cannot be created', async () => {
    k8s.createApis.mockImplementation(() => {
      throw new Error('No active cluster!');
    });

    const res = await request(app).get('/api/unknown-ctx/resources');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'No active cluster!' });
    expect(k8s.createApis).toHaveBeenCalledWith('unknown-ctx');
  });
});
