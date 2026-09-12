import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { InterfaceService } from '../../integration/interface.service';
import { env } from '../../config/env';

@Injectable()
export class OpsService {
  constructor(private readonly db: DatabaseService, private readonly interfaces: InterfaceService) {}

  live() {
    return {
      status: 'ok',
      service: 'dio-crm-api',
      version: env.APP_VERSION,
      uptimeSec: Math.floor(process.uptime()),
      at: new Date().toISOString()
    };
  }

  async ready() {
    try {
      const database = await this.db.ping();
      return { status: database ? 'ready' : 'not_ready', database: database ? 'up' : 'down', at: new Date().toISOString() };
    } catch (error) {
      return { status: 'not_ready', database: 'down', error: error instanceof Error ? error.message : String(error), at: new Date().toISOString() };
    }
  }

  async status(companyId: number) {
    const [db, interfaces, recentAudit] = await Promise.all([
      this.db.diagnostics(),
      this.db.query<any>(`SELECT
          SUM(CASE WHEN status='FAILED' AND requested_at>=DATEADD(hour,-24,SYSUTCDATETIME()) THEN 1 ELSE 0 END) failed_24h,
          SUM(CASE WHEN status='REQUESTING' AND requested_at<DATEADD(minute,-15,SYSUTCDATETIME()) THEN 1 ELSE 0 END) stuck_requesting,
          SUM(CASE WHEN status='SUCCESS' AND requested_at>=DATEADD(hour,-24,SYSUTCDATETIME()) THEN 1 ELSE 0 END) success_24h
        FROM crm_interface_log WHERE company_id=@companyId`, { companyId }),
      this.db.query<any>(`SELECT COUNT(*) audit_24h FROM crm_audit_log WHERE company_id=@companyId AND created_at>=DATEADD(hour,-24,SYSUTCDATETIME())`, { companyId })
    ]);
    const memory = process.memoryUsage();
    return {
      service: { version: env.APP_VERSION, uptimeSec: Math.floor(process.uptime()), nodeEnv: env.NODE_ENV },
      database: db,
      interface: {
        failed24h: Number(interfaces.recordset[0]?.failed_24h ?? 0),
        stuckRequesting: Number(interfaces.recordset[0]?.stuck_requesting ?? 0),
        success24h: Number(interfaces.recordset[0]?.success_24h ?? 0),
        circuits: {
          account: this.interfaces.circuitStatus('IF-ERP-002'),
          contract: this.interfaces.circuitStatus('IF-ERP-004'),
          order: this.interfaces.circuitStatus('IF-ERP-007')
        }
      },
      audit24h: Number(recentAudit.recordset[0]?.audit_24h ?? 0),
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024)
      },
      at: new Date().toISOString()
    };
  }
}
