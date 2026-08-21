const k8s = require('@kubernetes/client-node');

async function listResources(contextName) {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  kc.setCurrentContext(contextName);

  const appsApi = kc.makeApiClient(k8s.AppsV1Api);
  const coreApi = kc.makeApiClient(k8s.CoreV1Api);

  const [deployments, services, pods] = await Promise.all([
    appsApi.listDeploymentForAllNamespaces(),
    coreApi.listServiceForAllNamespaces(),
    coreApi.listPodForAllNamespaces(),
  ]);

  console.log(`\n=== Contexto: ${contextName} ===`);

  console.log(`\nDeployments (${deployments.items.length}):`);
  deployments.items.forEach((d) => {
    console.log(`  - ${d.metadata.namespace}/${d.metadata.name}`);
  });

  console.log(`\nServices (${services.items.length}):`);
  services.items.forEach((s) => {
    console.log(`  - ${s.metadata.namespace}/${s.metadata.name}`);
  });

  console.log(`\nPods (${pods.items.length}):`);
  pods.items.forEach((p) => {
    console.log(`  - ${p.metadata.namespace}/${p.metadata.name}`);
  });
}

async function main() {
  const filter = process.argv[2];

  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  const contexts = kc.getContexts().filter((c) => !filter || c.name.includes(filter));

  if (contexts.length === 0) {
    console.error(`No hay ningún contexto que coincida con "${filter}"`);
    process.exit(1);
  }

  for (const context of contexts) {
    try {
      await listResources(context.name);
    } catch (err) {
      console.error(`\n=== Contexto: ${context.name} ===`);
      console.error(`  Error al conectar: ${err.message}`);
    }
  }
}

main();
