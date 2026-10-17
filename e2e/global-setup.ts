import fs from 'node:fs'
import path from 'node:path'
import { markAuditOffset } from './support/audit'

export default function globalSetup() {
  if (!fs.existsSync(path.join(__dirname, '.kube', 'config'))) {
    throw new Error('Missing e2e/.kube/config: create the test cluster first with `npm run cluster:up`.')
  }
  markAuditOffset()
}
