import 'dotenv/config'

import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'production']).default('dev'),
  API_PORT: z.coerce.number().default(25600),
  WEB_URL: z.string().default('http://localhost:3000'),
  DOMAIN_URL: z.string().default('localhost'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  RESEND_API_KEY: z.string(),
  TOKEN_COOKIE_NAME: z.string(),
})

const _env = envSchema.safeParse(process.env)

if (_env.success === false) {
  console.error('> Variáveis de ambiente inválidas, verifique o arquivo .env', z.treeifyError(_env.error))

  throw new Error('Variáveis de ambiente inválidas, verifique o arquivo .env')
}

export const env = _env.data
