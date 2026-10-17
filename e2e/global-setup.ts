import fs from 'node:fs'
import path from 'node:path'
import { markAuditOffset } from './support/audit'
import { coverageEnabled, coverageReport } from './support/coverage'

export default async function globalSetup() {
  if (!fs.existsSync(path.join(__dirname, '.kube', 'config'))) {
    throw new Error('Missing e2e/.kube/config: create the test cluster first with `npm run cluster:up`.')
  }
  markAuditOffset()
  if (coverageEnabled) await coverageReport().cleanCache()
}
