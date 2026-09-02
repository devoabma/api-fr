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
 * - **Links de e-mail** (`${WEB_URL}/auth/sign-in`): com barra no fim viraria `//auth/sign-in`.
 *
 * Nos dois casos o conserto é o mesmo: exigir URL válida e cortar as barras finais.
 */
const webUrlSchema = z
  .url()
  .default('http://localhost:3000')
  .transform(value => value.replace(/\/+$/, ''))

/**
 * Teto do token que a publicação apresenta em `POST /app/version`.
 *
 * É **opcional** de propósito, e a rota recusa tudo enquanto ele não estiver definido: exigir aqui
 * derrubaria o boot de qualquer ambiente que ainda não gerou o segredo — inclusive o de quem só
 * quer subir a API para mexer em outra coisa. Ausente significa "ninguém publica por aqui", que é o
 * padrão seguro; o que não pode existir é token vazio comparado com token vazio e dando certo.
 *
 * O mínimo de 32 caracteres é para o segredo não nascer adivinhável — não é a chave que assina o
 * manifesto (essa nunca sai do cofre de quem publica), é só autorização de entrada.
 */
const appVersionPublishTokenSchema = z
  .string()
  .trim()
  /**
   * Vazio é **não configurado**, e não "token curto demais".
   *
   * O `.env.example` nasce com a chave presente e sem valor, que é como se declara "isto existe,
   * preencha quando for usar". Sem esta linha, `APP_VERSION_PUBLISH_TOKEN=""` reprova no `min(32)` e
   * derruba o boot de quem só copiou o arquivo — exatamente o ambiente que o `.optional()` acima
   * existe para proteger. Só em branco também entra aqui: `" "` não é segredo, é descuido.
   */
  .transform(value => value || undefined)
  .pipe(z.string().min(32, 'O token de publicação precisa de pelo menos 32 caracteres').optional())
  .optional()

/**
 * Chave **pública** do publicador (DER/SPKI em base64), para conferir a assinatura do manifesto
 * na entrada. Vazia = conferência desligada, que é o padrão enquanto a chave não for combinada.
 *
 * Não é segredo: ela já viaja dentro de todo executável instalado no parque. A privada, que
 * assina, nunca chega perto da API.
 *
 * O `trim` para vazio é o que separa "desligado" de "ligado com chave ilegível": `" "` é truthy,
 * passaria pelo desligamento e faria `createPublicKey` lançar em **todo** manifesto — e a captura de
 * `isEnvelopeSignatureValid` transformaria isso em `invalid_signature` silencioso, com o painel
 * parando de receber versão nova sem nenhum erro em lugar nenhum.
 */
const appManifestPublicKeySchema = z
  .string()
  .trim()
  .transform(value => value || undefined)
  .optional()

const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'production']).default('dev'),
  /** Arquivo público e assinado que as estações já consultam. É o que o job de espelho lê. */
  APP_MANIFEST_URL: z.url().default('https://salalivre.app/versao.json'),
  APP_VERSION_PUBLISH_TOKEN: appVersionPublishTokenSchema,
  APP_MANIFEST_PUBLIC_KEY: appManifestPublicKeySchema,
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
