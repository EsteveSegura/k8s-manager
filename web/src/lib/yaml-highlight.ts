export interface YamlToken {
  text: string
  cls: string
}

const KEY_VALUE_RE = /^(\s*(?:- )?)([A-Za-z0-9_.\-/]+|"[^"]*"|'[^']*'):(?: (.*))?$/
const LIST_ITEM_RE = /^(\s*- )(.*)$/

const PUNCT = 'text-muted-foreground'
const KEY = 'text-sky-600 dark:text-sky-400'
const STRING = 'text-emerald-600 dark:text-emerald-400'
const KEYWORD = 'text-purple-600 dark:text-purple-400'
const NUMBER = 'text-amber-600 dark:text-amber-500'
const PLAIN = 'text-foreground'

function classifyValue(raw: string): string {
  if (raw === '|' || raw === '>' || raw === '|-' || raw === '>-') return PUNCT
  if (raw === 'null' || raw === '~' || raw === 'true' || raw === 'false') return KEYWORD
  if (/^-?\d+(\.\d+)?$/.test(raw)) return NUMBER
  return STRING
}

// Resaltado heurístico línea a línea (no un parser YAML completo): suficiente
// para distinguir claves/valores/listas de un YAML ya bien formado por
// `yaml.stringify`, sin tener que añadir una librería de highlighting.
export function highlightYamlLine(line: string): YamlToken[] {
  if (/^\s*#/.test(line)) return [{ text: line, cls: 'text-muted-foreground italic' }]
  if (line.trim() === '---' || line.trim() === '...') return [{ text: line, cls: PUNCT }]

  const kv = line.match(KEY_VALUE_RE)
  if (kv) {
    const [, prefix, key, value] = kv
    const tokens: YamlToken[] = []
    if (prefix) tokens.push({ text: prefix, cls: PUNCT })
    tokens.push({ text: key, cls: KEY })
    if (value !== undefined) {
      tokens.push({ text: ': ', cls: PUNCT })
      tokens.push({ text: value, cls: classifyValue(value) })
    } else {
      tokens.push({ text: ':', cls: PUNCT })
    }
    return tokens
  }

  const li = line.match(LIST_ITEM_RE)
  if (li) {
    const [, prefix, value] = li
    return [
      { text: prefix, cls: PUNCT },
      { text: value, cls: classifyValue(value) },
    ]
  }

  return [{ text: line, cls: PLAIN }]
}
