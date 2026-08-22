export function podRestartCount(pod: any): number {
  return (pod.status?.containerStatuses || []).reduce((sum: number, cs: any) => sum + (cs.restartCount || 0), 0)
}

export function podCrashLooping(pod: any): boolean {
  return (pod.status?.containerStatuses || []).some((cs: any) => cs.state?.waiting?.reason === 'CrashLoopBackOff')
}
