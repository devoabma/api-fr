/**
 * Disparado pelo @fastify/rate-limit quando o teto de requisições é estourado.
 *
 * O plugin faz `throw errorResponseBuilder(...)`, ou seja, o valor retornado pelo
 * builder cai direto no errorHandler global. Por isso ele precisa ser um erro
 * conhecido: sem essa classe, o 429 seria tratado como erro desconhecido e
 * viraria um 500 genérico.
 */
export class TooManyRequestsError extends Error {
  /** Segundos restantes até a janela reabrir (espelha o header `retry-after`). */
  readonly retryAfterInSeconds: number

  constructor(retryAfterInSeconds: number, message?: string) {
    super(message ?? 'Muitas requisições em pouco tempo. Aguarde um instante e tente novamente.')

    this.retryAfterInSeconds = retryAfterInSeconds
  }
}
