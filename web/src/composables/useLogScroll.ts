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
      // El snapshot de logs sustituye todo el contenido en cada refresco (ventana
      // deslizante), así que aunque no movamos el scroll, la altura puede cambiar
      // y "desanclarnos" del final. Si ya estábamos siguiendo el tail, nos
      // reanclamos para que no parezca que el scroll sube solo.
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
