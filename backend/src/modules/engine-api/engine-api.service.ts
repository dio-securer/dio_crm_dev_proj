// Nest wiring of the automatic API: the engine records over the SQL Server store and the published model.
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SqlObjectRecords } from '../../database/crm-obj-store';
import { AccessTooWideError } from '../../database/crm-obj-sql';
import { EngineApiError, EngineRecords } from './engine-records';
import { PublishedModels, sqlPublishedPorts } from './published-model';

/** An engine error as an HTTP answer: status, code and the field errors. Anything else is left to Nest (500). */
export function toHttp(error: unknown): unknown {
  // The data layer's own refusal (reached only if a caller skipped the API's check) is still a refusal, not a 500.
  if (error instanceof AccessTooWideError) return new HttpException({ statusCode: 403, error: error.code, errors: [] }, 403);
  if (!(error instanceof EngineApiError)) return error;
  return new HttpException({ statusCode: error.status, error: error.code, errors: error.errors }, error.status);
}

@Injectable()
export class EngineApiService {
  readonly records: EngineRecords;
  constructor(db: DatabaseService) {
    const logger = new Logger('EngineApi');
    const report = (objectKey: string, error: unknown) => logger.error(`object_table_unavailable object=${objectKey} ${String((error as Error)?.message ?? error).slice(0, 400)}`);
    this.records = new EngineRecords(new PublishedModels(sqlPublishedPorts(db, report)), new SqlObjectRecords(db));
  }
}
