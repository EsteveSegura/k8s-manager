<script setup lang="ts">
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import PodLogViewer from '@/components/PodLogViewer.vue'

const props = defineProps<{
  open: boolean
  namespace: string
  name: string
  containers: string[]
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()
</script>

<template>
  <Drawer :open="open" @update:open="(value) => emit('update:open', value)">
    <DrawerContent class="h-[80vh] max-h-[80vh] overflow-hidden">
      <DrawerHeader class="shrink-0">
        <DrawerTitle>{{ $t('logs.podTitle', { name }) }}</DrawerTitle>
        <DrawerDescription>{{ $t('logs.podDescription', { namespace, name }) }}</DrawerDescription>
      </DrawerHeader>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <PodLogViewer :namespace="namespace" :name="name" :containers="containers" :active="open" />
      </div>

      <DrawerFooter class="shrink-0">
        <DrawerClose as-child>
          <Button variant="outline">{{ $t('common.close') }}</Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
