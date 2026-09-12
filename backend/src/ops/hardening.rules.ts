export function parseAllowedOrigins(value: string): string[] {
  return value.split(',').map(x => x.trim()).filter(Boolean);
}

export function isOriginAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return true;
  return allowed.includes(origin) || allowed.includes('*');
}

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly windowMs: number, private readonly maxRequests: number) {}

  hit(key: string, now = Date.now()) {
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      const next = { count: 1, resetAt: now + this.windowMs };
      this.windows.set(key, next);
      return { allowed: true, remaining: Math.max(0, this.maxRequests - 1), resetAt: next.resetAt };
    }
    current.count += 1;
    return {
      allowed: current.count <= this.maxRequests,
      remaining: Math.max(0, this.maxRequests - current.count),
      resetAt: current.resetAt
    };
  }

  prune(now = Date.now()) {
    for (const [key, value] of this.windows.entries()) if (value.resetAt <= now) this.windows.delete(key);
  }
}
