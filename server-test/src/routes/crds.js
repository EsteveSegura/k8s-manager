const { Router } = require('express');
const { getCluster } = require('../data/store');

const router = Router();

router.get('/:context/crds', (req, res) => {
  const { crds } = getCluster(req.params.context);
  res.json({ items: crds });
});

router.get('/:context/crds/:group/:version/:plural/instances', (req, res) => {
  const { context, group, version, plural } = req.params;
  const { instancesByKey } = getCluster(context);
  const items = instancesByKey[`${group}/${version}/${plural}`] || [];
  res.json({ items });
});

module.exports = router;
