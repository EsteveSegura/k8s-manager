<script setup lang="ts">
import { computed, ref } from 'vue'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'

const props = defineProps<{
  points: { timestamp: number; value: number }[]
  limit?: number
  formatValue: (value: number) => string
}>()

const VIEW_W = 300
const VIEW_H = 100

const containerRef = ref<HTMLElement | null>(null)
const hoverIndex = ref<number | null>(null)
const hoverFraction = ref(0)

const maxValue = computed(() => {
  const observedMax = props.points.reduce((max, point) => Math.max(max, point.value), 0)
  return Math.max(observedMax, props.limit || 0, 1)
})

const lastPoint = computed(() => props.points[props.points.length - 1] || null)
const isOverLimit = computed(() => !!props.limit && !!lastPoint.value && lastPoint.value.value > props.limit)
const seriesColorVar = computed(() => (isOverLimit.value ? 'var(--color-destructive)' : 'var(--color-primary)'))

function toX(index: number) {
  if (props.points.length <= 1) return 0
  return (index / (props.points.length - 1)) * VIEW_W
}

function toY(value: number) {
  const y = VIEW_H - (value / maxValue.value) * VIEW_H
  return Math.min(VIEW_H, Math.max(0, y))
}

const linePoints = computed(() => props.points.map((p, i) => `${toX(i)},${toY(p.value)}`).join(' '))
const areaPoints = computed(() => {
  if (props.points.length === 0) return ''
  const top = props.points.map((p, i) => `${toX(i)},${toY(p.value)}`).join(' ')
  return `0,${VIEW_H} ${top} ${VIEW_W},${VIEW_H}`
})

const limitY = computed(() => (props.limit ? toY(props.limit) : null))
const gridYs = [0, VIEW_H / 2, VIEW_H]

function timeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function onPointerMove(event: PointerEvent) {
  const el = containerRef.value
  if (!el || props.points.length === 0) return
  const rect = el.getBoundingClientRect()
  const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const index = Math.round(fraction * (props.points.length - 1))
  hoverIndex.value = index
  hoverFraction.value = fraction
}

function onPointerLeave() {
  hoverIndex.value = null
}

const hoverPoint = computed(() => (hoverIndex.value !== null ? props.points[hoverIndex.value] : null))
const tooltipLeftPercent = computed(() => `${Math.min(92, Math.max(8, hoverFraction.value * 100))}%`)
</script>

<template>
  <Empty v-if="points.length < 2">
    <EmptyHeader>
      <EmptyTitle>Recopilando histórico...</EmptyTitle>
      <EmptyDescription>Necesita al menos dos muestras del auto-refresco para poder graficar.</EmptyDescription>
    </EmptyHeader>
  </Empty>

  <div v-else class="flex min-w-0 gap-2">
    <div class="flex h-24 flex-col justify-between py-0.5 text-right text-[10px] tabular-nums text-muted-foreground">
      <span>{{ formatValue(maxValue) }}</span>
      <span>{{ formatValue(maxValue / 2) }}</span>
      <span>0</span>
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div
        ref="containerRef"
        class="relative h-24 min-w-0"
        @pointermove="onPointerMove"
        @pointerleave="onPointerLeave"
      >
        <svg
          :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
          preserveAspectRatio="none"
          class="h-full w-full overflow-visible"
        >
          <line
            v-for="gy in gridYs"
            :key="gy"
            :x1="0"
            :x2="VIEW_W"
            :y1="gy"
            :y2="gy"
            stroke="var(--color-border)"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
          />

          <line
            v-if="limitY !== null"
            :x1="0"
            :x2="VIEW_W"
            :y1="limitY"
            :y2="limitY"
            stroke="var(--color-muted-foreground)"
            stroke-width="1"
            stroke-dasharray="4 3"
            vector-effect="non-scaling-stroke"
          />

          <polygon :points="areaPoints" :fill="seriesColorVar" fill-opacity="0.1" />

          <polyline
            :points="linePoints"
            fill="none"
            :stroke="seriesColorVar"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
            vector-effect="non-scaling-stroke"
          />

          <line
            v-if="hoverPoint"
            :x1="toX(hoverIndex!)"
            :x2="toX(hoverIndex!)"
            :y1="0"
            :y2="VIEW_H"
            stroke="var(--color-muted-foreground)"
            stroke-opacity="0.4"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
          />

          <circle
            v-if="lastPoint"
            :cx="toX(points.length - 1)"
            :cy="toY(lastPoint.value)"
            r="4"
            :fill="seriesColorVar"
            stroke="var(--color-background)"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
          />

          <circle
            v-if="hoverPoint"
            :cx="toX(hoverIndex!)"
            :cy="toY(hoverPoint.value)"
            r="4"
            :fill="seriesColorVar"
            stroke="var(--color-background)"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
          />
        </svg>

        <div
          v-if="hoverPoint"
          class="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
          :style="{ left: tooltipLeftPercent }"
        >
          <div class="font-medium text-popover-foreground">{{ formatValue(hoverPoint.value) }}</div>
          <div class="text-muted-foreground">{{ timeLabel(hoverPoint.timestamp) }}</div>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>{{ timeLabel(points[0].timestamp) }}</span>
        <span v-if="limit">límite: {{ formatValue(limit) }}</span>
        <span :class="isOverLimit ? 'font-medium text-destructive' : ''">
          {{ formatValue(lastPoint!.value) }} · {{ timeLabel(lastPoint!.timestamp) }}
        </span>
      </div>
    </div>
  </div>
</template>
