export function jobStatusLabel(job: any): 'Complete' | 'Failed' | 'Running' | 'Pending' {
  const conditions = job.status?.conditions || []
  if (conditions.some((c: any) => c.type === 'Complete' && c.status === 'True')) return 'Complete'
  if (conditions.some((c: any) => c.type === 'Failed' && c.status === 'True')) return 'Failed'
  if ((job.status?.active || 0) > 0) return 'Running'
  return 'Pending'
}

export function jobStatusVariant(status: string): 'secondary' | 'outline' | 'destructive' {
  if (status === 'Complete') return 'secondary'
  if (status === 'Failed') return 'destructive'
  return 'outline'
}
