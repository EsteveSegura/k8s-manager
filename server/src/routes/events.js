const { Router } = require('express');
const { createApis, errorMessage } = require('../k8s');

const router = Router();

router.get('/:context/events', async (req, res) => {
  const { context } = req.params;

  try {
    const { coreApi } = createApis(context);
    const result = await coreApi.listEventForAllNamespaces();
    res.json({ items: result.items });
  } catch (err) {
    res.status(502).json({ error: errorMessage(err) });
  }
});

module.exports = router;
