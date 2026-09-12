export class CircuitOpenError extends Error {
  constructor(public readonly key: string, public readonly retryAfterMs: number) {
    super(`Circuit is open for ${key}; retry after ${retryAfterMs}ms`);
  }
}

type State = { failures: number; openedAt?: number };

export class CircuitBreaker {
  private readonly states = new Map<string, State>();

  constructor(private readonly failureThreshold: number, private readonly resetMs: number) {}

  async execute<T>(key: string, action: () => Promise<T>, now = Date.now()): Promise<T> {
    const state = this.states.get(key) ?? { failures: 0 };
    if (state.openedAt !== undefined) {
      const elapsed = now - state.openedAt;
      if (elapsed < this.resetMs) throw new CircuitOpenError(key, this.resetMs - elapsed);
      state.failures = 0;
      state.openedAt = undefined;
    }
    try {
      const result = await action();
      this.states.set(key, { failures: 0 });
      return result;
    } catch (error) {
      state.failures += 1;
      if (state.failures >= this.failureThreshold) state.openedAt = now;
      this.states.set(key, state);
      throw error;
    }
  }

  snapshot(key: string) {
    const state = this.states.get(key) ?? { failures: 0 };
    return { failures: state.failures, open: state.openedAt !== undefined, openedAt: state.openedAt ?? null };
  }
}
