const trialUsage = new Map<string, number>()

export const TRIAL_MESSAGE_LIMIT = 4

export function checkTrialLimit(ip: string): {
  allowed: boolean
  remaining: number
} {
  const count = trialUsage.get(ip) ?? 0
  const remaining = Math.max(0, TRIAL_MESSAGE_LIMIT - count)
  return { allowed: remaining > 0, remaining }
}

export function incrementTrialUsage(ip: string): void {
  const count = trialUsage.get(ip) ?? 0
  trialUsage.set(ip, count + 1)
}

export function resetTrialUsage(ip: string): void {
  trialUsage.delete(ip)
}
