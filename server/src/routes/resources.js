const { Router } = require('express');
const { createApis, errorMessage } = require('../k8s');

const router = Router();

// Los Secrets nunca deben llegar al frontend con su contenido: solo se envían
// sus nombres de clave, nunca `data`/`stringData`.
function redactSecret(secret) {
  const { data, stringData, ...rest } = secret;
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

  // Cada tipo de recurso se pide por separado: el usuario puede no tener permiso
  // de listar algunos (p.ej. Secrets o Nodes) en este contexto/clúster concreto,
  // y eso no debe romper el resto de pestañas. Con Promise.all, un solo 403
  // (p.ej. secrets) tiraba abajo TODA la respuesta y dejaba la app entera sin datos.
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
