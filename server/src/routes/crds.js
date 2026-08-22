const { Router } = require('express');
const { createApis, errorMessage } = require('../k8s');

const router = Router();

router.get('/:context/crds', async (req, res) => {
  const { context } = req.params;

  try {
    const { apiextensionsApi } = createApis(context);
    const result = await apiextensionsApi.listCustomResourceDefinition();
    res.json({ items: result.items });
  } catch (err) {
    res.status(502).json({ error: errorMessage(err) });
  }
});

router.get('/:context/crds/:group/:version/:plural/instances', async (req, res) => {
  const { context, group, version, plural } = req.params;

  try {
    const { customObjectsApi } = createApis(context);
    const result = await customObjectsApi.listClusterCustomObject({ group, version, plural });
    res.json({ items: result.items || [] });
  } catch (err) {
    res.status(502).json({ error: errorMessage(err) });
  }
});

module.exports = router;
