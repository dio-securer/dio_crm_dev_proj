import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { env } from '../config/env';
import { CircuitBreaker } from './circuit-breaker';

export type InterfaceCall<T> = {
  companyId: number;
  interfaceCode: string;
  direction: 'IN' | 'OUT';
  entityType?: string;
  entityId?: string;
  payload: unknown;
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  execute: (requestId: string, attempt: number) => Promise<T>;
};

@Injectable()
export class InterfaceService {
  private readonly breaker = new CircuitBreaker(env.INTERFACE_CIRCUIT_FAILURES, env.INTERFACE_CIRCUIT_RESET_MS);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Creates an auditable REQUESTING record without pretending that an external
   * ERP transport exists. Until a real transport adapter is bound, callers remain REQUESTING.
   */
  async enqueuePending(input: Omit<InterfaceCall<unknown>, 'execute' | 'timeoutMs' | 'maxAttempts' | 'retryDelayMs'>) {
    const requestId = crypto.randomUUID();
    await this.db.query(`INSERT INTO crm_interface_log(company_id,request_id,interface_code,direction,entity_type,entity_id,request_json,status,retry_count,requested_at)
      VALUES(@companyId,@requestId,@interfaceCode,@direction,@entityType,@entityId,@requestJson,'REQUESTING',0,SYSUTCDATETIME())`, {
      companyId: input.companyId, requestId, interfaceCode: input.interfaceCode, direction: input.direction,
      entityType: input.entityType ?? null, entityId: input.entityId ?? null,
      requestJson: JSON.stringify(input.payload)
    });
    return { requestId, status: 'REQUESTING' as const };
  }

  async execute<T>(call: InterfaceCall<T>): Promise<T> {
    const requestId = crypto.randomUUID();
    const maxAttempts = Math.max(1, call.maxAttempts ?? 3);
    const timeoutMs = Math.max(1000, call.timeoutMs ?? 15000);
    const retryDelayMs = Math.max(0, call.retryDelayMs ?? 500);

    await this.db.query(`
      INSERT INTO crm_interface_log(company_id, request_id, interface_code, direction, entity_type, entity_id,
        request_json, status, retry_count, requested_at)
      VALUES(@companyId,@requestId,@interfaceCode,@direction,@entityType,@entityId,@requestJson,'REQUESTING',0,SYSUTCDATETIME())
    `, {
      companyId: call.companyId,
      requestId,
      interfaceCode: call.interfaceCode,
      direction: call.direction,
      entityType: call.entityType ?? null,
      entityId: call.entityId ?? null,
      requestJson: JSON.stringify(call.payload)
    });

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await this.withTimeout(
          this.breaker.execute(call.interfaceCode, () => call.execute(requestId, attempt)),
          timeoutMs
        );
        await this.db.query(`
          UPDATE crm_interface_log
             SET status='SUCCESS', response_json=@responseJson, responded_at=SYSUTCDATETIME(), retry_count=@retryCount
           WHERE request_id=@requestId
        `, { requestId, responseJson: JSON.stringify(result), retryCount: attempt - 1 });
        return result;
      } catch (error) {
        lastError = error;
        await this.db.query(`
          UPDATE crm_interface_log
             SET retry_count=@retryCount, error_message=@message
           WHERE request_id=@requestId
        `, {
          requestId,
          retryCount: attempt - 1,
          message: this.errorMessage(error)
        });
        if (attempt < maxAttempts) await this.delay(retryDelayMs * attempt);
      }
    }

    await this.db.query(`
      UPDATE crm_interface_log
         SET status='FAILED', responded_at=SYSUTCDATETIME(), error_message=@message, retry_count=@retryCount
       WHERE request_id=@requestId
    `, {
      requestId,
      message: this.errorMessage(lastError),
      retryCount: maxAttempts - 1
    });
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  circuitStatus(interfaceCode: string) {
    return this.breaker.snapshot(interfaceCode);
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Interface timeout after ${timeoutMs}ms`)), timeoutMs);
      promise.then(
        value => { clearTimeout(timer); resolve(value); },
        error => { clearTimeout(timer); reject(error); }
      );
    });
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000);
  }
}
