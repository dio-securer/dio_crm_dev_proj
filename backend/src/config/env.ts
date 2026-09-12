import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_VERSION: z.string().default('0.1.0'),

  CRM_DB_SERVER: z.string().default('localhost'),
  CRM_DB_PORT: z.coerce.number().int().min(1).max(65535).default(1433),
  CRM_DB_DATABASE: z.string().default('dio_crm'),
  CRM_DB_USER: z.string().default('crm_app'),
  CRM_DB_PASSWORD: z.string().default('CHANGE_ME'),
  CRM_DB_ENCRYPT: z.enum(['true', 'false']).default('false'),
  CRM_DB_POOL_MAX: z.coerce.number().int().min(1).max(200).default(20),
  CRM_DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(10000),
  CRM_DB_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(30000),
  CRM_DB_SLOW_QUERY_MS: z.coerce.number().int().min(100).max(300000).default(1500),

  JWT_ACCESS_SECRET: z.string().min(12).default('CHANGE_ME_ACCESS'),
  JWT_REFRESH_SECRET: z.string().min(12).default('CHANGE_ME_REFRESH'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().min(1).max(90).default(14),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(100000).default(300),
  SLOW_REQUEST_MS: z.coerce.number().int().min(100).max(300000).default(2000),

  INTERFACE_CIRCUIT_FAILURES: z.coerce.number().int().min(2).max(100).default(5),
  INTERFACE_CIRCUIT_RESET_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),

  FILE_STORAGE_ROOT: z.string().default('./storage'),
  DIO_CRM_PDF_FONT: z.string().optional()
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== 'production') return;
  const invalid = [
    ['CRM_DB_PASSWORD', value.CRM_DB_PASSWORD === 'CHANGE_ME'],
    ['JWT_ACCESS_SECRET', value.JWT_ACCESS_SECRET.startsWith('CHANGE_ME') || value.JWT_ACCESS_SECRET.length < 32],
    ['JWT_REFRESH_SECRET', value.JWT_REFRESH_SECRET.startsWith('CHANGE_ME') || value.JWT_REFRESH_SECRET.length < 32],
    ['CORS_ORIGINS', value.CORS_ORIGINS.trim() === '*' || value.CORS_ORIGINS.trim() === '']
  ] as const;
  for (const [path, failed] of invalid) {
    if (failed) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: `${path} must be explicitly configured for production` });
  }
});

export type Env = z.infer<typeof schema>;
export const env: Env = schema.parse(process.env);
