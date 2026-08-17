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

/**
 * Define se o Fastify pode confiar no header `x-forwarded-for` para descobrir o IP real
 * do cliente. É o que faz o rate limit contar por usuário, e não por proxy.
 *
 * - `false` (padrão): API exposta direto, usa o IP da conexão TCP.
 * - `true`: confia em qualquer proxy. NUNCA use se a porta da API estiver acessível
 *   publicamente, pois qualquer um forja o header e escapa do limite.
 * - `1`, `2`, ...: número de proxies na frente da API (mais seguro que `true`).
 * - `10.0.0.0/8,172.18.0.0/16`: lista de IPs/CIDRs confiáveis (mais seguro ainda).
 */
const trustProxySchema = z
  .string()
  .default('false')
  .transform(value => {
    if (value === 'true') {
      return true
    }

    if (value === 'false') {
      return false
    }

    const hops = Number(value)

    return Number.isInteger(hops) && hops > 0 ? hops : value
  })

const allowDefaultingLawyersSchema = z
  .string()
  .default('false')
  .transform(value => value.trim().toLowerCase() === 'true')

/**
 * Origem do front web. Serve para duas coisas com exigências diferentes:
 *
 * - **CORS**: o `Origin` que o navegador manda nunca tem barra no fim nem caminho.
 *   `@fastify/cors` compara a string byte a byte, então `https://app.exemplo.com/`
 *   simplesmente nunca casa — e o sintoma é o front inteiro tomando erro de CORS
 *   sem nenhuma mensagem no log da API.
 * - **Links de e-mail** (`${WEB_URL}/sign-in`): com barra no fim viraria `//sign-in`.
 *
 * Nos dois casos o conserto é o mesmo: exigir URL válida e cortar as barras finais.
 */
const webUrlSchema = z
  .url()
  .default('http://localhost:3000')
  .transform(value => value.replace(/\/+$/, ''))

const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'production']).default('dev'),
  ALLOW_DEFAULTING_LAWYERS: allowDefaultingLawyersSchema,
  API_PORT: z.coerce.number().default(25600),
  TRUST_PROXY: trustProxySchema,
  TIMEZONE: timezoneSchema.default('America/Fortaleza'),
  WEB_URL: webUrlSchema,
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
