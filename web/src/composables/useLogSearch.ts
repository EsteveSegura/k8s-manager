import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'

const SEARCH_DEBOUNCE_MS = 200
const MAX_MATCHES = 2000

export interface LogSearchSegment {
  text: string
  match: boolean
  active: boolean
}

interface LogSearchMatch {
  start: number
  end: number
}

export function useLogSearch(sourceText: Ref<string>) {
  const query = ref('')
  const debouncedQuery = ref('')
  const activeIndex = ref(0)
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  watch(query, (value) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    if (!value) {
      // Un campo vacío limpia el resaltado al instante; solo el cómputo de
      // coincidencias (potencialmente costoso sobre logs largos) se retrasa.
      debouncedQuery.value = ''
      return
    }
    debounceTimer = setTimeout(() => {
      debouncedQuery.value = value
    }, SEARCH_DEBOUNCE_MS)
  })

  onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
  })

  const matches = computed<LogSearchMatch[]>(() => {
    const needle = debouncedQuery.value.trim().toLowerCase()
    if (!needle) return []
    const haystack = sourceText.value.toLowerCase()
    const found: LogSearchMatch[] = []
    let cursor = 0
    while (cursor <= haystack.length && found.length < MAX_MATCHES) {
      const index = haystack.indexOf(needle, cursor)
      if (index === -1) break
      found.push({ start: index, end: index + needle.length })
      cursor = index + needle.length
    }
    return found
  })

  const isCapped = computed(() => matches.value.length >= MAX_MATCHES)

  watch(debouncedQuery, () => {
    activeIndex.value = 0
  })

  watch(matches, (list) => {
    if (activeIndex.value >= list.length) activeIndex.value = 0
  })

  const segments = computed<LogSearchSegment[]>(() => {
    const text = sourceText.value
    const list = matches.value
    if (list.length === 0) return [{ text, match: false, active: false }]
    const result: LogSearchSegment[] = []
    let cursor = 0
    list.forEach((m, i) => {
      if (m.start > cursor) result.push({ text: text.slice(cursor, m.start), match: false, active: false })
      result.push({ text: text.slice(m.start, m.end), match: true, active: i === activeIndex.value })
      cursor = m.end
    })
    if (cursor < text.length) result.push({ text: text.slice(cursor), match: false, active: false })
    return result
  })

  // El nodo <mark> de la coincidencia activa se registra en cada render (vía
  // registerMatchRef), pero solo se hace scroll hasta él cuando el usuario pide
  // explícitamente "siguiente"/"anterior" — nunca como efecto secundario de un
  // render cualquiera, que es lo que antes hacía que el scroll manual del
  // usuario se deshiciera solo.
  let activeMatchEl: Element | null = null

  function registerMatchRef(el: Element | null, isActive: boolean) {
    if (isActive) activeMatchEl = el
  }

  async function scrollToActiveMatch() {
    await nextTick()
    activeMatchEl?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  function next() {
    if (matches.value.length === 0) return
    activeIndex.value = (activeIndex.value + 1) % matches.value.length
    scrollToActiveMatch()
  }

  function prev() {
    if (matches.value.length === 0) return
    activeIndex.value = (activeIndex.value - 1 + matches.value.length) % matches.value.length
    scrollToActiveMatch()
  }

  function clear() {
    query.value = ''
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (event.shiftKey) prev()
    else next()
  }

  return { query, matches, isCapped, activeIndex, segments, next, prev, clear, onKeydown, registerMatchRef }
}
