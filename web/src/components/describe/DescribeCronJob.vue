<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { jobsForCronJob } from '@/lib/k8s-relations'
import { formatDateTime } from '@/lib/format'
import { jobStatusLabel, jobStatusVariant } from '@/lib/job-status'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { ListChecksIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()

const spec = computed(() => props.resource.spec || {})
const status = computed(() => props.resource.status || {})
const containers = computed(() => spec.value.jobTemplate?.spec?.template?.spec?.containers || [])

const lastScheduleLabel = computed(() => formatDateTime(status.value.lastScheduleTime))
const lastSuccessfulLabel = computed(() => formatDateTime(status.value.lastSuccessfulTime))

const relatedJobs = computed(() =>
  jobsForCronJob(props.resource, store.jobs).sort((a: any, b: any) => {
    const bTime = new Date(b.metadata?.creationTimestamp || 0).getTime()
    const aTime = new Date(a.metadata?.creationTimestamp || 0).getTime()
    return bTime - aTime
  }),
)

function goToJob(job: any) {
  router.push(`/${store.currentContext}/jobs/${job.metadata.namespace}/${job.metadata.name}`)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.cronjob.scheduleTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-4 text-sm">
        <Badge variant="outline" class="font-mono">{{ spec.schedule }}</Badge>
        <Badge :variant="spec.suspend ? 'destructive' : 'secondary'">
          {{ spec.suspend ? $t('describe.cronjob.suspended') : $t('describe.cronjob.active') }}
        </Badge>
        <div v-if="spec.concurrencyPolicy">
          <span class="text-muted-foreground">{{ $t('describe.cronjob.concurrencyPolicy') }}</span>{{ spec.concurrencyPolicy }}
        </div>
        <div v-if="lastScheduleLabel">
          <span class="text-muted-foreground">{{ $t('describe.cronjob.lastSchedule') }}</span>{{ lastScheduleLabel }}
        </div>
        <div v-if="lastSuccessfulLabel">
          <span class="text-muted-foreground">{{ $t('describe.cronjob.lastSuccessful') }}</span>{{ lastSuccessfulLabel }}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.cronjob.jobsTitle') }}</CardTitle>
        <CardDescription>{{ $t('describe.cronjob.jobsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="relatedJobs.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.cronjob.noJobsTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.cronjob.noJobsDescription') }}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <button
          v-for="job in relatedJobs"
          :key="job.metadata.name"
          type="button"
          class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
          @click="goToJob(job)"
        >
          <div class="flex min-w-0 items-center gap-2">
            <ListChecksIcon class="text-muted-foreground shrink-0" />
            <span class="truncate font-medium">{{ job.metadata.name }}</span>
          </div>
          <Badge :variant="jobStatusVariant(jobStatusLabel(job))" class="shrink-0">{{ jobStatusLabel(job) }}</Badge>
        </button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Containers</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 text-sm">
        <div v-for="container in containers" :key="container.name" class="flex flex-col gap-1">
          <div class="font-medium">{{ container.name }}</div>
          <div class="text-muted-foreground font-mono text-xs break-all">{{ container.image }}</div>
          <Separator class="mt-2" />
        </div>
      </CardContent>
    </Card>
  </div>
</template>
