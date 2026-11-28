import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { env } from '../config/env';
import { CircuitBreaker } from './circuit-breaker';
import {configAssert} from '../customization/config-store';

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

  private async legacyCompanyFence<T>(companyId:number,work:()=>Promise<T>):Promise<T>{
    return this.db.transaction(async query=>{
      const companies=await query<{public_id:string}>('SELECT CONVERT(varchar(36),public_id) public_id FROM crm_company WITH(HOLDLOCK) WHERE company_id=@companyId AND is_active=1',{companyId});configAssert(companies.recordset.length===1,404,'NOT_FOUND');
      const resource='crm.config.company:'+companies.recordset[0].public_id.toLowerCase();
      const lock=await query<{result:number}>("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000; SELECT @r AS result",{resource});configAssert(lock.recordset[0]?.result>=0,409,'CONFIG_LOCK_TIMEOUT');
      const state=await query<{managed:number}>("IF OBJECT_ID('dbo.crm_config_company_state') IS NULL SELECT 0 AS managed ELSE SELECT COUNT(*) AS managed FROM dbo.crm_config_company_state WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyId",{companyId});
      configAssert(state.recordset[0]?.managed===0,409,'CONFIG_INTERFACE_NOT_INTEGRATED');return work();
    });
  }

  /**
   * Creates an auditable REQUESTING record without pretending that an external
   * ERP transport exists. Until a real transport adapter is bound, callers remain REQUESTING.
   */
  async enqueuePending(input: Omit<InterfaceCall<unknown>, 'execute' | 'timeoutMs' | 'maxAttempts' | 'retryDelayMs'>) {
    return this.legacyCompanyFence(input.companyId,()=>this.enqueueLegacy(input));
  }
  private async enqueueLegacy(input: Omit<InterfaceCall<unknown>, 'execute' | 'timeoutMs' | 'maxAttempts' | 'retryDelayMs'>) {
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
    // No managed-company external execution until a version-aware outbox consumer exists.
    const audit={requestId:crypto.randomUUID(),started:false,status:'REQUESTING',retryCount:0,message:null as string|null,response:null as string|null};
    return this.legacyCompanyFence(call.companyId,async()=>{
      this.db.afterTransaction(async committed=>{
        if(committed||!audit.started)return;
        // Separate append after the outermost rollback preserves evidence of a real
        // external attempt. The rolled-back row does not exist, so no duplicate UPDATE.
        await this.db.query(`INSERT INTO crm_interface_log(company_id,request_id,interface_code,direction,entity_type,entity_id,request_json,status,retry_count,error_message,response_json,requested_at,responded_at)
          VALUES(@companyId,@requestId,@interfaceCode,@direction,@entityType,@entityId,@requestJson,@status,@retryCount,@message,@responseJson,SYSUTCDATETIME(),SYSUTCDATETIME())`,{companyId:call.companyId,requestId:audit.requestId,interfaceCode:call.interfaceCode,direction:call.direction,entityType:call.entityType??null,entityId:call.entityId??null,requestJson:JSON.stringify(call.payload),status:audit.status,retryCount:audit.retryCount,message:audit.message??'Parent transaction rolled back after external attempt',responseJson:audit.response});
      });
      return this.executeLegacy(call,audit);
    });
  }
  private async executeLegacy<T>(call: InterfaceCall<T>,audit:{requestId:string;started:boolean;status:string;retryCount:number;message:string|null;response:string|null}): Promise<T> {
    const requestId = audit.requestId;
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
    audit.started=true;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await this.withTimeout(
          this.breaker.execute(call.interfaceCode, () => call.execute(requestId, attempt)),
          timeoutMs
        );
        audit.status='SUCCESS';audit.response=JSON.stringify(result);audit.retryCount=attempt-1;
        await this.db.query(`
          UPDATE crm_interface_log
             SET status='SUCCESS', response_json=@responseJson, responded_at=SYSUTCDATETIME(), retry_count=@retryCount
           WHERE request_id=@requestId
        `, { requestId, responseJson: JSON.stringify(result), retryCount: attempt - 1 });
        return result;
      } catch (error) {
        lastError = error;
        audit.status='FAILED';audit.message=this.errorMessage(error);audit.retryCount=attempt-1;
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
