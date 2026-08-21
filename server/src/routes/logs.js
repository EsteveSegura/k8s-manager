const { Router } = require('express');
const { createApis } = require('../k8s');

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
    let message = err.message;
    try {
      const body = typeof err.body === 'string' ? JSON.parse(err.body) : err.body;
      if (body?.message) message = body.message;
    } catch {
      // el body no era JSON parseable, se deja el mensaje original
    }
    res.status(err.code || 502).json({ error: message });
  }
});

module.exports = router;
