<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ServerIcon } from '@lucide/vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import type { K8sContext } from '@/stores/cluster'

const store = useClusterStore()
const router = useRouter()
const hoveredContext = ref<K8sContext | null>(null)

onMounted(() => {
  store.fetchContexts()
})

function selectContext(context: K8sContext) {
  router.push(`/${context.name}/deployments`)
}
</script>

<template>
  <div class="min-h-svh bg-background flex items-center justify-center p-6">
    <div class="w-full max-w-4xl flex flex-col gap-4">
      <div class="flex items-start justify-between gap-2">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-semibold">k8s-manager</h1>
          <p class="text-muted-foreground text-sm">Selecciona un contexto de kubeconfig para explorar el clúster.</p>
        </div>
        <ThemeToggle />
      </div>

      <ResizablePanelGroup direction="horizontal" class="min-h-[24rem] rounded-lg border">
        <ResizablePanel :default-size="60" class="min-w-0">
          <ScrollArea class="h-full">
            <div class="flex flex-col gap-2 p-4">
              <template v-if="store.contextsStatus === 'loading'">
                <Skeleton class="h-16 w-full" v-for="i in 3" :key="i" />
              </template>

              <Empty v-else-if="store.contexts.length === 0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ServerIcon />
                  </EmptyMedia>
                  <EmptyTitle>Sin contextos</EmptyTitle>
                  <EmptyDescription>No se encontró ningún contexto en tu kubeconfig.</EmptyDescription>
                </EmptyHeader>
              </Empty>

              <Card
                v-else
                v-for="context in store.contexts"
                :key="context.name"
                class="cursor-pointer transition-colors hover:bg-accent"
                @click="selectContext(context)"
                @mouseenter="hoveredContext = context"
              >
                <CardHeader class="min-w-0">
                  <CardTitle class="flex min-w-0 items-center gap-2 text-base">
                    <span class="truncate">{{ context.cluster }}</span>
                    <Badge v-if="context.isCurrent" variant="secondary" class="shrink-0">actual</Badge>
                  </CardTitle>
                  <CardDescription class="truncate">{{ context.name }}</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle with-handle />

        <ResizablePanel :default-size="40" class="min-w-0">
          <div class="flex h-full items-center justify-center p-6">
            <Empty v-if="!hoveredContext">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ServerIcon />
                </EmptyMedia>
                <EmptyTitle>Detalle del contexto</EmptyTitle>
                <EmptyDescription>Pasa el cursor sobre un contexto para ver su detalle.</EmptyDescription>
              </EmptyHeader>
            </Empty>
            <div v-else class="flex w-full flex-col gap-3">
              <div>
                <p class="text-muted-foreground text-xs uppercase tracking-wide">Nombre del contexto</p>
                <p class="font-mono text-sm break-all">{{ hoveredContext.name }}</p>
              </div>
              <div>
                <p class="text-muted-foreground text-xs uppercase tracking-wide">Cluster</p>
                <p class="font-mono text-sm break-all">{{ hoveredContext.cluster }}</p>
              </div>
              <div>
                <p class="text-muted-foreground text-xs uppercase tracking-wide">Namespace por defecto</p>
                <p class="font-mono text-sm">{{ hoveredContext.namespace || 'default' }}</p>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  </div>
</template>
