import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { SRC_DIR, loadApp } from './helpers/load-app.js';

// k8s-manager must never create, modify or delete anything in a cluster. These
// tests enforce that at two levels: at runtime, every API object handed to the
// routes only allows `list*`/`read*`/`get*` calls; statically, the source code
// never calls anything else on an API/metrics client.
const READ_ONLY_METHOD = /^(list|read|get)[A-Z]/;

const API_NAMES = ['appsApi', 'coreApi', 'batchApi', 'networkingApi', 'apiextensionsApi', 'customObjectsApi', 'autoscalingApi', 'policyApi'];

function guardedClient(name, calls, violations) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        // Probed by promise resolution / inspection; not an API call.
        if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') return undefined;
        if (!READ_ONLY_METHOD.test(prop)) {
          return () => {
            violations.push(`${name}.${prop}`);
            throw new Error(`Read-only violation: ${name}.${prop}() was called`);
          };
        }
        return async (...args) => {
          calls.push(`${name}.${prop}`);
          if (prop === 'readNamespacedPodLog') return 'a log line';
          return { items: [] };
        };
      },
    },
  );
}

// Every route registered on the app, as { method, path }.
function registeredRoutes(app) {
  const routes = [];
  for (const layer of app._router.stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) routes.push({ method, path: String(layer.route.path) });
    } else if (layer.name === 'router') {
      for (const inner of layer.handle.stack) {
        if (!inner.route) continue;
        for (const method of Object.keys(inner.route.methods)) routes.push({ method, path: `/api${inner.route.path}` });
      }
    }
  }
  return routes;
}

describe('read-only guarantee', () => {
  let app;
  let calls;
  let violations;

  beforeEach(() => {
    let k8s;
    ({ app, k8s } = loadApp());
    calls = [];
    violations = [];
    k8s.createApis.mockImplementation((context) => Object.fromEntries(API_NAMES.map((name) => [name, guardedClient(`${context}:${name}`, calls, violations)])));
    k8s.createMetricsClient.mockImplementation((context) => guardedClient(`${context}:metrics`, calls, violations));
    k8s.loadKubeConfig.mockImplementation(() => {
      const kc = guardedClient('kubeconfig', calls, violations);
      return new Proxy(kc, { get: (target, prop) => (prop === 'getContexts' ? () => [] : target[prop]) });
    });
  });

  it('the guard itself rejects mutating calls', () => {
    const client = guardedClient('coreApi', calls, violations);
    expect(() => client.deleteNamespacedPod({ name: 'x', namespace: 'y' })).toThrow('Read-only violation');
    expect(() => client.createNamespacedSecret({})).toThrow('Read-only violation');
    expect(() => client.patchNamespacedDeployment({})).toThrow('Read-only violation');
    expect(violations).toEqual(['coreApi.deleteNamespacedPod', 'coreApi.createNamespacedSecret', 'coreApi.patchNamespacedDeployment']);
  });

  it('only exposes GET routes', () => {
    const routes = registeredRoutes(app);
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.filter((route) => route.method !== 'get')).toEqual([]);
  });

  it('every API route only performs list/read/get calls against the cluster', async () => {
    const apiRoutes = registeredRoutes(app).filter((route) => route.path.startsWith('/api/'));
    expect(apiRoutes.map((route) => route.path).sort()).toEqual(
      [
        '/api/contexts',
        '/api/:context/resources',
        '/api/:context/pods/:namespace/:name/logs',
        '/api/:context/metrics/pods',
        '/api/:context/metrics/nodes',
        '/api/:context/crds',
        '/api/:context/crds/:group/:version/:plural/instances',
        '/api/:context/helm/releases',
        '/api/:context/events',
      ].sort(),
    );

    for (const route of apiRoutes) {
      const url = route.path.replace(/:(\w+)/g, (_match, param) => `sample-${param}`);
      const res = await request(app).get(url);
      expect(res.status, `${route.path} -> ${JSON.stringify(res.body)}`).toBe(200);
    }

    expect(violations).toEqual([]);
    // Sanity check: the routes really went through the guarded clients.
    expect(calls.length).toBeGreaterThanOrEqual(apiRoutes.length);
    expect(calls.every((call) => READ_ONLY_METHOD.test(call.split('.')[1]))).toBe(true);
  });

  it('the source never calls a non-read method on an API or metrics client', () => {
    const files = fs.readdirSync(SRC_DIR, { recursive: true }).filter((file) => file.endsWith('.js'));
    const called = [];
    for (const file of files) {
      const source = fs.readFileSync(path.join(SRC_DIR, file), 'utf-8');
      for (const [, client, method] of source.matchAll(/\b(\w*Api|metrics)\.(\w+)\s*\(/g)) {
        called.push({ file, call: `${client}.${method}` });
      }
    }

    expect(called.length).toBeGreaterThanOrEqual(25);
    expect(called.filter(({ call }) => !READ_ONLY_METHOD.test(call.split('.')[1]))).toEqual([]);
    // No streaming/exec style clients either (Exec, Attach, PortForward, Cp, Watch...).
    for (const file of files) {
      const source = fs.readFileSync(path.join(SRC_DIR, file), 'utf-8');
      expect(source, file).not.toMatch(/\bk8s\.(Exec|Attach|PortForward|Cp|Watch|Log)\b/);
      expect(source, file).not.toMatch(/\b(create|delete|patch|replace)(Namespaced|Cluster|Collection)\w*\s*\(/);
    }
  });
});
