const { Router } = require('express');
const { getCluster } = require('../data/store');
const { buildPodMetrics, buildNodeMetrics } = require('../data/metrics');

const router = Router();

router.get('/:context/metrics/pods', (req, res) => {
  const { resources } = getCluster(req.params.context);
  res.json({ items: buildPodMetrics(resources.pods) });
});

router.get('/:context/metrics/nodes', (req, res) => {
  const { resources } = getCluster(req.params.context);
  res.json({ items: buildNodeMetrics(resources.nodes) });
});

module.exports = router;
