const { Router } = require('express');
const { createApis, errorMessage } = require('../k8s');

const router = Router();

router.get('/:context/pods/:namespace/:name/logs', async (req, res) => {
  const { context, namespace, name } = req.params;
  const { container } = req.query;
  const tailLines = Number(req.query.tailLines) || 200;
  const timestamps = req.query.timestamps === 'true';

  try {
    const { coreApi } = createApis(context);

    const logs = await coreApi.readNamespacedPodLog({
      name,
      namespace,
      container: container || undefined,
      tailLines,
      timestamps,
    });

    res.json({ logs, lines: logs.split('\n') });
  } catch (err) {
    res.status(err.code || 502).json({ error: errorMessage(err) });
  }
});

module.exports = router;
