const { Router } = require('express');
const { getCluster } = require('../data/store');

const router = Router();

router.get('/:context/helm/releases', (req, res) => {
  const { helmReleases } = getCluster(req.params.context);
  res.json({ items: helmReleases });
});

module.exports = router;
