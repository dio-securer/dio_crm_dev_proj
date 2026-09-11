import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { DatabaseService } from '../../database/database.service';
import { env } from '../../config/env';
import type { JwtPayload } from '../../security/security';

type LoginRow = {
  user_id: number;
  public_id: string;
  login_id: string;
  user_name: string;
  company_id: number;
  organization_id: number | null;
  password_hash: string;
};

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService, private readonly jwt: JwtService) {}

  async login(loginId: string, password: string) {
    const row = await this.findUserByLogin(loginId);
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = await this.buildPayload(row);
    const tokens = await this.issueTokens(payload);
    await this.storeRefreshToken(row.user_id, tokens.refreshToken);
    return { ...tokens, user: payload };
  }

  async refresh(refreshToken: string) {
    let token: { sub: number; type: string };
    try {
      token = await this.jwt.verifyAsync(refreshToken, { secret: env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (token.type !== 'refresh') throw new UnauthorizedException('Invalid refresh token type');

    const oldHash = this.hashToken(refreshToken);
    const stored = await this.db.query<{ refresh_token_id: number }>(`
      SELECT TOP 1 refresh_token_id
      FROM crm_refresh_token
      WHERE user_id=@userId AND token_hash=@hash AND revoked_at IS NULL AND expires_at>SYSUTCDATETIME()
    `, { userId: token.sub, hash: oldHash });
    if (!stored.recordset[0]) throw new UnauthorizedException('Refresh token revoked or expired');

    const row = await this.findUserById(token.sub);
    if (!row) throw new UnauthorizedException('User inactive or missing');
    const payload = await this.buildPayload(row);
    const tokens = await this.issueTokens(payload);

    await this.db.query(`
      UPDATE crm_refresh_token SET revoked_at=SYSUTCDATETIME()
      WHERE refresh_token_id=@id AND revoked_at IS NULL
    `, { id: stored.recordset[0].refresh_token_id });
    await this.storeRefreshToken(row.user_id, tokens.refreshToken);

    return { ...tokens, user: payload };
  }

  async logout(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    await this.db.query(`
      UPDATE crm_refresh_token SET revoked_at=SYSUTCDATETIME()
      WHERE token_hash=@hash AND revoked_at IS NULL
    `, { hash });
    return { success: true };
  }

  private async findUserByLogin(loginId: string): Promise<LoginRow | undefined> {
    const result = await this.db.query<LoginRow>(`
      SELECT TOP 1 user_id, CONVERT(varchar(36), public_id) public_id, login_id,
             user_name, company_id, organization_id, password_hash
      FROM crm_user
      WHERE login_id=@loginId AND is_active=1 AND deleted_yn=0
    `, { loginId });
    return result.recordset[0];
  }

  private async findUserById(userId: number): Promise<LoginRow | undefined> {
    const result = await this.db.query<LoginRow>(`
      SELECT TOP 1 user_id, CONVERT(varchar(36), public_id) public_id, login_id,
             user_name, company_id, organization_id, password_hash
      FROM crm_user
      WHERE user_id=@userId AND is_active=1 AND deleted_yn=0
    `, { userId });
    return result.recordset[0];
  }

  private async buildPayload(row: LoginRow): Promise<JwtPayload> {
    const roleResult = await this.db.query<{ role_code: string; data_scope: JwtPayload['scope'] }>(`
      SELECT r.role_code, r.data_scope
      FROM crm_user_role ur JOIN crm_role r ON r.role_id=ur.role_id
      WHERE ur.user_id=@userId AND r.is_active=1
    `, { userId: row.user_id });
    const permissionResult = await this.db.query<{ permission_code: string }>(`
      SELECT DISTINCT p.permission_code
      FROM crm_user_role ur
      JOIN crm_role_permission rp ON rp.role_id=ur.role_id
      JOIN crm_permission p ON p.permission_id=rp.permission_id
      WHERE ur.user_id=@userId AND p.is_active=1
    `, { userId: row.user_id });

    return {
      sub: row.user_id,
      publicId: row.public_id,
      loginId: row.login_id,
      name: row.user_name,
      companyId: row.company_id,
      organizationId: row.organization_id ?? undefined,
      roles: roleResult.recordset.map(x => x.role_code),
      permissions: permissionResult.recordset.map(x => x.permission_code),
      scope: roleResult.recordset[0]?.data_scope ?? 'SELF'
    };
  }

  private async issueTokens(payload: JwtPayload) {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_EXPIRES as never
    });
    const refreshToken = await this.jwt.signAsync({ sub: payload.sub, type: 'refresh' }, {
      secret: env.JWT_REFRESH_SECRET,
      expiresIn: `${env.JWT_REFRESH_EXPIRES_DAYS}d`
    });
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: number, refreshToken: string) {
    await this.db.query(`
      INSERT INTO crm_refresh_token(user_id, token_hash, expires_at)
      VALUES(@userId, @hash, DATEADD(day, @days, SYSUTCDATETIME()))
    `, { userId, hash: this.hashToken(refreshToken), days: env.JWT_REFRESH_EXPIRES_DAYS });
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
