const { Router } = require('express');
const { loadKubeConfig } = require('../k8s');

const router = Router();

router.get('/contexts', (req, res) => {
  const kc = loadKubeConfig();

  const contexts = kc.getContexts().map((context) => ({
    name: context.name,
    cluster: context.cluster,
    namespace: context.namespace || null,
  }));

  res.json({ contexts });
});

module.exports = router;
