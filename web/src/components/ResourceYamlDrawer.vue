<script setup lang="ts">
import { computed, ref } from 'vue'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { downloadTextFile } from '@/lib/download'
import { highlightYamlLine } from '@/lib/yaml-highlight'
import { CopyIcon, CheckIcon, DownloadIcon } from '@lucide/vue'

const props = defineProps<{
  open: boolean
  title: string
  yaml: string
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

const copied = ref(false)
let copiedTimeout: ReturnType<typeof setTimeout> | undefined

const highlightedLines = computed(() => props.yaml.split('\n').map(highlightYamlLine))

async function copyYaml() {
  await navigator.clipboard.writeText(props.yaml)
  copied.value = true
  clearTimeout(copiedTimeout)
  copiedTimeout = setTimeout(() => (copied.value = false), 1500)
}

function downloadYaml() {
  const slug = props.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  downloadTextFile(`${slug || 'resource'}.yaml`, props.yaml)
}
</script>

<template>
  <Drawer :open="open" @update:open="(value) => emit('update:open', value)">
    <DrawerContent class="h-[85vh] max-h-[85vh] overflow-hidden">
      <DrawerHeader class="shrink-0">
        <DrawerTitle class="font-mono">{{ title }}</DrawerTitle>
        <DrawerDescription>{{ $t('describe.yamlDescription') }}</DrawerDescription>
      </DrawerHeader>

      <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
        <div class="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" @click="copyYaml">
            <component :is="copied ? CheckIcon : CopyIcon" data-icon="inline-start" />
            {{ copied ? $t('common.copied') : $t('common.copy') }}
          </Button>
          <Button variant="outline" size="sm" @click="downloadYaml">
            <DownloadIcon data-icon="inline-start" />
            {{ $t('logs.download') }}
          </Button>
        </div>

        <div class="relative min-h-0 flex-1" @pointerdown.stop>
          <ScrollArea class="h-full min-w-0 rounded-md border">
            <pre class="p-4 font-mono text-xs whitespace-pre-wrap break-words select-text cursor-text"><template v-for="(tokens, i) in highlightedLines" :key="i"><span v-for="(token, j) in tokens" :key="j" :class="token.cls">{{ token.text }}</span>{{ i < highlightedLines.length - 1 ? '\n' : '' }}</template></pre>
          </ScrollArea>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
