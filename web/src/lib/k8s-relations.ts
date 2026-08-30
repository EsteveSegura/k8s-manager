function matchesSelector(labels: Record<string, string> | undefined, selector: Record<string, string> | undefined) {
  if (!selector || Object.keys(selector).length === 0) return false
  if (!labels) return false
  return Object.entries(selector).every(([key, value]) => labels[key] === value)
}

// A `podSelector: {}` (or without `matchLabels`) in a NetworkPolicy means "all
// pods in the namespace" (unlike the Service/Deployment selector, where empty
// means "none"). Receives the full LabelSelector, not just `matchLabels`.
function matchesPodSelector(labels: Record<string, string> | undefined, podSelector: { matchLabels?: Record<string, string> } | undefined) {
  const matchLabels = podSelector?.matchLabels
  if (!matchLabels || Object.keys(matchLabels).length === 0) return true
  if (!labels) return false
  return Object.entries(matchLabels).every(([key, value]) => labels[key] === value)
}

export function servicesForDeployment(deployment: any, services: any[]) {
  const namespace = deployment.metadata?.namespace
  const podLabels = deployment.spec?.template?.metadata?.labels
  return services.filter(
    (service) => service.metadata?.namespace === namespace && matchesSelector(podLabels, service.spec?.selector),
  )
}

export function podsForSelector(namespace: string | undefined, selector: Record<string, string> | undefined, pods: any[]) {
  return pods.filter((pod) => pod.metadata?.namespace === namespace && matchesSelector(pod.metadata?.labels, selector))
}

export function podsForService(service: any, pods: any[]) {
  return podsForSelector(service.metadata?.namespace, service.spec?.selector, pods)
}

export function podsForDeployment(deployment: any, pods: any[]) {
  return podsForSelector(deployment.metadata?.namespace, deployment.spec?.selector?.matchLabels, pods)
}

export function deploymentsForPod(pod: any, deployments: any[]) {
  const namespace = pod.metadata?.namespace
  const podLabels = pod.metadata?.labels
  return deployments.filter(
    (deployment) => deployment.metadata?.namespace === namespace && matchesSelector(podLabels, deployment.spec?.selector?.matchLabels),
  )
}

export function servicesForPod(pod: any, services: any[]) {
  const namespace = pod.metadata?.namespace
  const podLabels = pod.metadata?.labels
  return services.filter(
    (service) => service.metadata?.namespace === namespace && matchesSelector(podLabels, service.spec?.selector),
  )
}

export function deploymentsForService(service: any, deployments: any[]) {
  const namespace = service.metadata?.namespace
  const selector = service.spec?.selector
  return deployments.filter(
    (deployment) =>
      deployment.metadata?.namespace === namespace &&
      matchesSelector(deployment.spec?.template?.metadata?.labels, selector),
  )
}

export function podsForStatefulSet(statefulSet: any, pods: any[]) {
  return podsForSelector(statefulSet.metadata?.namespace, statefulSet.spec?.selector?.matchLabels, pods)
}

export function podsForDaemonSet(daemonSet: any, pods: any[]) {
  return podsForSelector(daemonSet.metadata?.namespace, daemonSet.spec?.selector?.matchLabels, pods)
}

export function podsForJob(job: any, pods: any[]) {
  return podsForSelector(job.metadata?.namespace, job.spec?.selector?.matchLabels, pods)
}

export function jobsForCronJob(cronJob: any, jobs: any[]) {
  const namespace = cronJob.metadata?.namespace
  const uid = cronJob.metadata?.uid
  return jobs.filter(
    (job) => job.metadata?.namespace === namespace && (job.metadata?.ownerReferences || []).some((ref: any) => ref.uid === uid),
  )
}

function referencedConfigMapNames(pod: any): Set<string> {
  const names = new Set<string>()
  for (const volume of pod.spec?.volumes || []) {
    if (volume.configMap?.name) names.add(volume.configMap.name)
  }
  const containers = [...(pod.spec?.containers || []), ...(pod.spec?.initContainers || [])]
  for (const container of containers) {
    for (const envFrom of container.envFrom || []) {
      if (envFrom.configMapRef?.name) names.add(envFrom.configMapRef.name)
    }
    for (const env of container.env || []) {
      if (env.valueFrom?.configMapKeyRef?.name) names.add(env.valueFrom.configMapKeyRef.name)
    }
  }
  return names
}

function referencedSecretNames(pod: any): Set<string> {
  const names = new Set<string>()
  for (const volume of pod.spec?.volumes || []) {
    if (volume.secret?.secretName) names.add(volume.secret.secretName)
  }
  for (const pullSecret of pod.spec?.imagePullSecrets || []) {
    if (pullSecret.name) names.add(pullSecret.name)
  }
  const containers = [...(pod.spec?.containers || []), ...(pod.spec?.initContainers || [])]
  for (const container of containers) {
    for (const envFrom of container.envFrom || []) {
      if (envFrom.secretRef?.name) names.add(envFrom.secretRef.name)
    }
    for (const env of container.env || []) {
      if (env.valueFrom?.secretKeyRef?.name) names.add(env.valueFrom.secretKeyRef.name)
    }
  }
  return names
}

