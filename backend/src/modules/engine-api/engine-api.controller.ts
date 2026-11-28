// Routes of the automatic API (F2-4). Every route needs a signed-in user; row access is decided per row by the engine.
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, AuthGuard } from '../../security/security';
import { callerOf } from './actor';
import { EngineApiService, toHttp } from './engine-api.service';

async function answer<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) { throw toHttp(error); }
}

@Controller('api/engine/objects')
@UseGuards(AuthGuard)
export class EngineApiController {
  constructor(private readonly api: EngineApiService) {}

  @Get(':object/ui')
  ui(@Req() req: AuthenticatedRequest, @Param('object') object: string, @Query('locale') locale: unknown) {
    return answer(() => this.api.records.ui(callerOf(req.authUser), object, locale));
  }

  @Get(':object/records')
  list(@Req() req: AuthenticatedRequest, @Param('object') object: string, @Query() query: Record<string, unknown>) {
    return answer(() => this.api.records.list(callerOf(req.authUser), object, query));
  }

  @Get(':object/records/:id')
  get(@Req() req: AuthenticatedRequest, @Param('object') object: string, @Param('id') id: string) {
    return answer(() => this.api.records.get(callerOf(req.authUser), object, id));
  }

  @Post(':object/records')
  create(@Req() req: AuthenticatedRequest, @Param('object') object: string, @Body() body: unknown) {
    return answer(() => this.api.records.create(callerOf(req.authUser), object, body));
  }

  @Patch(':object/records/:id')
  update(@Req() req: AuthenticatedRequest, @Param('object') object: string, @Param('id') id: string, @Body() body: unknown) {
    return answer(() => this.api.records.update(callerOf(req.authUser), object, id, body));
  }
}
