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
  };
}

function createMetricsClient(contextName) {
  const kc = loadKubeConfig();
  kc.setCurrentContext(contextName);
  return new k8s.Metrics(kc);
}

module.exports = { loadKubeConfig, createApis, createMetricsClient };
