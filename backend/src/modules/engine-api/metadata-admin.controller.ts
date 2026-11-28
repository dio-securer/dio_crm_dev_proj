// Routes of the admin work on metadata versions (F2-7). Signed-in users only; admin permission is checked by the engine.
import { Body, Controller, HttpCode, Injectable, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AdminVersions, MetadataVersions } from '@dio-crm/engine';
import { AuthenticatedRequest, AuthGuard } from '../../security/security';
import { DatabaseService } from '../../database/database.service';
import { SqlMetaVersionStore } from '../../database/crm-meta-version-store';
import { MetadataAdmin } from './metadata-admin';

@Injectable()
export class MetadataAdminService {
  readonly admin: MetadataAdmin;
  constructor(db: DatabaseService) {
    this.admin = new MetadataAdmin(new AdminVersions(new MetadataVersions(new SqlMetaVersionStore(db))));
  }
}

@Controller('api/engine/metadata/versions')
@UseGuards(AuthGuard)
export class MetadataAdminController {
  constructor(private readonly svc: MetadataAdminService) {}

  @Post()
  stage(@Req() req: AuthenticatedRequest, @Body() body: unknown) { return this.svc.admin.stage(req.authUser, body); }

  @Post('rollback')
  @HttpCode(200)
  rollback(@Req() req: AuthenticatedRequest) { return this.svc.admin.rollback(req.authUser); }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.svc.admin.publish(req.authUser, id); }

  @Post(':id/discard')
  @HttpCode(200)
  discard(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.svc.admin.discard(req.authUser, id); }
}
