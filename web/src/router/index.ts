import { createRouter, createWebHistory } from 'vue-router'
import SelectContextView from '@/views/SelectContextView.vue'
import ResourceListView from '@/views/ResourceListView.vue'
import CustomResourcesView from '@/views/CustomResourcesView.vue'
import HelmReleasesView from '@/views/HelmReleasesView.vue'
import EventsView from '@/views/EventsView.vue'
import DashboardView from '@/views/DashboardView.vue'
import ClusterLayout from '@/components/ClusterLayout.vue'
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
    {
      path: '/:context',
      component: ClusterLayout,
      redirect: (to) => ({ path: `/${to.params.context}/dashboard` }),
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: DashboardView,
        },
        ...LIST_KINDS.map((kind) => ({
          path: kind,
          name: kind,
          component: ResourceListView,
          props: { kind },
        })),
        {
          path: 'crds',
          name: 'crds',
          component: CustomResourcesView,
        },
        {
          path: 'helm',
          name: 'helm',
          component: HelmReleasesView,
        },
        {
          path: 'events',
          name: 'events',
          component: EventsView,
        },
        {
          path: ':kind/:namespace/:name',
          name: 'resource-detail',
          component: ResourceListView,
          props: (route) => ({ kind: route.params.kind }),
        },
      ],
    },
  ],
})

export default router
