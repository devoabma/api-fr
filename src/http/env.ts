import { cpfSchema } from '@/utils/validations/cpf'
import 'dotenv/config'

import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'production']).default('dev'),
  API_PORT: z.coerce.number().default(25600),
  WEB_URL: z.string().default('http://localhost:3000'),
  DOMAIN_URL: z.string().default('localhost'),
  CPF_ADMIN: cpfSchema,
  EMAIL_ADMIN: z.email(),
  JWT_SECRET: z.string(),
  DATABASE_URL: z.string(),
  RESEND_API_KEY: z.string(),
  PASSWORD_ADMIN: z.string(),
  TOKEN_COOKIE_NAME: z.string(),
  PUBLIC_SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
})

const _env = envSchema.safeParse(process.env)

if (_env.success === false) {
  console.error('> Variáveis de ambiente inválidas, verifique o arquivo .env', z.treeifyError(_env.error))

  throw new Error('Variáveis de ambiente inválidas, verifique o arquivo .env')
}

export const env = _env.data
