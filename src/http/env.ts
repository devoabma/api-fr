import { cpfSchema } from '@/utils/validations/cpf'
import 'dotenv/config'

import { z } from 'zod'

const timezoneSchema = z.string().refine(
  timezone => {
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: timezone })

      return true
    } catch {
      return false
    }
  },
  { message: 'Fuso horário inválido, use um identificador IANA (ex: America/Fortaleza)' }
)

const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'production']).default('dev'),
  API_PORT: z.coerce.number().default(25600),
  TIMEZONE: timezoneSchema.default('America/Fortaleza'),
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
  API_PROTHEUS_DATA_URL: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
})

const _env = envSchema.safeParse(process.env)

if (_env.success === false) {
  console.error('> Variáveis de ambiente inválidas, verifique o arquivo .env', z.treeifyError(_env.error))

  throw new Error('Variáveis de ambiente inválidas, verifique o arquivo .env')
}

export const env = _env.data
