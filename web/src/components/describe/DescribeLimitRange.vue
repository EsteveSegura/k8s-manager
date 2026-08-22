<script setup lang="ts">
import { computed } from 'vue'
import { useResourceYaml } from '@/composables/useResourceYaml'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import ResourceYamlDrawer from '@/components/ResourceYamlDrawer.vue'
import { CodeIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const { yamlOpen, yaml } = useResourceYaml('limitranges', () => props.resource)

const limits = computed(() => {
  const items = props.resource.spec?.limits || []
  return items.map((limit: any) => {
    const resourceKeys = new Set<string>([
      ...Object.keys(limit.min || {}),
      ...Object.keys(limit.max || {}),
      ...Object.keys(limit.default || {}),
      ...Object.keys(limit.defaultRequest || {}),
    ])
    const rows = Array.from(resourceKeys).map((key) => ({
      key,
      min: limit.min?.[key] ?? '-',
      max: limit.max?.[key] ?? '-',
      default: limit.default?.[key] ?? '-',
      defaultRequest: limit.defaultRequest?.[key] ?? '-',
    }))
    return { type: limit.type, rows }
  })
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.limitrange.limitsTitle') }}</CardTitle>
        <CardDescription>{{ $t('describe.limitrange.limitsDescription') }}</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" @click="yamlOpen = true">
            <CodeIcon data-icon="inline-start" />
            {{ $t('describe.viewYaml') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <Empty v-if="limits.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.limitrange.emptyTitle') }}</EmptyTitle>
          </EmptyHeader>
        </Empty>
        <div v-for="(limit, i) in limits" :key="i" class="flex flex-col gap-2">
          <Badge variant="outline" class="self-start">{{ limit.type }}</Badge>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ $t('describe.resourcequota.columns.resource') }}</TableHead>
                <TableHead>{{ $t('describe.limitrange.columns.min') }}</TableHead>
                <TableHead>{{ $t('describe.limitrange.columns.max') }}</TableHead>
                <TableHead>{{ $t('describe.limitrange.columns.default') }}</TableHead>
                <TableHead>{{ $t('describe.limitrange.columns.defaultRequest') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in limit.rows" :key="row.key">
                <TableCell class="font-mono text-xs">{{ row.key }}</TableCell>
                <TableCell>{{ row.min }}</TableCell>
                <TableCell>{{ row.max }}</TableCell>
                <TableCell>{{ row.default }}</TableCell>
                <TableCell>{{ row.defaultRequest }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <ResourceYamlDrawer v-model:open="yamlOpen" :title="resource.metadata.name" :yaml="yaml" />
  </div>
</template>
