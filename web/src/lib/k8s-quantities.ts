const MEMORY_MULTIPLIERS: Record<string, number> = {
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
  Pi: 1024 ** 5,
  Ei: 1024 ** 6,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
  E: 1e18,
}

const CPU_MULTIPLIERS_TO_MILLI: Record<string, number> = {
  n: 1e-6,
  u: 1e-3,
  m: 1,
}

/** Parsea una cantidad de CPU de Kubernetes (ej. "500m", "136888n", "2") a milicores. */
export function parseCpu(quantity: string | undefined | null): number {
  if (!quantity) return 0
  const match = String(quantity).match(/^(-?\d+(?:\.\d+)?)([a-zA-Z]*)$/)
  if (!match) return 0
  const [, value, suffix] = match
  const num = Number.parseFloat(value)
  if (!suffix) return num * 1000
  const multiplier = CPU_MULTIPLIERS_TO_MILLI[suffix]
  return multiplier ? num * multiplier : 0
}

/** Parsea una cantidad de memoria de Kubernetes (ej. "512Mi", "1Gi", "1024") a bytes. */
export function parseMemory(quantity: string | undefined | null): number {
  if (!quantity) return 0
  const match = String(quantity).match(/^(-?\d+(?:\.\d+)?)([a-zA-Z]*)$/)
  if (!match) return 0
  const [, value, suffix] = match
  const num = Number.parseFloat(value)
  if (!suffix) return num
  const multiplier = MEMORY_MULTIPLIERS[suffix]
  return multiplier ? num * multiplier : 0
}

export function formatCpu(millicores: number): string {
  if (millicores <= 0) return '0m'
  if (millicores < 1000) return `${Math.round(millicores)}m`
  return `${(millicores / 1000).toFixed(2)} cores`
}

export function formatMemory(bytes: number): string {
  if (bytes <= 0) return '0 MiB'
  const mib = bytes / 1024 ** 2
  if (mib < 1024) return `${mib.toFixed(0)} MiB`
  return `${(mib / 1024).toFixed(2)} GiB`
}

export function percentOf(value: number, total: number): number | null {
  if (!total || total <= 0) return null
  return Math.min(100, Math.round((value / total) * 100))
}
