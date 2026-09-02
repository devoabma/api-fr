import { normalizeIP, type RateLimitOptions, type RateLimitPluginOptions } from '@fastify/rate-limit'
import type { FastifyRequest } from 'fastify'
import { formattedCodeMac } from '@/utils'
import { TooManyRequestsError } from './_errors/too-many-requests'

const ONLY_DIGITS = /\D/g

/** Rotas de infraestrutura que não fazem sentido limitar (healthcheck do Docker e documentação). */
const UNLIMITED_ROUTES = ['/health', '/docs']

function ipKey(request: FastifyRequest) {
  return normalizeIP(request.ip)
}

function rawBodyField(request: FastifyRequest, field: string) {
  const body = request.body

  if (typeof body !== 'object' || body === null) {
    return null
  }

  const value = (body as Record<string, unknown>)[field]

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/**
 * Chave por computador, mas sempre prefixada pelo IP.
 *
 * O macCode chega do cliente sem autenticação, então uma chave só com ele deixaria
 * qualquer um de fora estourar o balde de um terminal conhecido e trancar o advogado
 * que está na frente da máquina. Com o IP no prefixo, o atacante gasta o próprio balde.
 *
 * Terminais atrás do mesmo NAT continuam separados, porque o macCode difere entre eles.
 */
function macCodeKey(request: FastifyRequest, macCode: string | null) {
  const ip = ipKey(request)

  return macCode ? `${ip}:mac:${formattedCodeMac(macCode)}` : ip
}

export const globalRateLimit: RateLimitPluginOptions = {
  global: true,
  max: 300,
  timeWindow: '1 minute',
  // Barra o quanto antes: no onRequest o corpo ainda não foi lido nem parseado.
  hook: 'onRequest',
  keyGenerator: ipKey,
  allowList: request => {
    // request.url traz a query string; sem cortar, "/health?x=1" escaparia da allowList.
    const path = request.url.split('?')[0]

    return UNLIMITED_ROUTES.some(route => path === route || path.startsWith(`${route}/`))
  },
  // Se o store falhar, é melhor atender a requisição do que derrubar a API inteira.
  skipOnError: true,
  errorResponseBuilder: (_request, context) => new TooManyRequestsError(Math.ceil(context.ttl / 1000)),
}

export const rateLimits = {
  authenticate: {
    max: 5,
    timeWindow: '10 minutes',
    hook: 'preValidation',
    keyGenerator: request => {
      const cpf = rawBodyField(request, 'cpf')

      return `${ipKey(request)}:${cpf ? cpf.replace(ONLY_DIGITS, '') : 'sem-cpf'}`
    },
  },

  passwordRecovery: {
    max: 5,
    timeWindow: '15 minutes',
    continueExceeding: true,
    keyGenerator: ipKey,
  },

  resetPassword: {
    max: 10,
    timeWindow: '10 minutes',
    keyGenerator: ipKey,
  },

  releaseComputer: {
    max: 10,
    timeWindow: '1 minute',
    hook: 'preValidation',
    keyGenerator: request => macCodeKey(request, rawBodyField(request, 'macCode')),
  },

  closeSession: {
    max: 30,
    timeWindow: '1 minute',
    keyGenerator: ipKey,
  },

  sendToPrint: {
    max: 15,
    timeWindow: '5 minutes',
    keyGenerator: request => {
      const { macCode } = request.params as { macCode?: string }

      return macCodeKey(request, macCode ?? null)
    },
  },

  /**
   * Disparo de atualização do Desktop, contado **por máquina**.
   *
   * Por máquina, e não por funcionário, porque cada disparo aceito manda uma estação baixar ~60 MB:
   * o que satura o link da unidade é a mesma sala baixando junto, não o mesmo crachá clicando. Um
   * teto por usuário travaria quem acabou de atualizar a Sala 1 na hora de atualizar a Sala 2.
   *
   * Dez em cinco minutos é folgado de propósito — o suporte precisa poder insistir quando a estação
   * não responde. É a segunda linha de defesa, não a primeira: o próprio cliente tem trava de "uma
   * de cada vez" e responde o estado atual ao segundo pedido, em vez de abrir outro download.
   */
  updateComputerApp: {
    max: 10,
    timeWindow: '5 minutes',
    keyGenerator: request => {
      const { id } = request.params as { id?: string }

      return `${ipKey(request)}:computer:${id ?? 'sem-id'}`
    },
  },

  /**
   * Aviso da publicação. Quem chama é o `publicar.ps1`, uma vez por versão — o teto existe só para
   * um segredo vazado não virar um jeito barato de encher a tabela de manifestos.
   */
  publishAppVersion: {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: ipKey,
  },
} satisfies Record<string, RateLimitOptions>
