import { z } from 'zod'

const envSchema = z.object({
    PORT: z.coerce.number().default(4000),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().optional(),
    REDIS_URL: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    SESSION_SECRET: z.string().default('dev-secret-change-me'),
    FRONTEND_URL: z.string().default('http://localhost:3000'),
    ADMIN_EMAIL: z.string().optional(),
    ADMIN_PASSWORD: z.string().optional(),
    DATA_DIR: z.string().default('./data'),
})

export type Env = z.infer<typeof envSchema>

export const env = envSchema.parse(process.env)
