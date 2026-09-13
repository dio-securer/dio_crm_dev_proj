import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, AuthGuard, PermissionGuard, RequirePermission } from '../../security/security';
import { MarketFeatureGuard, RequireMarketFeature } from '../../globalization/feature.guard';
import { AnalyticsService } from './analytics.service';
import { LocalizedExportService } from './localized-export.service';

const bool = (value?: string) => value === '1' || value === 'true';
const statementBody = z.object({
  contractPublicId: z.string().uuid().optional(),
  general: z.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  salesPublicIds: z.array(z.string().uuid()).max(1000).optional()
});

@Controller('api/analytics')
@UseGuards(AuthGuard, PermissionGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService, private readonly localizedExport: LocalizedExportService) {}

  @Get('accounts/:accountPublicId/contracts')
  @RequirePermission('LEDGER.READ')
  contracts(@Req() req: AuthenticatedRequest, @Param('accountPublicId') accountPublicId: string) {
    return this.service.accountContracts(req.authUser!.companyId, accountPublicId);
  }

  @Get('accounts/:accountPublicId/ledger')
  @RequirePermission('LEDGER.READ')
  ledger(@Req() req: AuthenticatedRequest, @Param('accountPublicId') accountPublicId: string,
    @Query('contractPublicId') contractPublicId?: string, @Query('general') general?: string,
    @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.packageLedger(req.authUser!.companyId, accountPublicId, { contractPublicId, general: bool(general), from, to });
  }

  @Get('accounts/:accountPublicId/ledger.xlsx')
  @RequirePermission('LEDGER.EXPORT')
  async ledgerExcel(@Req() req: AuthenticatedRequest, @Param('accountPublicId') accountPublicId: string,
    @Res() res: Response, @Query('contractPublicId') contractPublicId?: string, @Query('general') general?: string,
    @Query('from') from?: string, @Query('to') to?: string) {
    const out = await this.localizedExport.packageLedgerExcel(req.authUser!.companyId, req.authUser!.sub, accountPublicId, { contractPublicId, general: bool(general), from, to });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(out.filename)}`);
    res.send(out.buffer);
  }

  @Get('accounts/:accountPublicId/statements')
  @UseGuards(MarketFeatureGuard)
  @RequireMarketFeature('MONTHLY_STATEMENT')
  @RequirePermission('STATEMENT.READ')
  statement(@Req() req: AuthenticatedRequest, @Param('accountPublicId') accountPublicId: string,
    @Query('contractPublicId') contractPublicId?: string, @Query('general') general?: string,
    @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.statement(req.authUser!.companyId, accountPublicId, { contractPublicId, general: bool(general), from, to });
  }

  @Post('accounts/:accountPublicId/statements/pdf')
  @UseGuards(MarketFeatureGuard)
  @RequireMarketFeature('MONTHLY_STATEMENT')
  @RequirePermission('STATEMENT.EXPORT')
  async statementPdf(@Req() req: AuthenticatedRequest, @Param('accountPublicId') accountPublicId: string, @Body() body: unknown, @Res() res: Response) {
    const input = statementBody.parse(body);
    const out = await this.localizedExport.statementPdf(req.authUser!.companyId, req.authUser!.sub, accountPublicId, input);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(out.filename)}`);
    res.setHeader('X-DIO-Export-Locale', out.locale);
    res.setHeader('X-DIO-PDF-Locale', out.pdfLocale);
    res.send(out.buffer);
  }

  @Get('accounts/:accountPublicId/360')
  @RequirePermission('ACCOUNT360.READ')
  account360(@Req() req: AuthenticatedRequest, @Param('accountPublicId') accountPublicId: string) {
    return this.service.account360(req.authUser!.companyId, accountPublicId);
  }

  @Get('dashboard')
  @RequirePermission('ANALYTICS.READ')
  dashboard(@Req() req: AuthenticatedRequest, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.dashboard(req.authUser!.companyId, from, to);
  }
}
