import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  CRM_DB_SERVER: z.string().default('localhost'),
  CRM_DB_PORT: z.coerce.number().default(1433),
  CRM_DB_DATABASE: z.string().default('dio_crm'),
  CRM_DB_USER: z.string().default('crm_app'),
  CRM_DB_PASSWORD: z.string().default('CHANGE_ME'),
  CRM_DB_ENCRYPT: z.enum(['true', 'false']).default('false'),
  JWT_ACCESS_SECRET: z.string().min(12).default('CHANGE_ME_ACCESS'),
  JWT_REFRESH_SECRET: z.string().min(12).default('CHANGE_ME_REFRESH'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().default(14),
  FILE_STORAGE_ROOT: z.string().default('./storage')
});

export type Env = z.infer<typeof schema>;
export const env: Env = schema.parse(process.env);