export function podsForConfigMap(configMap: any, pods: any[]) {
  const namespace = configMap.metadata?.namespace
  const name = configMap.metadata?.name
  return pods.filter((pod) => pod.metadata?.namespace === namespace && referencedConfigMapNames(pod).has(name))
}

export function podsForSecret(secret: any, pods: any[]) {
  const namespace = secret.metadata?.namespace
  const name = secret.metadata?.name
  return pods.filter((pod) => pod.metadata?.namespace === namespace && referencedSecretNames(pod).has(name))
}

export function podsForPersistentVolumeClaim(pvc: any, pods: any[]) {
  const namespace = pvc.metadata?.namespace
  const name = pvc.metadata?.name
  return pods.filter(
    (pod) =>
      pod.metadata?.namespace === namespace &&
      (pod.spec?.volumes || []).some((volume: any) => volume.persistentVolumeClaim?.claimName === name),
  )
}

export function podsForNode(node: any, pods: any[]) {
  const nodeName = node.metadata?.name
  return pods.filter((pod) => pod.spec?.nodeName === nodeName)
}

export function persistentVolumeForClaim(pvc: any, persistentVolumes: any[]) {
  const volumeName = pvc.spec?.volumeName
  if (!volumeName) return null
  return persistentVolumes.find((pv) => pv.metadata?.name === volumeName) || null
}

export function persistentVolumeClaimForVolume(pv: any, persistentVolumeClaims: any[]) {
  const claimRef = pv.spec?.claimRef
  if (!claimRef) return null
  return (
    persistentVolumeClaims.find(
      (pvc) => pvc.metadata?.namespace === claimRef.namespace && pvc.metadata?.name === claimRef.name,
    ) || null
  )
}

export function targetForHorizontalPodAutoscaler(hpa: any, deployments: any[], statefulsets: any[]) {
  const ref = hpa.spec?.scaleTargetRef
  const namespace = hpa.metadata?.namespace
  if (!ref) return null
  if (ref.kind === 'Deployment') return deployments.find((d) => d.metadata?.namespace === namespace && d.metadata?.name === ref.name) || null
  if (ref.kind === 'StatefulSet') return statefulsets.find((s) => s.metadata?.namespace === namespace && s.metadata?.name === ref.name) || null
  return null
}

export function resourceQuotasForNamespace(namespace: any, resourceQuotas: any[]) {
  const name = namespace.metadata?.name
  return resourceQuotas.filter((rq) => rq.metadata?.namespace === name)
}

export function limitRangesForNamespace(namespace: any, limitRanges: any[]) {
  const name = namespace.metadata?.name
  return limitRanges.filter((lr) => lr.metadata?.namespace === name)
}

export function podsForNamespace(namespace: any, pods: any[]) {
  const name = namespace.metadata?.name
  return pods.filter((pod) => pod.metadata?.namespace === name)
}

export function endpointsForService(service: any, endpointsList: any[]) {
  const namespace = service.metadata?.namespace
  const name = service.metadata?.name
  return endpointsList.find((e) => e.metadata?.namespace === namespace && e.metadata?.name === name) || null
}

export function serviceForEndpoints(endpoints: any, services: any[]) {
  const namespace = endpoints.metadata?.namespace
  const name = endpoints.metadata?.name
  return services.find((service) => service.metadata?.namespace === namespace && service.metadata?.name === name) || null
}

export function podsForNetworkPolicy(networkPolicy: any, pods: any[]) {
  const namespace = networkPolicy.metadata?.namespace
  return pods.filter((pod) => pod.metadata?.namespace === namespace && matchesPodSelector(pod.metadata?.labels, networkPolicy.spec?.podSelector))
}

export function podsForPodDisruptionBudget(pdb: any, pods: any[]) {
  return podsForSelector(pdb.metadata?.namespace, pdb.spec?.selector?.matchLabels, pods)
}

export function servicesForIngress(ingress: any, services: any[]) {
  const namespace = ingress.metadata?.namespace
  const backendNames = new Set<string>()
  for (const rule of ingress.spec?.rules || []) {
    for (const path of rule.http?.paths || []) {
      const name = path.backend?.service?.name
      if (name) backendNames.add(name)
    }
  }
  const defaultBackendName = ingress.spec?.defaultBackend?.service?.name
  if (defaultBackendName) backendNames.add(defaultBackendName)
  return services.filter((service) => service.metadata?.namespace === namespace && backendNames.has(service.metadata?.name))
}
