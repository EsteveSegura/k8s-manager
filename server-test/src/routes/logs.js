const { Router } = require('express');
const { getCluster } = require('../data/store');
const { getPodLogs, PodLogError } = require('../data/logs');

const router = Router();

router.get('/:context/pods/:namespace/:name/logs', (req, res) => {
  const { context, namespace, name } = req.params;
  const { container } = req.query;
  const tailLines = Number(req.query.tailLines) || 200;
  const timestamps = req.query.timestamps === 'true';

  const { resources, meta } = getCluster(context);
  const pod = resources.pods.find((p) => p.metadata.namespace === namespace && p.metadata.name === name);
  if (!pod) {
    res.status(404).json({ error: `pods "${name}" not found` });
    return;
  }

  try {
    const lines = getPodLogs(pod, meta, { container, tailLines, timestamps });
    res.json({ logs: lines.join('\n'), lines });
  } catch (err) {
    if (err instanceof PodLogError) {
      res.status(err.code).json({ error: err.message });
      return;
    }
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
