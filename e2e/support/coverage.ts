import path from 'node:path'
import MCR, { type CoverageReportOptions } from 'monocart-coverage-reports'

// Frontend code coverage collected while the e2e tests run (Chromium's V8
// coverage, mapped back to web/src through the build's source maps).
// Opt-in with E2E_COVERAGE=1 (`npm run test:coverage`).
export const coverageEnabled = process.env.E2E_COVERAGE === '1'

const options: CoverageReportOptions = {
  name: 'k8s-manager e2e frontend coverage',
  outputDir: path.join(__dirname, '..', 'coverage'),
  reports: ['v8', 'console-summary', 'lcovonly', ['json-summary', { file: 'coverage-summary.json' }]],
  // Only the app's own bundle, not Vite's preload helpers or other scripts.
  entryFilter: (entry) => entry.url.includes('/assets/') && entry.url.endsWith('.js'),
  // Only our sources: not node_modules pulled into the bundle, nor the
  // generated shadcn-vue components in components/ui/.
  sourceFilter: (sourcePath) =>
    sourcePath.includes('src/') && !sourcePath.includes('node_modules') && !sourcePath.includes('src/components/ui/'),
  sourcePath: (filePath) => filePath.replace(/^.*?\bsrc\//, 'web/src/'),
}

export function coverageReport() {
  return MCR(options)
}
