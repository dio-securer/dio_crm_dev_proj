import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, AuthGuard } from '../security/security';
import { GlobalizationService } from './globalization.service';

@Controller('api/me')
@UseGuards(AuthGuard)
export class GlobalizationController {
  constructor(private readonly globalization: GlobalizationService) {}

  @Get('context')
  context(@Req() req: AuthenticatedRequest) {
    return this.globalization.resolveForUser(req.authUser!);
  }
}
