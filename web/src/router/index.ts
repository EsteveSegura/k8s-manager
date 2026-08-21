import { createRouter, createWebHistory } from 'vue-router'
import SelectContextView from '@/views/SelectContextView.vue'
import ResourceListView from '@/views/ResourceListView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'select-context', component: SelectContextView },
    { path: '/:context', redirect: (to) => ({ path: `/${to.params.context}/deployments` }) },
    {
      path: '/:context/deployments',
      name: 'deployments',
      component: ResourceListView,
      props: { kind: 'deployments' },
    },
    {
      path: '/:context/services',
      name: 'services',
      component: ResourceListView,
      props: { kind: 'services' },
    },
    {
      path: '/:context/pods',
      name: 'pods',
      component: ResourceListView,
      props: { kind: 'pods' },
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
