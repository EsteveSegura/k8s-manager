import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError, loadApp, requireSrc } from './helpers/load-app.js';

let app;
let k8s;

beforeEach(() => {
  ({ app, k8s } = loadApp());
});

describe('GET /api/contexts', () => {
  it('lists the kubeconfig contexts with a null namespace when unset', async () => {
    const getContexts = vi.fn(() => [
      { name: 'kind-dev', cluster: 'kind-dev', user: 'kind-dev', namespace: 'apps' },
      { name: 'prod', cluster: 'prod-cluster', user: 'admin' },
    ]);
    k8s.loadKubeConfig.mockReturnValue({ getContexts });

    const res = await request(app).get('/api/contexts');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      contexts: [
        { name: 'kind-dev', cluster: 'kind-dev', namespace: 'apps' },
        { name: 'prod', cluster: 'prod-cluster', namespace: null },
      ],
    });
  });

  it('answers 500 through the error handler when the kubeconfig cannot be loaded', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('EISDIR: illegal operation on a directory, read');
    k8s.loadKubeConfig.mockImplementation(() => {
      throw failure;
    });

    const res = await request(app).get('/api/contexts');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'EISDIR: illegal operation on a directory, read' });
    expect(consoleError).toHaveBeenCalledWith(failure);
  });
});

describe('GET /api/:context/pods/:namespace/:name/logs', () => {
  let readNamespacedPodLog;

  beforeEach(() => {
    readNamespacedPodLog = vi.fn(async () => 'line 1\nline 2\n');
    k8s.createApis.mockReturnValue({ coreApi: { readNamespacedPodLog } });
  });

  it('defaults to the last 200 lines, no timestamps and the default container', async () => {
    const res = await request(app).get('/api/my-ctx/pods/shop/web-123/logs');

    expect(res.status).toBe(200);
    expect(k8s.createApis).toHaveBeenCalledWith('my-ctx');
    expect(readNamespacedPodLog).toHaveBeenCalledExactlyOnceWith({ name: 'web-123', namespace: 'shop', container: undefined, tailLines: 200, timestamps: false });
    expect(res.body).toEqual({ logs: 'line 1\nline 2\n', lines: ['line 1', 'line 2', ''] });
  });

  it('passes container, tailLines and timestamps from the query string', async () => {
    const res = await request(app).get('/api/my-ctx/pods/shop/web-123/logs').query({ container: 'sidecar', tailLines: '50', timestamps: 'true' });

    expect(res.status).toBe(200);
    expect(readNamespacedPodLog).toHaveBeenCalledWith({ name: 'web-123', namespace: 'shop', container: 'sidecar', tailLines: 50, timestamps: true });
  });

  it('falls back to defaults for invalid or non-"true" values', async () => {
    await request(app).get('/api/my-ctx/pods/shop/web-123/logs').query({ container: '', tailLines: 'abc', timestamps: '1' });
    await request(app).get('/api/my-ctx/pods/shop/web-123/logs').query({ tailLines: '0', timestamps: 'false' });

    for (const [options] of readNamespacedPodLog.mock.calls) {
      expect(options.tailLines).toBe(200);
      expect(options.timestamps).toBe(false);
      expect(options.container).toBeUndefined();
    }
  });

  it('answers an empty log as a single empty line', async () => {
    readNamespacedPodLog.mockResolvedValue('');
    const res = await request(app).get('/api/my-ctx/pods/shop/web-123/logs');
    expect(res.body).toEqual({ logs: '', lines: [''] });
  });

  it('propagates the k8s HTTP status and message of an API error', async () => {
    readNamespacedPodLog.mockRejectedValue(apiError(400, 'container "x" is not valid for pod "web-123"', { bodyAsString: true }));

    const res = await request(app).get('/api/my-ctx/pods/shop/web-123/logs');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'container "x" is not valid for pod "web-123"' });
  });

  it('answers 502 for errors without a status code', async () => {
    readNamespacedPodLog.mockRejectedValue(new TypeError('fetch failed'));

    const res = await request(app).get('/api/my-ctx/pods/shop/web-123/logs');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'fetch failed' });
  });

  // BUG: logs.js answers with `res.status(err.code || 502)`. Node system errors
  // carry a *string* `code` (e.g. createApis -> loadFromDefault() throws
  // `EISDIR` when KUBECONFIG points to a directory). Express then throws
  // RangeError [ERR_HTTP_INVALID_STATUS_CODE] from inside the catch block, the
  // async handler rejects, nobody handles it and Node 24 terminates the whole
  // server process. Reproduced with the real server: KUBECONFIG=<dir> and
  // GET /api/x/pods/ns/p/logs kills it. The handler is invoked directly here
  // (with a response that validates the status like Node does) so the unhandled
  // rejection does not leak into the test run. Remove `.fails` once fixed.
  it.fails('answers 502 when the error has a non-HTTP string code (crashes the server today)', async () => {
    const systemError = Object.assign(new Error('EISDIR: illegal operation on a directory, read'), { code: 'EISDIR' });
    k8s.createApis.mockImplementation(() => {
      throw systemError;
    });
    const handler = requireSrc('routes/logs').stack[0].route.stack[0].handle;
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        if (!Number.isInteger(this.statusCode)) throw new RangeError(`Invalid status code: ${this.statusCode}`);
        this.body = body;
        return this;
      },
    };

    await handler({ params: { context: 'x', namespace: 'ns', name: 'p' }, query: {} }, res);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'EISDIR: illegal operation on a directory, read' });
  });
});

