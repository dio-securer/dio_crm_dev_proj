import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';

describe('Phase 8 circuit breaker', () => {
  it('opens after repeated failures and recovers after reset window', async () => {
    const breaker = new CircuitBreaker(2, 1000);
    await expect(breaker.execute('ERP', async () => { throw new Error('x'); }, 1000)).rejects.toThrow('x');
    await expect(breaker.execute('ERP', async () => { throw new Error('x'); }, 1100)).rejects.toThrow('x');
    await expect(breaker.execute('ERP', async () => 'ok', 1200)).rejects.toBeInstanceOf(CircuitOpenError);
    await expect(breaker.execute('ERP', async () => 'ok', 2200)).resolves.toBe('ok');
  });
});
