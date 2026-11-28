import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import sql, { ConnectionPool, IResult, Request, Transaction } from 'mssql';
import { env } from '../config/env';
import { AsyncLocalStorage } from 'node:async_hooks';
import { bindParams } from './sql-params';

export type DbQuery = <T = any>(text: string, params?: Record<string, unknown>) => Promise<IResult<T>>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  // All providers target the same configured database. Nested domain/config calls share
  // the request transaction instead of opening an independently committing connection.
  private static readonly transactionScope = new AsyncLocalStorage<{query:DbQuery;rollbackOnly:boolean;after:Array<(committed:boolean)=>Promise<void>>}>();
  private pool?: ConnectionPool;
  private readonly logger = new Logger(DatabaseService.name);

  private async getPool(): Promise<ConnectionPool> {
    if (this.pool?.connected) return this.pool;
    this.pool = await new sql.ConnectionPool({
      server: env.CRM_DB_SERVER,
      port: env.CRM_DB_PORT,
      database: env.CRM_DB_DATABASE,
      user: env.CRM_DB_USER,
      password: env.CRM_DB_PASSWORD,
      connectionTimeout: env.CRM_DB_CONNECT_TIMEOUT_MS,
      requestTimeout: env.CRM_DB_REQUEST_TIMEOUT_MS,
      options: { encrypt: env.CRM_DB_ENCRYPT === 'true', trustServerCertificate: env.NODE_ENV !== 'production' },
      pool: { min: 0, max: env.CRM_DB_POOL_MAX, idleTimeoutMillis: 30000 }
    }).connect();
    return this.pool;
  }

  async query<T = any>(text: string, params: Record<string, unknown> = {}): Promise<IResult<T>> {
    const scope=DatabaseService.transactionScope.getStore();
    if(scope)return scope.query<T>(text,params);
    const pool = await this.getPool();
    return this.executeRequest<T>(pool.request(), text, params);
  }

  async transaction<T>(work: (query: DbQuery) => Promise<T>): Promise<T> {
    const existing=DatabaseService.transactionScope.getStore();
    if(existing){try{return await work(existing.query);}catch(error){existing.rollbackOnly=true;throw error;}}
    const pool = await this.getPool();
    const tx = new Transaction(pool);
    await tx.begin();
    const query: DbQuery = <R = any>(text: string, params: Record<string, unknown> = {}) =>
      this.executeRequest<R>(new Request(tx), text, params);
    const scope={query,rollbackOnly:false,after:[] as Array<(committed:boolean)=>Promise<void>>};let committed=false;
    try {
      const result = await DatabaseService.transactionScope.run(scope,()=>work(query));
      if(scope.rollbackOnly)throw new Error('NESTED_TRANSACTION_ABORTED');
      await tx.commit();
      committed=true;
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      // The transaction/locks have ended and ALS has been restored. Forensic audit hooks
      // never cause a successfully committed business transaction to be rolled back.
      for(const after of scope.after){try{await after(committed);}catch{this.logger.error('transaction_completion_audit_failed');}}
    }
  }

  afterTransaction(callback:(committed:boolean)=>Promise<void>):void {
    const scope=DatabaseService.transactionScope.getStore();
    if(!scope)throw new Error('TRANSACTION_CONTEXT_REQUIRED');
    scope.after.push(callback);
  }
  hasActiveTransaction():boolean {return DatabaseService.transactionScope.getStore()!==undefined;}

  private async executeRequest<T>(request: Request, text: string, params: Record<string, unknown>): Promise<IResult<T>> {
    bindParams(request, params, sql);
    const started = Date.now();
    try {
      return await request.query<T>(text);
    } finally {
      const elapsed = Date.now() - started;
      if (elapsed >= env.CRM_DB_SLOW_QUERY_MS) {
        const statement = text.replace(/\s+/g, ' ').trim().slice(0, 240);
        this.logger.warn(`slow_query elapsedMs=${elapsed} sql=${statement}`);
      }
    }
  }

  async ping(): Promise<boolean> {
    const result = await this.query<{ ok: number }>('SELECT CAST(1 AS int) AS ok');
    return result.recordset[0]?.ok === 1;
  }

  async diagnostics() {
    const pool = await this.getPool();
    return {
      connected: pool.connected,
      connecting: pool.connecting,
      healthy: pool.healthy,
      poolMax: env.CRM_DB_POOL_MAX,
      requestTimeoutMs: env.CRM_DB_REQUEST_TIMEOUT_MS
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) await this.pool.close();
  }
}
