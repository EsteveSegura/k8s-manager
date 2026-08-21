export type ScrollAreaRef = { $el?: Element } | null

export function getScrollViewport(componentRef: ScrollAreaRef): HTMLElement | null {
  const root = componentRef?.$el as HTMLElement | undefined
  return root?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null
}

export function scrollToBottom(componentRef: ScrollAreaRef) {
  const viewport = getScrollViewport(componentRef)
  if (viewport) viewport.scrollTop = viewport.scrollHeight
}
