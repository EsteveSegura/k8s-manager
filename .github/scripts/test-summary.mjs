// Prints a Markdown summary of a unit coverage or Stryker mutation report,
// for $GITHUB_STEP_SUMMARY.
//   node test-summary.mjs coverage <title> <coverage-summary.json>
//   node test-summary.mjs mutation <title> <mutation.json>
import fs from 'node:fs'

const [kind, title, file] = process.argv.slice(2)

if (!fs.existsSync(file)) {
  console.log(`### ${title}\n\nNo report found at \`${file}\`.`)
  process.exit(0)
}
const report = JSON.parse(fs.readFileSync(file, 'utf8'))

if (kind === 'coverage') {
  const rows = ['lines', 'statements', 'functions', 'branches'].map((key) => {
    const { pct, covered, total } = report.total[key]
    return `| ${key} | ${pct}% | ${covered}/${total} |`
  })
  console.log([`### ${title}`, '', '| | % | covered |', '|---|---|---|', ...rows].join('\n'))
} else if (kind === 'mutation') {
  // Same formula as Stryker's mutation score: detected / (detected + undetected).
  const counts = {}
  for (const { mutants } of Object.values(report.files)) {
    for (const { status } of mutants) counts[status] = (counts[status] || 0) + 1
  }
  const detected = (counts.Killed || 0) + (counts.Timeout || 0)
  const undetected = (counts.Survived || 0) + (counts.NoCoverage || 0)
  const score = detected + undetected ? ((detected / (detected + undetected)) * 100).toFixed(2) : 'n/a'
  const statuses = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `${status}: ${count}`)
    .join(' · ')
  console.log([`### ${title}`, '', `**Mutation score: ${score}%**`, '', statuses].join('\n'))
} else {
  throw new Error(`Unknown report kind: ${kind}`)
}
