const { buildCluster } = require('./cluster');
const { buildHelmReleases } = require('./helm');
const { buildCrds } = require('./crds');
const { buildEvents } = require('./events');

const CONTEXTS = [
  { name: 'demo-production', cluster: 'gke_demo-prod_europe-west1_demo-prod', namespace: null, profile: 'production' },
  { name: 'demo-staging', cluster: 'gke_demo-prod_europe-west1_demo-staging', namespace: null, profile: 'staging' },
];

const cache = new Map();

function getContexts() {
  return CONTEXTS.map(({ name, cluster, namespace }) => ({ name, cluster, namespace }));
}

function getCluster(contextName) {
  if (cache.has(contextName)) return cache.get(contextName);

  const contextDef = CONTEXTS.find((c) => c.name === contextName);
  const profile = contextDef ? contextDef.profile : 'staging';

  const { resources, meta } = buildCluster(profile);
  const events = buildEvents(resources, meta);
  const helmReleases = buildHelmReleases(resources, profile);
  const { crds, instancesByKey } = buildCrds();

  const entry = { resources, meta, events, helmReleases, crds, instancesByKey };
  cache.set(contextName, entry);
  return entry;
}

module.exports = { getContexts, getCluster };
