import { nextTick, onBeforeUnmount, ref } from 'vue'
import { getScrollViewport, scrollToBottom, type ScrollAreaRef } from '@/lib/dom'

const BOTTOM_THRESHOLD_PX = 24

export function useLogScroll() {
  const scrollAreaRef = ref<ScrollAreaRef>(null)
  const isAtBottom = ref(true)
  let viewportEl: HTMLElement | null = null

  function handleScroll() {
    if (!viewportEl) return
    const distance = viewportEl.scrollHeight - viewportEl.scrollTop - viewportEl.clientHeight
    isAtBottom.value = distance <= BOTTOM_THRESHOLD_PX
  }

  function attach() {
    const el = getScrollViewport(scrollAreaRef.value)
    if (!el || el === viewportEl) return
    viewportEl?.removeEventListener('scroll', handleScroll)
    viewportEl = el
    viewportEl.addEventListener('scroll', handleScroll)
  }

  async function afterContentUpdate() {
    const wasAtBottom = isAtBottom.value
    await nextTick()
    attach()
    if (wasAtBottom) {
      // The log snapshot replaces all content on every refresh (sliding
      // window), so even if we don't move the scroll, the height can change
      // and "unanchor" us from the end. If we were already following the tail,
      // we re-anchor so it doesn't look like the scroll moves on its own.
      scrollToBottom(scrollAreaRef.value)
      isAtBottom.value = true
    } else {
      handleScroll()
    }
  }

  async function jumpToBottom() {
    await nextTick()
    attach()
    scrollToBottom(scrollAreaRef.value)
    isAtBottom.value = true
  }

  onBeforeUnmount(() => {
    viewportEl?.removeEventListener('scroll', handleScroll)
  })

  return { scrollAreaRef, isAtBottom, afterContentUpdate, jumpToBottom }
}
