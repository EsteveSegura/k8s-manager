const { Router } = require('express');
const { createMetricsClient } = require('../k8s');

const router = Router();

router.get('/:context/metrics/pods', async (req, res) => {
  const { context } = req.params;

  try {
    const metrics = createMetricsClient(context);
    const data = await metrics.getPodMetrics();
    res.json({ items: data.items || [] });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
