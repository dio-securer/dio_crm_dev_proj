import { Injectable, OnModuleDestroy } from '@nestjs/common';
import sql, { ConnectionPool, IResult } from 'mssql';
import { env } from '../config/env';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool?: ConnectionPool;

  private async getPool(): Promise<ConnectionPool> {
    if (this.pool?.connected) return this.pool;
    this.pool = await new sql.ConnectionPool({
      server: env.CRM_DB_SERVER,
      port: env.CRM_DB_PORT,
      database: env.CRM_DB_DATABASE,
      user: env.CRM_DB_USER,
      password: env.CRM_DB_PASSWORD,
      options: { encrypt: env.CRM_DB_ENCRYPT === 'true', trustServerCertificate: env.NODE_ENV !== 'production' },
      pool: { min: 0, max: 10, idleTimeoutMillis: 30000 }
    }).connect();
    return this.pool;
  }

  async query<T>(text: string, params: Record<string, unknown> = {}): Promise<IResult<T>> {
    const pool = await this.getPool();
    const request = pool.request();
    for (const [key, value] of Object.entries(params)) request.input(key, value as never);
    return request.query<T>(text);
  }

  async ping(): Promise<boolean> {
    const result = await this.query<{ ok: number }>('SELECT CAST(1 AS int) AS ok');
    return result.recordset[0]?.ok === 1;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) await this.pool.close();
  }
}
