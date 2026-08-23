const { Router } = require('express');
const { getCluster } = require('../data/store');

const router = Router();

router.get('/:context/events', (req, res) => {
  const { events } = getCluster(req.params.context);
  res.json({ items: events });
});

module.exports = router;
