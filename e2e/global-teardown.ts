import { auditEventsSinceMark, READ_ONLY_VERBS } from './support/audit'

// The app must never write to the cluster. The RBAC role already forbids it,
// but a rejected write could be swallowed by the UI, so this checks every
// request the app made during the run, allowed or not.
export default function globalTeardown() {
  const events = auditEventsSinceMark()
  if (events.length === 0) {
    throw new Error('The audit log recorded no requests from the app: the read-only check could not run.')
  }

  const writes = events.filter((event) => !READ_ONLY_VERBS.includes(event.verb))
  if (writes.length > 0) {
    const details = writes.map((event) => `  ${event.verb} ${event.requestURI} -> ${event.responseStatus?.code}`).join('\n')
    throw new Error(`The app sent ${writes.length} non read-only request(s) to the cluster:\n${details}`)
  }

  console.log(`Read-only check passed: ${events.length} requests to the cluster, all ${READ_ONLY_VERBS.join('/')}.`)
}
