import {
  CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { env } from '../config/env';

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);

export type JwtPayload = {
  sub: number;
  publicId: string;
  loginId: string;
  name: string;
  companyId: number;
  organizationId?: number;
  roles: string[];
  permissions: string[];
  scope: 'SELF' | 'BRANCH' | 'DIVISION' | 'ALL' | 'SYSTEM';
};

declare module 'express-serve-static-core' {
  interface Request { authUser?: JwtPayload; }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing access token');
    try {
      request.authUser = await this.jwt.verifyAsync<JwtPayload>(header.slice(7), {
        secret: env.JWT_ACCESS_SECRET
      });
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const permission = Reflect.getMetadata(PERMISSION_KEY, context.getHandler()) as string | undefined;
    if (!permission) return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.authUser?.permissions.includes(permission)) {
      throw new ForbiddenException(`Permission required: ${permission}`);
    }
    return true;
  }
}
