import { FixedWindowRateLimiter, isOriginAllowed, parseAllowedOrigins } from './hardening.rules';

describe('Phase 8 hardening rules', () => {
  it('parses and enforces CORS origins', () => {
    const allowed = parseAllowedOrigins('https://crm.example.com, https://admin.example.com');
    expect(isOriginAllowed(undefined, allowed)).toBe(true);
    expect(isOriginAllowed('https://crm.example.com', allowed)).toBe(true);
    expect(isOriginAllowed('https://evil.example.com', allowed)).toBe(false);
  });

  it('enforces a fixed-window request limit', () => {
    const limiter = new FixedWindowRateLimiter(1000, 2);
    expect(limiter.hit('client', 1000).allowed).toBe(true);
    expect(limiter.hit('client', 1100).allowed).toBe(true);
    expect(limiter.hit('client', 1200).allowed).toBe(false);
    expect(limiter.hit('client', 2100).allowed).toBe(true);
  });
});
