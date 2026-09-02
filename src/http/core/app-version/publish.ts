import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { UnauthorizedError } from '@/http/_errors/unauthorized'
import { env } from '@/http/env'
import { rateLimits } from '@/http/rate-limit'
import { savePublishedVersion } from './save-published-version'

/**
 * O aviso da publicação: `publicar.ps1` manda o envelope assinado no instante em que a versão sai.
 *
 * É a fonte — a API sabe da versão nova no segundo em que ela existe, sem esperar intervalo nenhum.
 * O job de espelho (`mirror-app-version.cron.ts`) é a rede de segurança para o dia em que este aviso
 * não chegar.
 */

const publishAppVersionSchema = {
  tags: ['app'],
  summary: 'Recebe o manifesto assinado no momento da publicação (token de serviço, não é login)',
  body: z.object({
    /** O manifesto em base64. É aqui dentro que mora o número da versão. */
    conteudo: z.string().nonempty(),
    algoritmo: z.string().nonempty(),
    chave: z.string().nonempty(),
    assinatura: z.string().nonempty(),
  }),
  response: {
    201: z.object({
      message: z.string(),
      version: z.string(),
    }),
    // Chegou depois de uma versão mais nova. Não é falha do publicador, mas ele precisa saber que a
    // API não trocou o que já tinha.
    409: z.object({
      message: z.string(),
      version: z.string().optional(),
    }),
    400: z.object({ message: z.string() }),
    401: z.object({ message: z.string() }),
    503: z.object({ message: z.string() }),
  },
} satisfies FastifySchema

/** Onde o parser desta rota guarda o corpo original, antes de virar objeto. */
type RequestWithRawBody = FastifyRequest & { rawBody?: string }

/**
 * Compara dois segredos sem vazar, pelo tempo de resposta, quantos caracteres iniciais acertaram.
 *
 * O `timingSafeEqual` exige buffers do mesmo tamanho — e o tamanho do que chegou é escolhido por
 * quem chama. Por isso os dois passam por SHA-256 antes: o digest tem sempre 32 bytes, e a
 * comparação vira constante de verdade, inclusive quando os comprimentos diferem.
 */
function isTokenValid(received: string, expected: string): boolean {
  const receivedDigest = createHash('sha256').update(received).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()

  return timingSafeEqual(receivedDigest, expectedDigest)
}

/** `Authorization: Bearer <token>` — devolve só o token, ou `null` se o header não tem essa cara. */
function readBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization

  if (!header) {
    return null
  }

  const [scheme, token] = header.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

export async function publishAppVersion(app: FastifyInstance) {
  /**
   * Parser próprio desta rota, para ficar com o corpo **como texto**.
   *
   * O parser global de `app.ts` entrega só o objeto já parseado, e o objeto não serve aqui: a fase 2
   * (`GET /app/version`) devolve este envelope byte a byte às estações. Guardar objeto e remontar na
   * saída reordena chaves e reindenta o JSON — e a estação recusa em silêncio o que não confere.
   *
   * Fica **encapsulado neste plugin**: `publishAppVersion` é registrado como plugin comum (sem
   * `fastify-plugin`), então nenhuma outra rota da API é afetada. O `remove` antes é obrigatório —
   * o parser global já ocupa esse content type, e adicionar por cima dispara `FST_ERR_CTP_ALREADY_PRESENT`.
   */
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const raw = body as string

    ;(request as RequestWithRawBody).rawBody = raw

    if (raw === '') {
      return done(null, {})
    }

    try {
      done(null, JSON.parse(raw))
    } catch {
      done(new BadRequestError('Corpo da requisição não é um JSON válido.'), undefined)
    }
  })

  app.withTypeProvider<ZodTypeProvider>().post(
    '/version',
    {
      schema: publishAppVersionSchema,
      config: { rateLimit: rateLimits.publishAppVersion },
    },
    async (request, reply) => {
      // Sem token configurado a rota não atende ninguém. É o padrão seguro: o contrário seria
      // comparar segredo vazio com segredo vazio e aceitar qualquer manifesto que batesse à porta.
      if (!env.APP_VERSION_PUBLISH_TOKEN) {
        return reply.status(503).send({
          message: 'Publicação de versão indisponível: a API está sem o token de publicação configurado.',
        })
      }

      const token = readBearerToken(request)

      if (!token || !isTokenValid(token, env.APP_VERSION_PUBLISH_TOKEN)) {
        throw new UnauthorizedError('Token de publicação inválido.')
      }

      const rawBody = (request as RequestWithRawBody).rawBody

      if (!rawBody) {
        throw new BadRequestError('Corpo da requisição vazio.')
      }

      // O texto cru é que vai para o banco — o `request.body` validado acima serviu só para o Zod
      // recusar cedo o que nem tem as quatro chaves do envelope.
      const result = await savePublishedVersion({ envelope: rawBody, origin: 'PUBLISHER' })

      if (result.status === 'ignored') {
        if (result.reason === 'older' || result.reason === 'stale_rollout') {
          const detail =
            result.reason === 'older'
              ? 'já existe uma versão mais nova guardada'
              : 'já existe uma publicação mais recente desta mesma versão'

          console.warn(`[Versão 📦] Publicação da ${result.version} recusada: ${detail}.`)

          return reply.status(409).send({
            // A distinção importa para quem publica: "mandei o número errado" e "mandei uma onda
            // que já foi substituída" pedem conferências diferentes do outro lado.
            message:
              result.reason === 'older'
                ? 'Já existe uma versão mais nova publicada. Nada foi alterado.'
                : 'Já existe uma publicação mais recente desta mesma versão (geradoEm posterior). Nada foi alterado.',
            version: result.version,
          })
        }

        console.warn(`[Versão ⚠️ ] Publicação recusada (${result.reason}).`)

        throw new BadRequestError(
          result.reason === 'invalid_signature'
            ? 'A assinatura do manifesto não confere.'
            : 'Manifesto inválido: não foi possível ler a versão de dentro do envelope.'
        )
      }

      console.log(`[Versão 📦] Versão ${result.version} publicada e guardada (aviso da publicação).`)

      return reply.status(201).send({
        message: 'Versão publicada registrada.',
        version: result.version,
      })
    }
  )
}
