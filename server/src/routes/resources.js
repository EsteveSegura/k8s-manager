const { Router } = require('express');
const { createApis, errorMessage } = require('../k8s');

const router = Router();

// `kubectl apply` stores the whole applied manifest in this annotation, so for a
// Secret it holds a copy of its values (`data`/`stringData`).
const LAST_APPLIED_ANNOTATION = 'kubectl.kubernetes.io/last-applied-configuration';

// Secrets must never reach the frontend with their content: only their key
// names are sent, never `data`/`stringData` nor the last-applied copy of them.
function redactSecret(secret) {
  const { data, stringData, ...rest } = secret;
  const annotations = rest.metadata?.annotations;
  if (annotations && LAST_APPLIED_ANNOTATION in annotations) {
    const { [LAST_APPLIED_ANNOTATION]: _lastApplied, ...safeAnnotations } = annotations;
    rest.metadata = { ...rest.metadata, annotations: safeAnnotations };
  }
  return { ...rest, dataKeys: Object.keys(data || stringData || {}) };
}

router.get('/:context/resources', async (req, res) => {
  const { context } = req.params;

  let apis;
  try {
    apis = createApis(context);
  } catch (err) {
    res.status(502).json({ error: errorMessage(err) });
    return;
  }
  const { appsApi, coreApi, batchApi, networkingApi, autoscalingApi, policyApi } = apis;

  // Each resource type is requested separately: the user might not have permission
  // to list some of them (e.g. Secrets or Nodes) in this particular context/cluster,
  // and that shouldn't break the rest of the tabs. With Promise.all, a single 403
  // (e.g. secrets) brought down the ENTIRE response and left the whole app with no data.
  const RESOURCE_FETCHERS = [
    ['deployments', () => appsApi.listDeploymentForAllNamespaces()],
    ['services', () => coreApi.listServiceForAllNamespaces()],
    ['pods', () => coreApi.listPodForAllNamespaces()],
    ['statefulsets', () => appsApi.listStatefulSetForAllNamespaces()],
    ['daemonsets', () => appsApi.listDaemonSetForAllNamespaces()],
    ['jobs', () => batchApi.listJobForAllNamespaces()],
    ['cronjobs', () => batchApi.listCronJobForAllNamespaces()],
    ['ingresses', () => networkingApi.listIngressForAllNamespaces()],
    ['configmaps', () => coreApi.listConfigMapForAllNamespaces()],
    ['secrets', () => coreApi.listSecretForAllNamespaces()],
    ['persistentvolumeclaims', () => coreApi.listPersistentVolumeClaimForAllNamespaces()],
    ['persistentvolumes', () => coreApi.listPersistentVolume()],
    ['nodes', () => coreApi.listNode()],
    ['horizontalpodautoscalers', () => autoscalingApi.listHorizontalPodAutoscalerForAllNamespaces()],
    ['namespaces', () => coreApi.listNamespace()],
    ['resourcequotas', () => coreApi.listResourceQuotaForAllNamespaces()],
    ['limitranges', () => coreApi.listLimitRangeForAllNamespaces()],
    ['networkpolicies', () => networkingApi.listNetworkPolicyForAllNamespaces()],
    ['endpoints', () => coreApi.listEndpointsForAllNamespaces()],
    ['poddisruptionbudgets', () => policyApi.listPodDisruptionBudgetForAllNamespaces()],
  ];

  const results = await Promise.allSettled(RESOURCE_FETCHERS.map(([, fetcher]) => fetcher()));

  const data = {};
  const errors = {};

  RESOURCE_FETCHERS.forEach(([kind], index) => {
    const result = results[index];
    if (result.status === 'fulfilled') {
      data[kind] = kind === 'secrets' ? result.value.items.map(redactSecret) : result.value.items;
    } else {
      data[kind] = [];
      errors[kind] = errorMessage(result.reason);
    }
  });

  res.json({ ...data, errors });
});

module.exports = router;
// Exposed for unit tests.
module.exports.redactSecret = redactSecret;
