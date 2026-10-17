// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { withSetup } from '@/test/with-setup'
import { useLogSearch } from './useLogSearch'

const DEBOUNCE_MS = 200

function setup(text: string) {
  const source = ref(text)
  const { result, unmount } = withSetup(() => useLogSearch(source))
  return { source, search: result, unmount }
}

async function typeQuery(search: ReturnType<typeof useLogSearch>, value: string) {
  search.query.value = value
  await nextTick()
  vi.advanceTimersByTime(DEBOUNCE_MS)
  await nextTick()
}

const enter = (shiftKey = false) => {
  const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey, cancelable: true })
  return event
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useLogSearch', () => {
  it('starts with no matches and a single plain segment', () => {
    const { search } = setup('hello world')
    expect(search.matches.value).toEqual([])
    expect(search.segments.value).toEqual([{ text: 'hello world', match: false, active: false }])
    expect(search.isCapped.value).toBe(false)
    expect(search.activeIndex.value).toBe(0)
    expect(search.query.value).toBe('')
  })

  it('renders an empty log as a single empty segment', async () => {
    const { search } = setup('')
    await typeQuery(search, 'x')
    expect(search.segments.value).toEqual([{ text: '', match: false, active: false }])
  })

  it('debounces the query before computing matches', async () => {
    const { search } = setup('error one\nerror two')
    search.query.value = 'error'
    await nextTick()
    vi.advanceTimersByTime(DEBOUNCE_MS - 1)
    await nextTick()
    expect(search.matches.value).toEqual([])
    vi.advanceTimersByTime(1)
    await nextTick()
    expect(search.matches.value).toEqual([
      { start: 0, end: 5 },
      { start: 10, end: 15 },
    ])
  })

  it('only applies the last query typed within the debounce window', async () => {
    const { search } = setup('abc xyz')
    search.query.value = 'abc'
    await nextTick()
    vi.advanceTimersByTime(150)
    search.query.value = 'xyz'
    await nextTick()
    vi.advanceTimersByTime(150)
    await nextTick()
    expect(search.matches.value).toEqual([])
    vi.advanceTimersByTime(50)
    await nextTick()
    expect(search.matches.value).toEqual([{ start: 4, end: 7 }])
  })

  it('clears instantly when the query is emptied, cancelling a pending search', async () => {
    const { search } = setup('foo bar foo')
    await typeQuery(search, 'foo')
    expect(search.matches.value).toHaveLength(2)

    search.query.value = 'bar'
    await nextTick()
    search.clear()
    await nextTick()
    expect(search.query.value).toBe('')
    expect(search.matches.value).toEqual([])
    vi.advanceTimersByTime(DEBOUNCE_MS * 2)
    await nextTick()
    expect(search.matches.value).toEqual([])
  })

  it('is case-insensitive and trims the query', async () => {
    const { search } = setup('Error ERROR error')
    await typeQuery(search, '  eRRor  ')
    expect(search.matches.value.map((m) => m.start)).toEqual([0, 6, 12])
  })

  it('ignores whitespace-only queries', async () => {
    const { search } = setup('a b c')
    await typeQuery(search, '   ')
    expect(search.matches.value).toEqual([])
  })

  it('finds non-overlapping matches', async () => {
    const { search } = setup('aaaaa')
    await typeQuery(search, 'aa')
    expect(search.matches.value).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ])
  })

  it('splits the text into plain and match segments, marking the active one', async () => {
    const { search } = setup('x foo y foo')
    await typeQuery(search, 'foo')
    expect(search.segments.value).toEqual([
      { text: 'x ', match: false, active: false },
      { text: 'foo', match: true, active: true },
      { text: ' y ', match: false, active: false },
      { text: 'foo', match: true, active: false },
    ])
  })

  it('handles matches at the very start and end without empty segments', async () => {
    const { search } = setup('foofoo')
    await typeQuery(search, 'foo')
    expect(search.segments.value).toEqual([
      { text: 'foo', match: true, active: true },
      { text: 'foo', match: true, active: false },
    ])
  })

  it('keeps trailing text after the last match', async () => {
    const { search } = setup('foo tail')
    await typeQuery(search, 'foo')
    expect(search.segments.value.at(-1)).toEqual({ text: ' tail', match: false, active: false })
  })

  it('caps the number of matches at 2000', async () => {
    const { search } = setup('a'.repeat(2500))
    await typeQuery(search, 'a')
    expect(search.matches.value).toHaveLength(2000)
    expect(search.isCapped.value).toBe(true)
  })

  it('is not capped just below the limit', async () => {
    const { search } = setup('a'.repeat(1999))
    await typeQuery(search, 'a')
    expect(search.matches.value).toHaveLength(1999)
    expect(search.isCapped.value).toBe(false)
  })

  it('cycles forwards and backwards through matches', async () => {
    const { search } = setup('a a a')
    await typeQuery(search, 'a')
    search.next()
    expect(search.activeIndex.value).toBe(1)
    search.next()
    expect(search.activeIndex.value).toBe(2)
    search.next()
    expect(search.activeIndex.value).toBe(0)
    search.prev()
    expect(search.activeIndex.value).toBe(2)
    search.prev()
    expect(search.activeIndex.value).toBe(1)
    expect(search.segments.value.filter((s) => s.active)).toEqual([{ text: 'a', match: true, active: true }])
    expect(search.segments.value.findIndex((s) => s.active)).toBe(2)
  })

  it('next/prev do nothing without matches', () => {
    const { search } = setup('abc')
    search.next()
    search.prev()
    expect(search.activeIndex.value).toBe(0)
  })

  it('resets the active match when the query changes', async () => {
    const { search } = setup('foo foo bar bar')
    await typeQuery(search, 'foo')
    search.next()
    expect(search.activeIndex.value).toBe(1)
    await typeQuery(search, 'bar')
    expect(search.activeIndex.value).toBe(0)
  })

  it('resets the active match when the text shrinks below it', async () => {
    const { source, search } = setup('foo foo foo')
    await typeQuery(search, 'foo')
    search.next()
    search.next()
    expect(search.activeIndex.value).toBe(2)
    source.value = 'foo foo'
    await nextTick()
    expect(search.activeIndex.value).toBe(0)
  })

  it('keeps the active match when the text changes but it is still in range', async () => {
    const { source, search } = setup('foo foo foo')
    await typeQuery(search, 'foo')
    search.next()
    source.value = 'foo foo foo foo'
    await nextTick()
    expect(search.activeIndex.value).toBe(1)
  })

  it('scrolls the registered active match into view only on next/prev', async () => {
    const { search } = setup('foo foo')
    await typeQuery(search, 'foo')
    const active = { scrollIntoView: vi.fn() } as unknown as Element
    const inactive = { scrollIntoView: vi.fn() } as unknown as Element
    search.registerMatchRef(active, true)
    search.registerMatchRef(inactive, false)
    await nextTick()
    expect(active.scrollIntoView).not.toHaveBeenCalled()

    search.next()
    await nextTick()
    expect(active.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(inactive.scrollIntoView).not.toHaveBeenCalled()

    search.prev()
    await nextTick()
    expect(active.scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('Enter goes to the next match, Shift+Enter to the previous one', async () => {
    const { search } = setup('a a a')
    await typeQuery(search, 'a')
    const forward = enter()
    search.onKeydown(forward)
    expect(forward.defaultPrevented).toBe(true)
    expect(search.activeIndex.value).toBe(1)
    search.onKeydown(enter(true))
    expect(search.activeIndex.value).toBe(0)
    search.onKeydown(enter(true))
    expect(search.activeIndex.value).toBe(2)
  })

  it('ignores keys other than Enter', async () => {
    const { search } = setup('a a')
    await typeQuery(search, 'a')
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true })
    search.onKeydown(event)
    expect(event.defaultPrevented).toBe(false)
    expect(search.activeIndex.value).toBe(0)
  })

  it('cancels a pending debounce on unmount', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { search, unmount } = setup('foo')
    search.query.value = 'foo'
    await nextTick()
    unmount()
    expect(clearSpy).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  // Matches are located in `text.toLowerCase()` but sliced from the original
  // text. Some characters change length when lowercased (e.g. "İ" becomes
  // "i̇", two UTF-16 units), so every match after such a character is shifted
  // and the highlighted segment shows the wrong characters.
  it.fails('highlights the right text after characters whose lowercase form is longer', async () => {
    const { search } = setup('İstanbul error')
    await typeQuery(search, 'error')
    expect(search.segments.value.find((s) => s.match)?.text).toBe('error')
  })
})