describe.each([
  ['pods', 'getPodMetrics'],
  ['nodes', 'getNodeMetrics'],
])('GET /api/:context/metrics/%s', (kind, method) => {
  it('returns the metric items for the requested context', async () => {
    const items = [{ metadata: { name: 'a' }, usage: { cpu: '10m', memory: '20Mi' } }];
    const metrics = { [method]: vi.fn(async () => ({ kind: 'List', items })) };
    k8s.createMetricsClient.mockReturnValue(metrics);

    const res = await request(app).get(`/api/my-ctx/metrics/${kind}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items });
    expect(k8s.createMetricsClient).toHaveBeenCalledExactlyOnceWith('my-ctx');
    expect(metrics[method]).toHaveBeenCalledExactlyOnceWith();
  });

  it('returns an empty list when the response has no items', async () => {
    k8s.createMetricsClient.mockReturnValue({ [method]: async () => ({}) });

    const res = await request(app).get(`/api/my-ctx/metrics/${kind}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('answers 502 with the API error message (e.g. metrics-server missing)', async () => {
    k8s.createMetricsClient.mockReturnValue({ [method]: () => Promise.reject(apiError(404, 'the server could not find the requested resource')) });

    const res = await request(app).get(`/api/my-ctx/metrics/${kind}`);

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'the server could not find the requested resource' });
  });

  it('answers 502 when the metrics client cannot be created', async () => {
    k8s.createMetricsClient.mockImplementation(() => {
      throw new Error('No active cluster!');
    });

    const res = await request(app).get(`/api/my-ctx/metrics/${kind}`);

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'No active cluster!' });
  });
});

describe('GET /api/:context/events', () => {
  it('lists events from all namespaces', async () => {
    const items = [{ reason: 'BackOff', message: 'Back-off restarting failed container' }];
    const listEventForAllNamespaces = vi.fn(async () => ({ items }));
    k8s.createApis.mockReturnValue({ coreApi: { listEventForAllNamespaces } });

    const res = await request(app).get('/api/my-ctx/events');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items });
    expect(k8s.createApis).toHaveBeenCalledWith('my-ctx');
    expect(listEventForAllNamespaces).toHaveBeenCalledExactlyOnceWith();
  });

  it('answers 502 with the API error message', async () => {
    k8s.createApis.mockReturnValue({ coreApi: { listEventForAllNamespaces: () => Promise.reject(apiError(403, 'events is forbidden')) } });

    const res = await request(app).get('/api/my-ctx/events');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'events is forbidden' });
  });

  it('answers 502 when the API clients cannot be created', async () => {
    k8s.createApis.mockImplementation(() => {
      throw new Error('No active cluster!');
    });

    const res = await request(app).get('/api/my-ctx/events');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'No active cluster!' });
  });
});

describe('GET /api/:context/crds', () => {
  it('lists the CustomResourceDefinitions', async () => {
    const items = [{ metadata: { name: 'widgets.example.com' } }];
    const listCustomResourceDefinition = vi.fn(async () => ({ items }));
    k8s.createApis.mockReturnValue({ apiextensionsApi: { listCustomResourceDefinition } });

    const res = await request(app).get('/api/my-ctx/crds');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items });
    expect(k8s.createApis).toHaveBeenCalledWith('my-ctx');
    expect(listCustomResourceDefinition).toHaveBeenCalledExactlyOnceWith();
  });

  it('answers 502 with the API error message', async () => {
    k8s.createApis.mockReturnValue({ apiextensionsApi: { listCustomResourceDefinition: () => Promise.reject(apiError(403, 'crds is forbidden', { bodyAsString: true })) } });

    const res = await request(app).get('/api/my-ctx/crds');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'crds is forbidden' });
  });

  it('answers 502 when the API clients cannot be created', async () => {
    k8s.createApis.mockImplementation(() => {
      throw new Error('No active cluster!');
    });

    const res = await request(app).get('/api/my-ctx/crds');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'No active cluster!' });
  });
});

describe('GET /api/:context/crds/:group/:version/:plural/instances', () => {
  it('lists cluster-wide instances, passing group/version/plural as an options object', async () => {
    const items = [{ metadata: { name: 'w1', namespace: 'a' } }];
    const listClusterCustomObject = vi.fn(async () => ({ items }));
    k8s.createApis.mockReturnValue({ customObjectsApi: { listClusterCustomObject } });

    const res = await request(app).get('/api/my-ctx/crds/example.com/v1beta1/widgets/instances');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items });
    expect(k8s.createApis).toHaveBeenCalledWith('my-ctx');
    expect(listClusterCustomObject).toHaveBeenCalledExactlyOnceWith({ group: 'example.com', version: 'v1beta1', plural: 'widgets' });
  });

  it('returns an empty list when the response has no items', async () => {
    k8s.createApis.mockReturnValue({ customObjectsApi: { listClusterCustomObject: async () => ({}) } });

    const res = await request(app).get('/api/my-ctx/crds/example.com/v1/widgets/instances');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('answers 502 with the API error message', async () => {
    k8s.createApis.mockReturnValue({ customObjectsApi: { listClusterCustomObject: () => Promise.reject(apiError(404, 'the server could not find the requested resource')) } });

    const res = await request(app).get('/api/my-ctx/crds/example.com/v1/widgets/instances');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'the server could not find the requested resource' });
  });

  it('answers 502 when the API clients cannot be created', async () => {
    k8s.createApis.mockImplementation(() => {
      throw new Error('No active cluster!');
    });

    const res = await request(app).get('/api/my-ctx/crds/example.com/v1/widgets/instances');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'No active cluster!' });
  });
});
