import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthService } from './auth.service';

const loginSchema = z.object({ loginId: z.string().min(1), password: z.string().min(1) });
const tokenSchema = z.object({ refreshToken: z.string().min(1) });

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login') login(@Body() body: unknown) {
    const input = loginSchema.parse(body);
    return this.auth.login(input.loginId, input.password);
  }
  @Post('refresh') refresh(@Body() body: unknown) {
    return this.auth.refresh(tokenSchema.parse(body).refreshToken);
  }
  @Post('logout') logout(@Body() body: unknown) {
    return this.auth.logout(tokenSchema.parse(body).refreshToken);
  }
}
