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
    autoscalingApi: kc.makeApiClient(k8s.AutoscalingV2Api),
    policyApi: kc.makeApiClient(k8s.PolicyV1Api),
  };
}

function createMetricsClient(contextName) {
  const kc = loadKubeConfig();
  kc.setCurrentContext(contextName);
  return new k8s.Metrics(kc);
}

// The useful message from a k8s API error (e.g. "secrets is forbidden: ...")
// lives in `err.body.message`, not `err.message` (which is usually just "Unknown API Status Code!").
// `err.body` can arrive as an already-parsed object or as raw JSON text, depending on the status code.
function errorMessage(err) {
  if (!err) return 'Unknown error';
  let { body } = err;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  return (body && body.message) || err.message || 'Unknown error';
}

module.exports = { loadKubeConfig, createApis, createMetricsClient, errorMessage };
