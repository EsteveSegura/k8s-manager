<script setup lang="ts">
import { computed } from 'vue'
import { useResourceYaml } from '@/composables/useResourceYaml'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import ResourceYamlDrawer from '@/components/ResourceYamlDrawer.vue'
import { CodeIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const { yamlOpen, yaml } = useResourceYaml('resourcequotas', () => props.resource)

const rows = computed(() => {
  const hard = props.resource.status?.hard || props.resource.spec?.hard || {}
  const used = props.resource.status?.used || {}
  return Object.keys(hard).map((key) => ({ key, hard: hard[key], used: used[key] ?? '-' }))
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.resourcequota.limitsTitle') }}</CardTitle>
        <CardDescription>{{ $t('describe.resourcequota.limitsDescription') }}</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" @click="yamlOpen = true">
            <CodeIcon data-icon="inline-start" />
            {{ $t('describe.viewYaml') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Empty v-if="rows.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.resourcequota.emptyTitle') }}</EmptyTitle>
          </EmptyHeader>
        </Empty>
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>{{ $t('describe.resourcequota.columns.resource') }}</TableHead>
              <TableHead>{{ $t('describe.resourcequota.columns.used') }}</TableHead>
              <TableHead>{{ $t('describe.resourcequota.columns.hard') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.key">
              <TableCell class="font-mono text-xs">{{ row.key }}</TableCell>
              <TableCell>{{ row.used }}</TableCell>
              <TableCell>{{ row.hard }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <ResourceYamlDrawer v-model:open="yamlOpen" :title="resource.metadata.name" :yaml="yaml" />
  </div>
</template>
