// Nest wiring of the automatic API: the engine records over the SQL Server store and the published model.
import { HttpException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SqlObjectRecords } from '../../database/crm-obj-store';
import { EngineApiError, EngineRecords } from './engine-records';
import { PublishedModels, sqlPublishedPorts } from './published-model';

/** An engine error as an HTTP answer: status, code and the field errors. Anything else is left to Nest (500). */
export function toHttp(error: unknown): unknown {
  if (!(error instanceof EngineApiError)) return error;
  return new HttpException({ statusCode: error.status, error: error.code, errors: error.errors }, error.status);
}

@Injectable()
export class EngineApiService {
  readonly records: EngineRecords;
  constructor(db: DatabaseService) {
    this.records = new EngineRecords(new PublishedModels(sqlPublishedPorts(db)), new SqlObjectRecords(db));
  }
}
