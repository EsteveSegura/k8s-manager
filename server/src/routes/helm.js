const { Router } = require('express');
const zlib = require('zlib');
const yaml = require('js-yaml');
const { createApis, errorMessage } = require('../k8s');

const router = Router();

// Helm 3 guarda cada revisión de un release como un Secret `owner=helm`. Su
// campo `release` es JSON serializado + gzip + base64 (codificación propia de Helm);
// ese resultado se guarda como bytes en el Secret, que a su vez el API de k8s
// codifica en base64 para el transporte — de ahí el doble base64.
function decodeRelease(secret) {
  const raw = secret.data && secret.data.release;
  if (!raw) return null;
  try {
    const helmBase64 = Buffer.from(raw, 'base64').toString('utf-8');
    const gzipped = Buffer.from(helmBase64, 'base64');
    const json = zlib.gunzipSync(gzipped).toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// El manifest de un release es un documento YAML multi-recurso; solo nos interesa
// kind/name/namespace de cada recurso para poder enlazarlo desde el frontend.
function parseManifestResources(manifest) {
  if (!manifest) return [];
  let docs;
  try {
    docs = yaml.loadAll(manifest);
  } catch {
    return [];
  }
  return docs
    .filter((doc) => doc && doc.kind && doc.metadata && doc.metadata.name)
    .map((doc) => ({ kind: doc.kind, name: doc.metadata.name, namespace: doc.metadata.namespace || null }));
}

router.get('/:context/helm/releases', async (req, res) => {
  const { context } = req.params;

  try {
    const { coreApi } = createApis(context);
    const result = await coreApi.listSecretForAllNamespaces({ labelSelector: 'owner=helm' });

    const latestByKey = new Map();
    for (const secret of result.items) {
      const release = decodeRelease(secret);
      if (!release) continue;
      const key = `${release.namespace}/${release.name}`;
      const existing = latestByKey.get(key);
      if (!existing || (release.version || 0) > (existing.version || 0)) {
        latestByKey.set(key, release);
      }
    }

    const items = Array.from(latestByKey.values()).map((release) => ({
      name: release.name,
      namespace: release.namespace,
      revision: release.version,
      status: release.info && release.info.status,
      lastDeployed: release.info && release.info.last_deployed,
      description: release.info && release.info.description,
      chart: release.chart && release.chart.metadata && release.chart.metadata.name,
      chartVersion: release.chart && release.chart.metadata && release.chart.metadata.version,
      appVersion: release.chart && release.chart.metadata && release.chart.metadata.appVersion,
      resources: parseManifestResources(release.manifest),
    }));

    res.json({ items });
  } catch (err) {
    res.status(502).json({ error: errorMessage(err) });
  }
});

module.exports = router;
