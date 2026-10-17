import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

// The server is CommonJS and its modules `require()` each other natively, which
// `vi.mock` cannot intercept. Instead, every test loads the app through Node's
// own require: the cached server modules are dropped, `src/k8s.js` is loaded
// first and its client factories are replaced with mocks, and only then is the
// app required — so the routes destructure the mocks instead of the real
// factories. `errorMessage` stays real, so error mapping is tested end to end.
export const require = createRequire(import.meta.url);

export const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

export function clearServerModules() {
  for (const id of Object.keys(require.cache)) {
    if (id.startsWith(SRC_DIR + path.sep)) delete require.cache[id];
  }
}

export function loadApp() {
  clearServerModules();
  const k8s = require(path.join(SRC_DIR, 'k8s'));
  const mocks = {
    createApis: vi.fn(() => {
      throw new Error('createApis not stubbed');
    }),
    createMetricsClient: vi.fn(() => {
      throw new Error('createMetricsClient not stubbed');
    }),
    loadKubeConfig: vi.fn(() => {
      throw new Error('loadKubeConfig not stubbed');
    }),
  };
  Object.assign(k8s, mocks);
  const app = require(path.join(SRC_DIR, 'app'));
  return { app, k8s: mocks, errorMessage: k8s.errorMessage };
}

export function requireSrc(relativePath) {
  return require(path.join(SRC_DIR, relativePath));
}

// A k8s API error as thrown by @kubernetes/client-node v2 (`ApiException`):
// the HTTP status lives in `code` and the useful message in `body.message`.
export function apiError(code, message, { bodyAsString = false } = {}) {
  const body = { kind: 'Status', status: 'Failure', message, code };
  const err = new Error(`HTTP-Code: ${code}\nMessage: Unknown API Status Code!`);
  err.code = code;
  err.body = bodyAsString ? JSON.stringify(body) : body;
  return err;
}
