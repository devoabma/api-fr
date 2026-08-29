import { fastifyCookie } from '@fastify/cookie'
import { fastifyCors } from '@fastify/cors'
import { fastifyJwt } from '@fastify/jwt'
import { fastifyMultipart } from '@fastify/multipart'
import { fastifyRateLimit } from '@fastify/rate-limit'
import { fastifySwagger } from '@fastify/swagger'
import ScalarApiReference from '@scalar/fastify-api-reference'
import { fastify } from 'fastify'
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'
import { prisma } from '@/lib/prisma'
import { errorHandler } from './_errors'
import { BadRequestError } from './_errors/bad-request'
import { env } from './env'
import { globalRateLimit } from './rate-limit'
import { appRoutes } from './routes'
import { websocketPlugin } from './websocket'

export const app = fastify({
  // Sem isso, atrás de um proxy reverso todas as requisições chegam com o IP do proxy
  // e o rate limit por IP viraria um limite único compartilhado por todos os clientes.
  trustProxy: env.TRUST_PROXY,
}).withTypeProvider<ZodTypeProvider>()

app.setSerializerCompiler(serializerCompiler)
app.setValidatorCompiler(validatorCompiler)

app.setErrorHandler(errorHandler)

/**
 * Clientes HTTP (axios, fetch) mandam `Content-Type: application/json` mesmo em
 * requisições sem corpo, como o logout. O parser padrão rejeita isso com
 * FST_ERR_CTP_EMPTY_JSON_BODY, e a mensagem atrapalha em dois cenários:
 *
 * - **Mascara 404**: o corpo é parseado ANTES do roteamento, então uma URL errada
 *   devolve "Body cannot be empty" em vez de "Rota não encontrada" — e a busca pelo
 *   bug vai parar no lugar errado.
 * - **Mascara validação**: em rota que exige corpo, o Zod nunca roda e o front perde
 *   a lista de campos faltando.
 *
 * Corpo vazio vira `{}` e segue o fluxo normal. JSON malformado continua sendo erro.
 */
app.removeContentTypeParser('application/json')
app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
  if (body === '') {
    return done(null, {})
  }

  try {
    done(null, JSON.parse(body as string))
  } catch {
    done(new BadRequestError('Corpo da requisição não é um JSON válido.'), undefined)
  }
})

/** Teto da sondagem do banco em `/ready`. */
const DATABASE_PROBE_TIMEOUT_IN_MS = 3_000

/**
 * O banco responde?
 *
 * O adapter espera até 15s por uma conexão nova (`connectionTimeoutMillis`, dimensionado para o cold
 * start do Neon). Numa rota de dado isso protege a leitura; aqui atrapalha: a sondagem ficaria
 * pendurada justamente quando o banco está mal, e quem perguntou desiste antes por timeout do
 * cliente — recebendo um erro de rede genérico no lugar de um 503 legível. Estourar o tempo aqui já
 * é a resposta.
 */
async function isDatabaseReachable() {
  // As duas pontas *resolvem*, nenhuma rejeita: assim o perdedor da corrida não vira unhandled rejection.
  const probe = prisma.$queryRaw`SELECT 1`.then(
    () => true,
    () => false
  )

  const timeout = new Promise<boolean>(resolve => {
    // `unref` para um timer ainda pendente não segurar o processo no encerramento.
    setTimeout(() => resolve(false), DATABASE_PROBE_TIMEOUT_IN_MS).unref()
  })

  return Promise.race([probe, timeout])
}

// Registrado antes das rotas: o plugin instala um hook em cada rota declarada depois dele.
app.register(fastifyRateLimit, globalRateLimit).after(() => {
  app.setNotFoundHandler({ preHandler: app.rateLimit({ max: 60, timeWindow: '1 minute' }) }, (request, reply) => {
    return reply.status(404).send({
      message: 'Rota não encontrada.',
      route: request.url,
    })
  })

  /**
   * **Prontidão**: o processo está de pé **e** o banco responde. É o que o selo do painel lê.
   *
   * Mora aqui dentro, e não em linha como o `/health`, por um motivo medido: rota de raiz declarada
   * antes de o plugin de rate limit terminar de carregar não recebe o hook e responde sem os
   * `x-ratelimit-*` — fica sem teto sem avisar. No `/health` isso é indiferente (ele já é isento por
   * `UNLIMITED_ROUTES` e não toca em nada); aqui não: é rota pública que encosta no banco, e sem
   * limite vira um jeito barato de um estranho mandar a API abrir conexão.
   *
   * O teto próprio vai em `config.rateLimit`, e não num `preHandler` como o do `setNotFoundHandler`
   * logo acima: ali funciona porque o 404 não é rota registrada e escapa do hook global, mas em rota
   * de verdade o hook global chega primeiro e o `preHandler` não muda nada — medido, 65 chamadas sem
   * um único 429. 60/min por IP é folga larga: o painel pergunta 2 vezes por minuto em cada aba
   * aberta.
   */
  app.get('/ready', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (_request, reply) => {
    const isDatabaseUp = await isDatabaseReachable()

    if (!isDatabaseUp) {
      return reply.status(503).send({ status: 'error', database: 'down' })
    }

    return reply.status(200).send({ status: 'ok', database: 'up' })
  })
})

/**
 * **Vivacidade**: o processo está de pé e atendendo. De propósito não toca no banco.
 *
 * Quem consome isto é o `HEALTHCHECK` do Dockerfile, e para o orquestrador "não saudável" significa
 * uma coisa só: reinicie o contêiner. Reiniciar a API não conserta banco fora do ar — só derruba os
 * WebSockets dos Desktops das salas e, se a queda durar, vira laço de reinício. Com o Neon em
 * scale-to-zero, um cold start já bastaria para disparar isso.
 *
 * Quem quer saber se dá para *atender de verdade* pergunta em `/ready`.
 */
app.get('/health', async (_request, reply) => {
  return reply.status(200).send({ status: 'ok' })
})

app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Sala Livre API',
      description:
        'API desenvolvida para o projeto SalaLivre. Uma plataforma integrada de gestão de espaços tecnológicos voltada para os escritórios compartilhados e salas de fórum da OAB Maranhão.',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  transform: jsonSchemaTransform,
})

app.register(ScalarApiReference, {
  routePrefix: '/docs',
})

app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
  cookie: {
    cookieName: env.TOKEN_COOKIE_NAME,
    signed: false,
  },
})

// Com `credentials: true` o navegador rejeita `origin: '*'`, então a origem precisa ser explícita.
//
// `methods` também precisa ser explícito: o default do @fastify/cors v11 são só os métodos
// safelisted (GET, HEAD, POST). Sem a lista completa o preflight ainda responde 204, mas com
// `access-control-allow-methods: GET,HEAD,POST` — o navegador lê isso e barra PATCH/PUT/DELETE
// antes de mandar a requisição real, então o front toma erro de rede sem corpo e a API não
// registra nada, porque a chamada nunca chegou aqui.
app.register(fastifyCors, {
  origin: env.WEB_URL,
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
})

app.register(fastifyCookie)

app.register(fastifyMultipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5mb
  },
})

// Canal permanente com os Desktops das salas — mesma aplicação, mesma porta.
app.register(websocketPlugin)

app.register(appRoutes)
