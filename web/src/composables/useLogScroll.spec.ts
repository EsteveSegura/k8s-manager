// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { withSetup } from '@/test/with-setup'
import { useLogScroll } from './useLogScroll'

// happy-dom does not lay out content, so scroll metrics are faked per element.
function fakeViewport({ scrollHeight, clientHeight, scrollTop }: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  const root = document.createElement('div')
  const viewport = document.createElement('div')
  viewport.setAttribute('data-slot', 'scroll-area-viewport')
  root.appendChild(viewport)
  let height = scrollHeight
  let top = scrollTop
  Object.defineProperty(viewport, 'scrollHeight', { get: () => height, configurable: true })
  Object.defineProperty(viewport, 'clientHeight', { get: () => clientHeight, configurable: true })
  Object.defineProperty(viewport, 'scrollTop', {
    get: () => top,
    set: (value: number) => {
      top = value
    },
    configurable: true,
  })
  return {
    ref: { $el: root },
    viewport,
    setScrollHeight: (value: number) => {
      height = value
    },
    scrollTo: (value: number) => {
      top = value
      viewport.dispatchEvent(new Event('scroll'))
    },
    get scrollTop() {
      return top
    },
  }
}

function setup() {
  const { result, errors, unmount } = withSetup(() => useLogScroll())
  return { ...result, errors, unmount }
}

describe('useLogScroll', () => {
  it('starts following the tail', () => {
    expect(setup().isAtBottom.value).toBe(true)
  })

  it('does nothing before the scroll area is mounted', async () => {
    const scroll = setup()
    await scroll.afterContentUpdate()
    await scroll.jumpToBottom()
    expect(scroll.isAtBottom.value).toBe(true)
  })

  it('tolerates a content update before mount while not following the tail', async () => {
    const scroll = setup()
    scroll.isAtBottom.value = false
    await expect(scroll.afterContentUpdate()).resolves.toBeUndefined()
    expect(scroll.isAtBottom.value).toBe(false)
  })

  it('unmounts cleanly when the scroll area was never attached', () => {
    const scroll = setup()
    scroll.unmount()
    expect(scroll.errors).toEqual([])
  })

  it('re-anchors to the bottom after a content update when it was following the tail', async () => {
    const scroll = setup()
    const area = fakeViewport({ scrollHeight: 1000, clientHeight: 200, scrollTop: 0 })
    scroll.scrollAreaRef.value = area.ref
    await scroll.afterContentUpdate()
    expect(area.scrollTop).toBe(1000)
    expect(scroll.isAtBottom.value).toBe(true)
  })

  it('tracks scroll position with a 24px tolerance', async () => {
    const scroll = setup()
    const area = fakeViewport({ scrollHeight: 1000, clientHeight: 200, scrollTop: 800 })
    scroll.scrollAreaRef.value = area.ref
    await scroll.afterContentUpdate()

    area.scrollTo(775) // 25px from the bottom
    expect(scroll.isAtBottom.value).toBe(false)
    area.scrollTo(776) // 24px from the bottom
    expect(scroll.isAtBottom.value).toBe(true)
    area.scrollTo(0)
    expect(scroll.isAtBottom.value).toBe(false)
  })

  it('does not move the scroll on content updates when the user scrolled up', async () => {
    const scroll = setup()
    const area = fakeViewport({ scrollHeight: 1000, clientHeight: 200, scrollTop: 800 })
    scroll.scrollAreaRef.value = area.ref
    await scroll.afterContentUpdate()
    area.scrollTo(100)

    area.setScrollHeight(2000)
    await scroll.afterContentUpdate()
    expect(area.scrollTop).toBe(100)
    expect(scroll.isAtBottom.value).toBe(false)
  })

  it('recomputes the position on content updates when not following the tail', async () => {
    const scroll = setup()
    const area = fakeViewport({ scrollHeight: 1000, clientHeight: 200, scrollTop: 800 })
    scroll.scrollAreaRef.value = area.ref
    await scroll.afterContentUpdate()
    area.scrollTo(500)
    expect(scroll.isAtBottom.value).toBe(false)

    // Content shrank so the current position is now at the end.
    area.setScrollHeight(700)
    await scroll.afterContentUpdate()
    expect(scroll.isAtBottom.value).toBe(true)
  })

  it('jumpToBottom scrolls to the end and resumes following', async () => {
    const scroll = setup()
    const area = fakeViewport({ scrollHeight: 1000, clientHeight: 200, scrollTop: 800 })
    scroll.scrollAreaRef.value = area.ref
    await scroll.afterContentUpdate()
    area.scrollTo(0)
    expect(scroll.isAtBottom.value).toBe(false)

    await scroll.jumpToBottom()
    expect(area.scrollTop).toBe(1000)
    expect(scroll.isAtBottom.value).toBe(true)
  })

  it('moves the listener when the viewport element changes and attaches only once', async () => {
    const scroll = setup()
    const first = fakeViewport({ scrollHeight: 1000, clientHeight: 200, scrollTop: 800 })
    const addSpy = vi.spyOn(first.viewport, 'addEventListener')
    const removeSpy = vi.spyOn(first.viewport, 'removeEventListener')
    scroll.scrollAreaRef.value = first.ref
    await scroll.afterContentUpdate()
    await scroll.afterContentUpdate()
    expect(addSpy).toHaveBeenCalledTimes(1)

    const second = fakeViewport({ scrollHeight: 1000, clientHeight: 200, scrollTop: 800 })
    scroll.scrollAreaRef.value = second.ref
    await scroll.jumpToBottom()
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function))

    // Scrolling the old viewport no longer affects the state.
    first.scrollTo(0)
    expect(scroll.isAtBottom.value).toBe(true)
    second.scrollTo(0)
    expect(scroll.isAtBottom.value).toBe(false)
  })

  it('removes the scroll listener on unmount', async () => {
    const scroll = setup()
    const area = fakeViewport({ scrollHeight: 1000, clientHeight: 200, scrollTop: 800 })
    scroll.scrollAreaRef.value = area.ref
    await scroll.afterContentUpdate()
    scroll.unmount()
    area.scrollTo(0)
    expect(scroll.isAtBottom.value).toBe(true)
  })
})
