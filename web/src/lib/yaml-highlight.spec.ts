import { describe, expect, it } from 'vitest'
import { highlightYamlLine } from './yaml-highlight'

const PUNCT = 'text-muted-foreground'
const KEY = 'text-sky-600 dark:text-sky-400'
const STRING = 'text-emerald-600 dark:text-emerald-400'
const KEYWORD = 'text-purple-600 dark:text-purple-400'
const NUMBER = 'text-amber-600 dark:text-amber-500'
const PLAIN = 'text-foreground'
const COMMENT = 'text-muted-foreground italic'

const joined = (line: string) => highlightYamlLine(line).map((t) => t.text).join('')

describe('highlightYamlLine', () => {
  it('highlights comments, including indented ones', () => {
    expect(highlightYamlLine('# hello')).toEqual([{ text: '# hello', cls: COMMENT }])
    expect(highlightYamlLine('   # note: x')).toEqual([{ text: '   # note: x', cls: COMMENT }])
  })

  it('does not treat a trailing comment as a whole-line comment', () => {
    expect(highlightYamlLine('image: nginx # pinned')[0]).toEqual({ text: 'image', cls: KEY })
  })

  it('highlights document markers', () => {
    expect(highlightYamlLine('---')).toEqual([{ text: '---', cls: PUNCT }])
    expect(highlightYamlLine('--- ')).toEqual([{ text: '--- ', cls: PUNCT }])
    expect(highlightYamlLine('  ...  ')).toEqual([{ text: '  ...  ', cls: PUNCT }])
  })

  it('splits a top-level key/value pair', () => {
    expect(highlightYamlLine('kind: Deployment')).toEqual([
      { text: 'kind', cls: KEY },
      { text: ': ', cls: PUNCT },
      { text: 'Deployment', cls: STRING },
    ])
  })

  it('keeps indentation as a punctuation prefix', () => {
    expect(highlightYamlLine('    replicas: 3')).toEqual([
      { text: '    ', cls: PUNCT },
      { text: 'replicas', cls: KEY },
      { text: ': ', cls: PUNCT },
      { text: '3', cls: NUMBER },
    ])
  })

  it('handles a key with no value (mapping start)', () => {
    expect(highlightYamlLine('metadata:')).toEqual([
      { text: 'metadata', cls: KEY },
      { text: ':', cls: PUNCT },
    ])
  })

  it('handles a key/value inside a list item', () => {
    expect(highlightYamlLine('  - name: web')).toEqual([
      { text: '  - ', cls: PUNCT },
      { text: 'name', cls: KEY },
      { text: ': ', cls: PUNCT },
      { text: 'web', cls: STRING },
    ])
  })

  it('accepts dotted, slashed, dashed and quoted keys', () => {
    expect(highlightYamlLine('app.kubernetes.io/name: x')[0]).toEqual({ text: 'app.kubernetes.io/name', cls: KEY })
    expect(highlightYamlLine('my-key_1: x')[0]).toEqual({ text: 'my-key_1', cls: KEY })
    expect(highlightYamlLine('"a b": x')[0]).toEqual({ text: '"a b"', cls: KEY })
    expect(highlightYamlLine("'a b': x")[0]).toEqual({ text: "'a b'", cls: KEY })
  })

  it.each([
    ['true', KEYWORD],
    ['false', KEYWORD],
    ['null', KEYWORD],
    ['~', KEYWORD],
    ['42', NUMBER],
    ['-7', NUMBER],
    ['3.14', NUMBER],
    ['-0.5', NUMBER],
    ['1.', STRING],
    ['.5', STRING],
    ['1e3', STRING],
    ['12a', STRING],
    ['a12', STRING],
    ['True', STRING],
    ['|', PUNCT],
    ['|-', PUNCT],
    ['>', PUNCT],
    ['>-', PUNCT],
    ['|+', STRING],
    ['"quoted"', STRING],
    ['', STRING],
  ])('classifies value %j as %s', (value, cls) => {
    expect(highlightYamlLine(`key: ${value}`).at(-1)).toEqual({ text: value, cls })
  })

  it('classifies plain list items', () => {
    expect(highlightYamlLine('- 80')).toEqual([
      { text: '- ', cls: PUNCT },
      { text: '80', cls: NUMBER },
    ])
    expect(highlightYamlLine('    - http://example.com')).toEqual([
      { text: '    - ', cls: PUNCT },
      { text: 'http://example.com', cls: STRING },
    ])
  })

  it('does not treat a colon without a following space as a key separator', () => {
    expect(highlightYamlLine('image:nginx')).toEqual([{ text: 'image:nginx', cls: PLAIN }])
  })

  it('does not treat keys containing spaces (unquoted) as keys', () => {
    expect(highlightYamlLine('foo bar: baz')).toEqual([{ text: 'foo bar: baz', cls: PLAIN }])
  })

  it('treats continuation lines of block scalars as plain text', () => {
    expect(highlightYamlLine('  some text line')).toEqual([{ text: '  some text line', cls: PLAIN }])
    expect(highlightYamlLine('  a - b')).toEqual([{ text: '  a - b', cls: PLAIN }])
  })

  it('never loses characters', () => {
    for (const line of ['a: b: c', '  - x: "y: z"', '- - nested', 'key:  two-spaces', '', '#']) {
      expect(joined(line)).toBe(line)
    }
  })
})
