const { Router } = require('express');
const { getContexts } = require('../data/store');

const router = Router();

router.get('/contexts', (req, res) => {
  res.json({ contexts: getContexts() });
});

module.exports = router;
