export default {
  common: {
    refresh: 'Refrescar',
    close: 'Cerrar',
    clearFilter: 'Limpiar filtro',
    clearSearch: 'Limpiar búsqueda',
    changeCluster: 'Cambiar cluster',
    cluster: 'Cluster',
    theme: 'Tema',
    enableLightMode: 'Activar modo claro',
    enableDarkMode: 'Activar modo oscuro',
    updatedAt: 'Actualizado a las {time}',
    autoRefreshActive: 'Auto-refresco activo',
  },

  sidebar: {
    resources: 'Recursos',
  },

  breadcrumb: {
    showHidden: 'Mostrar los recursos intermedios de la ruta',
  },

  selectContext: {
    subtitle: 'Selecciona un contexto de kubeconfig para explorar el clúster.',
    current: 'actual',
    emptyTitle: 'Sin contextos',
    emptyDescription: 'No se encontró ningún contexto en tu kubeconfig.',
    detailTitle: 'Detalle del contexto',
    detailHint: 'Pasa el cursor sobre un contexto para ver su detalle.',
    contextNameLabel: 'Nombre del contexto',
    clusterLabel: 'Cluster',
    namespaceLabel: 'Namespace por defecto',
  },

  errors: {
    loadResourcesFailed: 'Error {status} al cargar recursos',
  },

  resourceList: {
    filterPlaceholder: 'Filtrar por namespace o nombre...',
    autoRefresh: 'Auto-refresco ({seconds}s)',
    loadErrorTitle: 'Error al cargar recursos',
    emptyTitle: 'Sin resultados',
    emptyDescription: 'No hay recursos que coincidan con el filtro.',
    columns: {
      name: 'Nombre',
      replicas: 'Réplicas',
      type: 'Tipo',
      ports: 'Puertos',
      status: 'Estado',
      node: 'Nodo',
    },
  },

  describe: {
    emptyTitle: 'Ningún recurso seleccionado',
    emptyDescription: 'Haz click en una fila de la tabla para ver su detalle aquí.',
    viewLogs: 'Ver logs',
    viewAllLogs: 'Ver logs de todos los pods',
    envVarsLabel: 'Env vars:',
    deployment: {
      replicasTitle: 'Réplicas',
      replicasDescription: 'Estado de disponibilidad del Deployment',
      desired: 'Deseadas: ',
      ready: 'Listas: ',
      available: 'Disponibles: ',
      updated: 'Actualizadas: ',
      strategyTitle: 'Estrategia',
      servicesDescription: 'Services cuyo selector coincide con los pods de este Deployment',
      noServicesTitle: 'Sin Services',
      noServicesDescription: 'Ningún Service selecciona los pods de este Deployment.',
      usageTitle: 'Recursos (agregado)',
      usageDescription: 'Suma de CPU y memoria de todos los pods de este Deployment',
    },
    service: {
      networkTitle: 'Exposición de red',
      networkDescription: 'Tipo, IP y puertos del Service',
      portsTitle: 'Puertos',
      usageTitle: 'Recursos (agregado)',
      usageDescription: 'Suma de CPU y memoria de todos los pods de este Service',
      selectorTitle: 'Selector',
      noSelector: 'Sin selector (Service manual/externo)',
      podsDescription: 'Pods a los que enruta este Service',
      noPodsTitle: 'Sin pods',
      noPodsDescription: 'Ningún pod activo coincide con el selector de este Service.',
      columns: {
        name: 'Nombre',
        port: 'Puerto',
        target: 'Target',
        nodePort: 'NodePort',
        protocol: 'Protocolo',
      },
    },
    pod: {
      statusTitle: 'Estado',
      node: 'Nodo: ',
      usageTitle: 'Recursos',
      usageDescription: 'CPU y memoria de este pod',
      containersDescription: 'Imagen, estado y variables de entorno',
    },
  },

  usage: {
    unavailableTitle: 'Métricas no disponibles',
    unavailableDescription: 'metrics-server no responde en este clúster; solo se muestran requests/limits.',
    memory: 'Memoria',
    inUse: '{value} en uso',
    ofLimit: '{percent}% del límite',
    noLimit: 'sin límite',
    coverage: 'Métricas disponibles en {available}/{total} pods',
  },

  chart: {
    collectingTitle: 'Recopilando histórico...',
    collectingDescription: 'Necesita al menos dos muestras del auto-refresco para poder graficar.',
    limit: 'límite: {value}',
  },

  commandPalette: {
    title: 'Buscar recurso',
    description: 'Busca por namespace o nombre',
    placeholder: 'Buscar deployments, services o pods...',
    empty: 'Sin resultados.',
  },

  logs: {
    allLogsTitle: 'Logs de todos los pods',
    podTitle: 'Logs de {name}',
    podDescription: '{namespace}/{name} · últimas 200 líneas',
    podCount: 'sin pods | 1 pod | {count} pods',
    selectContainer: 'Selecciona un container',
    searchPlaceholder: 'Buscar en los logs...',
    prevMatch: 'Coincidencia anterior',
    nextMatch: 'Coincidencia siguiente',
    noPodsTitle: 'Sin pods',
    noPodsDescription: 'No hay pods activos que coincidan con este recurso.',
    loadErrorTitle: 'No se pudieron cargar los logs',
    emptyLinesTitle: 'Sin líneas de log',
    emptyLinesDescription: 'Los pods no han producido salida reciente.',
    jumpToBottom: 'Volver al final',
  },
}
