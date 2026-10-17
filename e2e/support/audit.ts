import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

// The API server audit log only records requests from the app's ServiceAccount
// (see cluster/audit-policy.yaml). It lives inside the kind node container.
const NODE_CONTAINER = 'k8s-manager-e2e-control-plane'
const AUDIT_LOG_PATH = '/var/log/kubernetes/audit/audit.log'
const OFFSET_FILE = path.join(__dirname, '..', '.kube', 'audit-offset')

export const READ_ONLY_VERBS = ['get', 'list', 'watch']

export interface AuditEvent {
  verb: string
  requestURI: string
  responseStatus?: { code?: number }
}

function readAuditLines(): string[] {
  const output = execFileSync('docker', ['exec', NODE_CONTAINER, 'cat', AUDIT_LOG_PATH], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  })
  return output.split('\n').filter((line) => line.trim().length > 0)
}

// Remembers where the log ends now, so the check only looks at this test run.
export function markAuditOffset() {
  fs.writeFileSync(OFFSET_FILE, String(readAuditLines().length))
}

export function auditEventsSinceMark(): AuditEvent[] {
  const offset = Number(fs.readFileSync(OFFSET_FILE, 'utf8')) || 0
  return readAuditLines()
    .slice(offset)
    .map((line) => JSON.parse(line) as AuditEvent)
}
