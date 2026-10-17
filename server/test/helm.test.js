import zlib from 'node:zlib';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError, loadApp, requireSrc } from './helpers/load-app.js';

const MANIFEST = `---
# Source: web/templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: shop
spec:
  ports: [{ port: 80 }]
---
# Source: web/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
---
# Source: web/templates/empty.yaml
`;

// Encodes a release the way Helm 3 does (JSON -> gzip -> base64) and then the
// way the k8s API transports Secret bytes (base64 again).
function encodeRelease(release) {
  const helmBase64 = zlib.gzipSync(Buffer.from(JSON.stringify(release))).toString('base64');
  return Buffer.from(helmBase64).toString('base64');
}

function helmSecret(release, name = `sh.helm.release.v1.${release.name}.v${release.version}`) {
  return {
    metadata: { name, namespace: release.namespace, labels: { owner: 'helm', name: release.name } },
    type: 'helm.sh/release.v1',
    data: { release: encodeRelease(release) },
  };
}

function release(overrides = {}) {
  return {
    name: 'web',
    namespace: 'shop',
    version: 1,
    info: { status: 'deployed', last_deployed: '2026-01-02T03:04:05Z', description: 'Install complete' },
    chart: { metadata: { name: 'web-chart', version: '1.2.3', appVersion: '4.5.6' } },
    manifest: MANIFEST,
    ...overrides,
  };
}

describe('decodeRelease', () => {
  const { decodeRelease } = requireSrc('routes/helm');

  it('decodes base64(base64(gzip(JSON))) as Helm stores it in a Secret', () => {
    const rel = release({ config: { replicas: 3 } });
    expect(decodeRelease(helmSecret(rel))).toEqual(rel);
  });

  it('returns null when there is no release payload', () => {
    expect(decodeRelease({})).toBeNull();
    expect(decodeRelease({ data: {} })).toBeNull();
    expect(decodeRelease({ data: { release: '' } })).toBeNull();
  });

  it('returns null for malformed payloads instead of throwing', () => {
    // Not gzip after decoding.
    expect(decodeRelease({ data: { release: Buffer.from('aGVsbG8=').toString('base64') } })).toBeNull();
    // Single base64 layer only (gzip bytes are not valid base64 text).
    const singleLayer = zlib.gzipSync(Buffer.from(JSON.stringify(release()))).toString('base64');
    expect(decodeRelease({ data: { release: singleLayer } })).toBeNull();
    // Valid gzip but not JSON.
    const notJson = Buffer.from(zlib.gzipSync(Buffer.from('not json')).toString('base64')).toString('base64');
    expect(decodeRelease({ data: { release: notJson } })).toBeNull();
  });
});

describe('parseManifestResources', () => {
  const { parseManifestResources } = requireSrc('routes/helm');

  it('extracts kind/name/namespace of every resource in a multi-document manifest', () => {
    expect(parseManifestResources(MANIFEST)).toEqual([
      { kind: 'Service', name: 'web', namespace: 'shop' },
      { kind: 'Deployment', name: 'web', namespace: null },
    ]);
  });

  it('skips documents without kind, metadata or name', () => {
    const manifest = ['kind: ConfigMap', 'metadata: { name: no-kind }', 'kind: ConfigMap\nmetadata: { namespace: x }', 'just a string', '42', 'kind: Secret\nmetadata: { name: ok }'].join('\n---\n');
    expect(parseManifestResources(manifest)).toEqual([{ kind: 'Secret', name: 'ok', namespace: null }]);
  });

  it('returns an empty list for missing or invalid YAML', () => {
    expect(parseManifestResources(undefined)).toEqual([]);
    expect(parseManifestResources('')).toEqual([]);
    expect(parseManifestResources('kind: [unclosed')).toEqual([]);
  });
});

