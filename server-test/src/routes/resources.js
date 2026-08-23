const { Router } = require('express');
const { getCluster } = require('../data/store');

const router = Router();

// Igual que en `server/src/routes/resources.js`: los Secrets nunca llegan al
// frontend con su contenido, solo los nombres de sus claves.
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
