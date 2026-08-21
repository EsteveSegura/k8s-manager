<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { deploymentsForPod, servicesForPod, deploymentsForService } from '@/lib/k8s-relations'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { ResourceKind } from '@/stores/cluster'

const route = useRoute()
const router = useRouter()
const store = useClusterStore()

const KIND_SHORT: Record<string, string> = { deployments: 'deploy', services: 'svc', pods: 'po' }
const KIND_LABEL: Record<string, string> = { deployments: 'Deployments', services: 'Services', pods: 'Pods' }

const context = computed(() => String(route.params.context || ''))
const kind = computed(() => String(route.params.kind || route.name || ''))
const kindLabel = computed(() => KIND_LABEL[kind.value] || kind.value)
const resourceName = computed(() => {
  if (!route.params.namespace || !route.params.name) return null
  return String(route.params.name)
})

interface Crumb {
  label: string
  href?: string
  kindShort?: string
}

function crumbFor(kindKey: ResourceKind, resource: any): Crumb {
  return {
    label: resource.metadata.name,
    kindShort: KIND_SHORT[kindKey],
    href: `/${context.value}/${kindKey}/${resource.metadata.namespace}/${resource.metadata.name}`,
  }
}

const ancestorCrumbs = computed<Crumb[]>(() => {
  if (!resourceName.value) return []

  const namespace = String(route.params.namespace)
  const name = String(route.params.name)
  const list = store.resourcesByKind(kind.value as ResourceKind)
  const resource = list.find((item: any) => item.metadata?.namespace === namespace && item.metadata?.name === name)
  if (!resource) return []

  const ancestors: Crumb[] = []

  if (kind.value === 'pods') {
    const deployment = deploymentsForPod(resource, store.deployments)[0]
    const service = servicesForPod(resource, store.services)[0]
    if (deployment) ancestors.push(crumbFor('deployments', deployment))
    if (service) ancestors.push(crumbFor('services', service))
  } else if (kind.value === 'services') {
    const deployment = deploymentsForService(resource, store.deployments)[0]
    if (deployment) ancestors.push(crumbFor('deployments', deployment))
  }

  return ancestors
})

const finalCrumb = computed<Crumb | null>(() => {
  if (!resourceName.value) return null
  return { label: resourceName.value, kindShort: KIND_SHORT[kind.value] }
})

// Todos los tramos del breadcrumb en orden, del contexto al recurso actual.
// El último no lleva `href`: es la página activa (BreadcrumbPage).
const allCrumbs = computed<Crumb[]>(() => {
  const list: Crumb[] = [{ label: context.value, href: `/${context.value}/deployments` }]
  if (!resourceName.value) {
    list.push({ label: kindLabel.value })
  } else {
    list.push(...ancestorCrumbs.value, { ...finalCrumb.value! })
  }
  return list
})

// Cuando hay más tramos de los que caben con comodidad, se colapsan los
// intermedios detrás de un "..." con menú (accesible por teclado), dejando
// siempre visibles el primero y los dos últimos.
const VISIBLE_TAIL = 2
const collapsedCrumbs = computed<Crumb[]>(() => {
  const all = allCrumbs.value
  if (all.length <= VISIBLE_TAIL + 1) return []
  return all.slice(1, all.length - VISIBLE_TAIL)
})
const leadingCrumb = computed<Crumb>(() => allCrumbs.value[0])
const trailingCrumbs = computed<Crumb[]>(() => {
  const all = allCrumbs.value
  return collapsedCrumbs.value.length === 0 ? all.slice(1) : all.slice(all.length - VISIBLE_TAIL)
})

function crumbKey(crumb: Crumb) {
  return crumb.href ?? crumb.label
}

function navigateTo(href?: string) {
  if (href) router.push(href)
}
</script>

<template>
  <Breadcrumb>
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink v-if="leadingCrumb.href" as-child>
          <RouterLink :to="leadingCrumb.href">{{ leadingCrumb.label }}</RouterLink>
        </BreadcrumbLink>
        <BreadcrumbPage v-else>{{ leadingCrumb.label }}</BreadcrumbPage>
      </BreadcrumbItem>

      <template v-if="collapsedCrumbs.length">
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Mostrar los recursos intermedios de la ruta"
              class="flex items-center rounded-sm hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BreadcrumbEllipsis />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                v-for="crumb in collapsedCrumbs"
                :key="crumbKey(crumb)"
                @select="navigateTo(crumb.href)"
              >
                <span v-if="crumb.kindShort" class="text-muted-foreground">{{ crumb.kindShort }}/</span>{{ crumb.label }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </BreadcrumbItem>
      </template>

      <template v-for="crumb in trailingCrumbs" :key="crumbKey(crumb)">
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink v-if="crumb.href" as-child>
            <RouterLink :to="crumb.href">
              <span v-if="crumb.kindShort" class="text-muted-foreground">{{ crumb.kindShort }}/</span>{{ crumb.label }}
            </RouterLink>
          </BreadcrumbLink>
          <BreadcrumbPage v-else :class="crumb.kindShort ? 'font-mono' : undefined">
            <span v-if="crumb.kindShort" class="text-muted-foreground">{{ crumb.kindShort }}/</span>{{ crumb.label }}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </template>
    </BreadcrumbList>
  </Breadcrumb>
</template>