describe('GET /api/:context/helm/releases', () => {
  let app;
  let k8s;
  let listSecretForAllNamespaces;

  function stubSecrets(items) {
    listSecretForAllNamespaces = vi.fn(async () => ({ items }));
    k8s.createApis.mockReturnValue({ coreApi: { listSecretForAllNamespaces } });
  }

  beforeEach(() => {
    ({ app, k8s } = loadApp());
  });

  it('lists only Helm secrets, filtering with a labelSelector options object', async () => {
    stubSecrets([]);

    const res = await request(app).get('/api/my-ctx/helm/releases');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
    expect(k8s.createApis).toHaveBeenCalledWith('my-ctx');
    expect(listSecretForAllNamespaces).toHaveBeenCalledExactlyOnceWith({ labelSelector: 'owner=helm' });
  });

  it('maps a release to its summary with the resources from its manifest', async () => {
    stubSecrets([helmSecret(release())]);

    const res = await request(app).get('/api/my-ctx/helm/releases');

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      {
        name: 'web',
        namespace: 'shop',
        revision: 1,
        status: 'deployed',
        lastDeployed: '2026-01-02T03:04:05Z',
        description: 'Install complete',
        chart: 'web-chart',
        chartVersion: '1.2.3',
        appVersion: '4.5.6',
        resources: [
          { kind: 'Service', name: 'web', namespace: 'shop' },
          { kind: 'Deployment', name: 'web', namespace: null },
        ],
      },
    ]);
  });

  it('keeps only the latest revision of each release, regardless of order', async () => {
    stubSecrets([
      helmSecret(release({ version: 2, info: { status: 'superseded' } })),
      helmSecret(release({ version: 3, info: { status: 'deployed' } })),
      helmSecret(release({ version: 1, info: { status: 'superseded' } })),
      helmSecret(release({ namespace: 'staging', version: 1, info: { status: 'failed' } })),
      helmSecret(release({ name: 'api', version: 7, info: { status: 'deployed' } })),
    ]);

    const res = await request(app).get('/api/my-ctx/helm/releases');

    expect(res.status).toBe(200);
    expect(res.body.items.map(({ name, namespace, revision, status }) => ({ name, namespace, revision, status }))).toEqual([
      { name: 'web', namespace: 'shop', revision: 3, status: 'deployed' },
      { name: 'web', namespace: 'staging', revision: 1, status: 'failed' },
      { name: 'api', namespace: 'shop', revision: 7, status: 'deployed' },
    ]);
  });

  it('keeps the first one seen when two secrets claim the same revision', async () => {
    stubSecrets([helmSecret(release({ info: { status: 'first' } })), helmSecret(release({ info: { status: 'second' } }))]);

    const res = await request(app).get('/api/my-ctx/helm/releases');

    expect(res.body.items.map((item) => item.status)).toEqual(['first']);
  });

  it('treats a missing revision number as 0', async () => {
    stubSecrets([helmSecret(release({ version: undefined, info: { status: 'unversioned' } })), helmSecret(release({ version: 1, info: { status: 'v1' } }))]);
    const res = await request(app).get('/api/my-ctx/helm/releases');
    expect(res.body.items.map((item) => item.status)).toEqual(['v1']);

    stubSecrets([helmSecret(release({ version: 1, info: { status: 'v1' } })), helmSecret(release({ version: undefined, info: { status: 'unversioned' } }))]);
    const again = await request(app).get('/api/my-ctx/helm/releases');
    expect(again.body.items.map((item) => item.status)).toEqual(['v1']);
  });

  it('skips undecodable secrets and tolerates releases without info, chart or manifest', async () => {
    stubSecrets([
      { metadata: { name: 'broken' }, data: { release: 'definitely-not-a-release' } },
      { metadata: { name: 'empty' } },
      helmSecret({ name: 'bare', namespace: 'tools', version: 4 }),
      helmSecret({ name: 'no-chart-metadata', namespace: 'tools', version: 1, chart: {}, info: {} }),
    ]);

    const res = await request(app).get('/api/my-ctx/helm/releases');

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      { name: 'bare', namespace: 'tools', revision: 4, resources: [] },
      { name: 'no-chart-metadata', namespace: 'tools', revision: 1, resources: [] },
    ]);
  });

  it('answers 502 with the API error message when listing fails', async () => {
    k8s.createApis.mockReturnValue({ coreApi: { listSecretForAllNamespaces: () => Promise.reject(apiError(403, 'secrets is forbidden')) } });

    const res = await request(app).get('/api/my-ctx/helm/releases');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'secrets is forbidden' });
  });

  it('answers 502 when the API clients cannot be created', async () => {
    k8s.createApis.mockImplementation(() => {
      throw new Error('No active cluster!');
    });

    const res = await request(app).get('/api/nope/helm/releases');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'No active cluster!' });
  });
});
