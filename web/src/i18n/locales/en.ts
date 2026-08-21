export default {
  common: {
    refresh: 'Refresh',
    close: 'Close',
    clearFilter: 'Clear filter',
    clearSearch: 'Clear search',
    changeCluster: 'Change cluster',
    cluster: 'Cluster',
    theme: 'Theme',
    enableLightMode: 'Switch to light mode',
    enableDarkMode: 'Switch to dark mode',
    updatedAt: 'Updated at {time}',
    autoRefreshActive: 'Auto-refresh active',
  },

  sidebar: {
    resources: 'Resources',
  },

  breadcrumb: {
    showHidden: 'Show the hidden resources in this path',
  },

  selectContext: {
    subtitle: 'Select a kubeconfig context to explore the cluster.',
    current: 'current',
    emptyTitle: 'No contexts',
    emptyDescription: 'No context was found in your kubeconfig.',
    detailTitle: 'Context detail',
    detailHint: 'Hover over a context to see its detail.',
    contextNameLabel: 'Context name',
    clusterLabel: 'Cluster',
    namespaceLabel: 'Default namespace',
  },

  errors: {
    loadResourcesFailed: 'Error {status} while loading resources',
  },

  resourceList: {
    filterPlaceholder: 'Filter by namespace or name...',
    autoRefresh: 'Auto-refresh ({seconds}s)',
    loadErrorTitle: 'Failed to load resources',
    emptyTitle: 'No results',
    emptyDescription: 'No resources match the filter.',
    columns: {
      name: 'Name',
      replicas: 'Replicas',
      type: 'Type',
      ports: 'Ports',
      status: 'Status',
      node: 'Node',
    },
  },

  describe: {
    emptyTitle: 'No resource selected',
    emptyDescription: 'Click a row in the table to see its detail here.',
    viewLogs: 'View logs',
    viewAllLogs: 'View logs from all pods',
    envVarsLabel: 'Env vars:',
    deployment: {
      replicasTitle: 'Replicas',
      replicasDescription: 'Deployment availability status',
      desired: 'Desired: ',
      ready: 'Ready: ',
      available: 'Available: ',
      updated: 'Updated: ',
      strategyTitle: 'Strategy',
      servicesDescription: 'Services whose selector matches this Deployment\'s pods',
      noServicesTitle: 'No Services',
      noServicesDescription: 'No Service selects this Deployment\'s pods.',
      usageTitle: 'Resources (aggregated)',
      usageDescription: 'Sum of CPU and memory across all pods of this Deployment',
    },
    service: {
      networkTitle: 'Network exposure',
      networkDescription: 'Type, IP and ports of the Service',
      portsTitle: 'Ports',
      usageTitle: 'Resources (aggregated)',
      usageDescription: 'Sum of CPU and memory across all pods of this Service',
      selectorTitle: 'Selector',
      noSelector: 'No selector (manual/external Service)',
      podsDescription: 'Pods this Service routes to',
      noPodsTitle: 'No pods',
      noPodsDescription: 'No active pod matches this Service\'s selector.',
      columns: {
        name: 'Name',
        port: 'Port',
        target: 'Target',
        nodePort: 'NodePort',
        protocol: 'Protocol',
      },
    },
    pod: {
      statusTitle: 'Status',
      node: 'Node: ',
      usageTitle: 'Resources',
      usageDescription: 'CPU and memory for this pod',
      containersDescription: 'Image, status and environment variables',
    },
  },

  usage: {
    unavailableTitle: 'Metrics unavailable',
    unavailableDescription: 'metrics-server is not responding on this cluster; only requests/limits are shown.',
    memory: 'Memory',
    inUse: '{value} in use',
    ofLimit: '{percent}% of limit',
    noLimit: 'no limit',
    coverage: 'Metrics available for {available}/{total} pods',
  },

  chart: {
    collectingTitle: 'Collecting history...',
    collectingDescription: 'Needs at least two auto-refresh samples before it can be charted.',
    limit: 'limit: {value}',
  },

  commandPalette: {
    title: 'Search resource',
    description: 'Search by namespace or name',
    placeholder: 'Search deployments, services or pods...',
    empty: 'No results.',
  },

  logs: {
    allLogsTitle: 'Logs from all pods',
    podTitle: 'Logs for {name}',
    podDescription: '{namespace}/{name} · last 200 lines',
    podCount: 'no pods | 1 pod | {count} pods',
    selectContainer: 'Select a container',
    searchPlaceholder: 'Search the logs...',
    prevMatch: 'Previous match',
    nextMatch: 'Next match',
    noPodsTitle: 'No pods',
    noPodsDescription: 'No active pods match this resource.',
    loadErrorTitle: 'Could not load the logs',
    emptyLinesTitle: 'No log lines',
    emptyLinesDescription: 'The pods have not produced recent output.',
    jumpToBottom: 'Jump to bottom',
  },
}
