import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().min(1).default('http://localhost:3000'),
  BETTER_AUTH_SECRET: z.string().min(1),
  AUTH_MODE: z.enum(['authentik', 'password']).default('authentik'),
  AUTHENTIK_ISSUER_URL: z.string().optional(),
  AUTHENTIK_CLIENT_ID: z.string().optional(),
  AUTHENTIK_CLIENT_SECRET: z.string().optional(),
  AUTHENTIK_API_TOKEN: z.string().optional(),
  MASTER_USER_EMAIL: z.string().optional(),
  MASTER_USER_PASSWORD: z.string().optional(),
  MASTER_USER_NAME: z.string().default('Administrador'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10_485_760),
  S3_ENDPOINT: z.string().min(1).default('minio'),
  S3_PORT: z.coerce.number().int().positive().default(9000),
  S3_USE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1).default('forms-conformidade'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration:\n${z.prettifyError(parsed.error)}`,
  )
}

export const env = parsed.data

export const isAuthentikLoginEnabled =
  env.AUTH_MODE === 'authentik' &&
  Boolean(
    env.AUTHENTIK_ISSUER_URL &&
      env.AUTHENTIK_CLIENT_ID &&
      env.AUTHENTIK_CLIENT_SECRET,
  )

export const isAuthentikSyncEnabled = Boolean(
  env.AUTHENTIK_ISSUER_URL && env.AUTHENTIK_API_TOKEN,
)
