import { z } from 'zod'

/**
 * Resposta padrão de erro 400.
 *
 * O campo `errors` é preenchido apenas em falhas de validação do Zod
 * (montado no errorHandler). Erros de regra de negócio lançados via
 * BadRequestError retornam somente `message`, por isso `errors` é opcional.
 */
export const badRequestSchema = z.object({
  message: z.string(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      })
    )
    .optional(),
})

/**
 * Resposta padrão de erro 429 (rate limit).
 *
 * Acompanha os headers `retry-after` e `x-ratelimit-*` enviados pelo
 * @fastify/rate-limit. O corpo repete o tempo de espera em segundos para
 * o cliente (app desktop / front) conseguir exibir a contagem sem ler headers.
 */
export const tooManyRequestsSchema = z.object({
  message: z.string(),
  retryAfterInSeconds: z.number(),
})
