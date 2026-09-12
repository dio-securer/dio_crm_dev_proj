import crypto from 'node:crypto';
import { INestApplication, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { FixedWindowRateLimiter, isOriginAllowed, parseAllowedOrigins } from './hardening.rules';

const logger = new Logger('HttpHardening');

export function configureHttpHardening(app: INestApplication) {
  const allowedOrigins = parseAllowedOrigins(env.CORS_ORIGINS);
  const limiter = new FixedWindowRateLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX);

  app.enableCors({
    credentials: true,
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowedOrigins)) return callback(null, true);
      return callback(new Error('CORS origin is not allowed'), false);
    }
  });

  const expressApp = app.getHttpAdapter().getInstance();
  if (env.TRUST_PROXY === 'true' && typeof expressApp.set === 'function') expressApp.set('trust proxy', 1);

  let requestCounter = 0;
  app.use((req: Request & { requestId?: string }, res: Response, next: NextFunction) => {
    const incomingId = req.header('x-request-id');
    const requestId = incomingId && /^[A-Za-z0-9._:-]{8,128}$/.test(incomingId) ? incomingId : crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=(self)');
    res.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    if (env.NODE_ENV === 'production') res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');

    const path = req.originalUrl || req.url;
    if (!path.startsWith('/api/health/')) {
      const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
      const rate = limiter.hit(clientKey);
      res.setHeader('x-ratelimit-limit', String(env.RATE_LIMIT_MAX));
      res.setHeader('x-ratelimit-remaining', String(rate.remaining));
      res.setHeader('x-ratelimit-reset', String(Math.ceil(rate.resetAt / 1000)));
      if (!rate.allowed) return res.status(429).json({ statusCode: 429, error: 'TooManyRequests', requestId });
    }

    requestCounter += 1;
    if (requestCounter % 1000 === 0) limiter.prune();
    const started = Date.now();
    res.on('finish', () => {
      const elapsed = Date.now() - started;
      if (elapsed >= env.SLOW_REQUEST_MS) {
        logger.warn(`slow_request requestId=${requestId} method=${req.method} path=${path.split('?')[0]} status=${res.statusCode} elapsedMs=${elapsed}`);
      }
    });
    next();
  });
}
