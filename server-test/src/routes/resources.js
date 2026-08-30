const { Router } = require('express');
const { getCluster } = require('../data/store');

const router = Router();

// Same as in `server/src/routes/resources.js`: Secrets never reach the
// frontend with their content, only the names of their keys.
function redactSecret(secret) {
  const { data, stringData, ...rest } = secret;
  return { ...rest, dataKeys: Object.keys(data || stringData || {}) };
}

router.get('/:context/resources', (req, res) => {
  const { resources } = getCluster(req.params.context);
  const data = { ...resources, secrets: resources.secrets.map(redactSecret) };
  res.json({ ...data, errors: {} });
});

module.exports = router;
