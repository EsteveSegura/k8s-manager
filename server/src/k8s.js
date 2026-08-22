const k8s = require('@kubernetes/client-node');

function loadKubeConfig() {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  return kc;
}

function createApis(contextName) {
  const kc = loadKubeConfig();
  kc.setCurrentContext(contextName);
  return {
    appsApi: kc.makeApiClient(k8s.AppsV1Api),
    coreApi: kc.makeApiClient(k8s.CoreV1Api),
    batchApi: kc.makeApiClient(k8s.BatchV1Api),
    networkingApi: kc.makeApiClient(k8s.NetworkingV1Api),
    apiextensionsApi: kc.makeApiClient(k8s.ApiextensionsV1Api),
    customObjectsApi: kc.makeApiClient(k8s.CustomObjectsApi),
  };
}

function createMetricsClient(contextName) {
  const kc = loadKubeConfig();
  kc.setCurrentContext(contextName);
  return new k8s.Metrics(kc);
}

// El mensaje útil de un error de la API de k8s (p.ej. "secrets is forbidden: ...")
// vive en `err.body.message`, no en `err.message` (que suele ser solo "Unknown API Status Code!").
// `err.body` puede llegar como objeto ya parseado o como el JSON crudo en texto, según el código de estado.
function errorMessage(err) {
  if (!err) return 'Error desconocido';
  let { body } = err;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  return (body && body.message) || err.message || 'Error desconocido';
}

module.exports = { loadKubeConfig, createApis, createMetricsClient, errorMessage };
