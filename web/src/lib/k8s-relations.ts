function matchesSelector(labels: Record<string, string> | undefined, selector: Record<string, string> | undefined) {
  if (!selector || Object.keys(selector).length === 0) return false
  if (!labels) return false
  return Object.entries(selector).every(([key, value]) => labels[key] === value)
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
