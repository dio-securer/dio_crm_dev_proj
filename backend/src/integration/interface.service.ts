import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';

export type InterfaceCall<T> = {
  companyId: number;
  interfaceCode: string;
  direction: 'IN' | 'OUT';
  entityType?: string;
  entityId?: string;
  payload: unknown;
  execute: (requestId: string) => Promise<T>;
};

@Injectable()
export class InterfaceService {
  constructor(private readonly db: DatabaseService) {}

  async execute<T>(call: InterfaceCall<T>): Promise<T> {
    const requestId = crypto.randomUUID();
    await this.db.query(`
      INSERT INTO crm_interface_log(company_id, request_id, interface_code, direction, entity_type, entity_id,
        request_json, status, retry_count, requested_at)
      VALUES(@companyId,@requestId,@interfaceCode,@direction,@entityType,@entityId,@requestJson,'REQUESTING',0,SYSUTCDATETIME())
    `, {
      companyId: call.companyId, requestId, interfaceCode: call.interfaceCode, direction: call.direction,
      entityType: call.entityType ?? null, entityId: call.entityId ?? null,
      requestJson: JSON.stringify(call.payload)
    });

    try {
      const result = await call.execute(requestId);
      await this.db.query(`
        UPDATE crm_interface_log SET status='SUCCESS', response_json=@responseJson, responded_at=SYSUTCDATETIME()
        WHERE request_id=@requestId
      `, { requestId, responseJson: JSON.stringify(result) });
      return result;
    } catch (error) {
      await this.db.query(`
        UPDATE crm_interface_log SET status='FAILED', responded_at=SYSUTCDATETIME(), error_message=@message
        WHERE request_id=@requestId
      `, { requestId, message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
}
