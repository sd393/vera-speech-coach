const requests = new Map<string, number[]>()

export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { allowed: boolean } {
  const now = Date.now()
  const timestamps = requests.get(identifier) ?? []

  // Keep only timestamps within the window
  const recent = timestamps.filter((t) => now - t < windowMs)

  if (recent.length >= limit) {
    requests.set(identifier, recent)
    return { allowed: false }
  }

  recent.push(now)
  requests.set(identifier, recent)
  return { allowed: true }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return 'anonymous'
}
