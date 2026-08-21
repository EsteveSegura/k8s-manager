const { Router } = require('express');
const { createApis } = require('../k8s');

const router = Router();

router.get('/:context/resources', async (req, res) => {
  const { context } = req.params;

  try {
    const { appsApi, coreApi } = createApis(context);

    const [deployments, services, pods] = await Promise.all([
      appsApi.listDeploymentForAllNamespaces(),
      coreApi.listServiceForAllNamespaces(),
      coreApi.listPodForAllNamespaces(),
    ]);

    res.json({
      deployments: deployments.items,
      services: services.items,
      pods: pods.items,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
