import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearServerModules, require, requireSrc } from './helpers/load-app.js';

const k8sClient = require('@kubernetes/client-node');

const KUBECONFIG_YAML = `
apiVersion: v1
kind: Config
clusters:
- name: cluster-a
  cluster: { server: 'https://a.example.test:6443' }
- name: cluster-b
  cluster: { server: 'https://b.example.test:6443' }
contexts:
- name: ctx-a
  context: { cluster: cluster-a, user: user-a, namespace: team-a }
- name: ctx-b
  context: { cluster: cluster-b, user: user-a }
users:
- name: user-a
  user: { token: not-a-real-token }
current-context: ctx-a
`;

// Where a generated client would send a request, i.e. which cluster it targets.
function serverOf(apiClient) {
  return apiClient.api.configuration.baseServer.makeRequestContext('/probe', 'GET').getUrl();
}

describe('k8s', () => {
  let tmpDir;
  let previousKubeconfig;
  let k8s;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'k8s-manager-test-'));
    fs.writeFileSync(path.join(tmpDir, 'config'), KUBECONFIG_YAML);
    previousKubeconfig = process.env.KUBECONFIG;
    process.env.KUBECONFIG = path.join(tmpDir, 'config');
  });

  afterAll(() => {
    if (previousKubeconfig === undefined) delete process.env.KUBECONFIG;
    else process.env.KUBECONFIG = previousKubeconfig;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    clearServerModules();
    k8s = requireSrc('k8s');
  });

  describe('loadKubeConfig', () => {
    it('loads the default kubeconfig (KUBECONFIG)', () => {
      const kc = k8s.loadKubeConfig();
      expect(kc).toBeInstanceOf(k8sClient.KubeConfig);
      expect(kc.getContexts().map((c) => c.name)).toEqual(['ctx-a', 'ctx-b']);
      expect(kc.getCurrentContext()).toBe('ctx-a');
    });

    it('returns a new instance on every call', () => {
      expect(k8s.loadKubeConfig()).not.toBe(k8s.loadKubeConfig());
    });
  });

  describe('createApis', () => {
    it('builds every API client against the requested context, not the current-context', () => {
      const apis = k8s.createApis('ctx-b');
      const expected = {
        appsApi: k8sClient.AppsV1Api,
        coreApi: k8sClient.CoreV1Api,
        batchApi: k8sClient.BatchV1Api,
        networkingApi: k8sClient.NetworkingV1Api,
        apiextensionsApi: k8sClient.ApiextensionsV1Api,
        customObjectsApi: k8sClient.CustomObjectsApi,
        autoscalingApi: k8sClient.AutoscalingV2Api,
        policyApi: k8sClient.PolicyV1Api,
      };
      expect(Object.keys(apis).sort()).toEqual(Object.keys(expected).sort());
      for (const [key, ApiClass] of Object.entries(expected)) {
        expect(apis[key], key).toBeInstanceOf(ApiClass);
        expect(serverOf(apis[key]), key).toBe('https://b.example.test:6443/probe');
      }
    });

    it('uses a fresh KubeConfig on every call so concurrent requests never share context', () => {
      const setCurrentContext = vi.spyOn(k8sClient.KubeConfig.prototype, 'setCurrentContext');
      const a = k8s.createApis('ctx-a');
      const b = k8s.createApis('ctx-b');

      expect(setCurrentContext).toHaveBeenCalledTimes(2);
      expect(setCurrentContext.mock.calls).toEqual([['ctx-a'], ['ctx-b']]);
      expect(setCurrentContext.mock.contexts[0]).not.toBe(setCurrentContext.mock.contexts[1]);
      // Creating the second set of clients did not retarget the first one.
      expect(serverOf(a.coreApi)).toBe('https://a.example.test:6443/probe');
      expect(serverOf(b.coreApi)).toBe('https://b.example.test:6443/probe');
    });

    it('throws for an unknown context', () => {
      expect(() => k8s.createApis('does-not-exist')).toThrow('No active cluster!');
    });
  });

  describe('createMetricsClient', () => {
    it('returns a Metrics client bound to a fresh KubeConfig on the requested context', () => {
      const first = k8s.createMetricsClient('ctx-b');
      const second = k8s.createMetricsClient('ctx-a');
      expect(first).toBeInstanceOf(k8sClient.Metrics);
      expect(first.config.getCurrentContext()).toBe('ctx-b');
      expect(second.config.getCurrentContext()).toBe('ctx-a');
      expect(first.config).not.toBe(second.config);
    });
  });

  describe('errorMessage', () => {
    it('returns a generic message when there is no error', () => {
      expect(k8s.errorMessage(undefined)).toBe('Unknown error');
      expect(k8s.errorMessage(null)).toBe('Unknown error');
    });

    it('prefers body.message when the body is an already-parsed object', () => {
      const err = new Error('Unknown API Status Code!');
      err.body = { message: 'secrets is forbidden' };
      expect(k8s.errorMessage(err)).toBe('secrets is forbidden');
    });

    it('parses body.message when the body is raw JSON text', () => {
      const err = new Error('Unknown API Status Code!');
      err.body = JSON.stringify({ kind: 'Status', message: 'pods "x" not found' });
      expect(k8s.errorMessage(err)).toBe('pods "x" not found');
    });

    it('falls back to err.message when the body is a non-JSON string', () => {
      const err = new Error('socket hang up');
      err.body = '<html>Bad Gateway</html>';
      expect(k8s.errorMessage(err)).toBe('socket hang up');
    });

    it('falls back to err.message when the body has no message', () => {
      const objectBody = new Error('HTTP 500');
      objectBody.body = { kind: 'Status' };
      expect(k8s.errorMessage(objectBody)).toBe('HTTP 500');

      const jsonBody = new Error('HTTP 500');
      jsonBody.body = '{"kind":"Status"}';
      expect(k8s.errorMessage(jsonBody)).toBe('HTTP 500');

      const nullBody = new Error('HTTP 500');
      nullBody.body = 'null';
      expect(k8s.errorMessage(nullBody)).toBe('HTTP 500');
    });

    it('falls back to err.message when there is no body', () => {
      expect(k8s.errorMessage(new Error('fetch failed'))).toBe('fetch failed');
    });

    it('returns a generic message when neither body nor message carry one', () => {
      expect(k8s.errorMessage({})).toBe('Unknown error');
      expect(k8s.errorMessage({ body: '', message: '' })).toBe('Unknown error');
      expect(k8s.errorMessage({ body: 'not json' })).toBe('Unknown error');
    });
  });
});
