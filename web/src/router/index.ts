import { createRouter, createWebHistory } from 'vue-router'
import SelectContextView from '@/views/SelectContextView.vue'
import ResourceListView from '@/views/ResourceListView.vue'
import CustomResourcesView from '@/views/CustomResourcesView.vue'
import HelmReleasesView from '@/views/HelmReleasesView.vue'
import EventsView from '@/views/EventsView.vue'
import type { ResourceKind } from '@/stores/cluster'

const LIST_KINDS: ResourceKind[] = [
  'deployments',
  'statefulsets',
  'daemonsets',
  'jobs',
  'cronjobs',
  'pods',
  'services',
  'ingresses',
  'configmaps',
  'secrets',
  'persistentvolumeclaims',
  'persistentvolumes',
  'nodes',
]

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'select-context', component: SelectContextView },
    { path: '/:context', redirect: (to) => ({ path: `/${to.params.context}/deployments` }) },
    ...LIST_KINDS.map((kind) => ({
      path: `/:context/${kind}`,
      name: kind,
      component: ResourceListView,
      props: { kind },
    })),
    {
      path: '/:context/crds',
      name: 'crds',
      component: CustomResourcesView,
    },
    {
      path: '/:context/helm',
      name: 'helm',
      component: HelmReleasesView,
    },
    {
      path: '/:context/events',
      name: 'events',
      component: EventsView,
    },
    {
      path: '/:context/:kind/:namespace/:name',
      name: 'resource-detail',
      component: ResourceListView,
      props: (route) => ({ kind: route.params.kind }),
    },
  ],
})

export default router
