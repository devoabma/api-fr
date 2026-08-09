import { fastifyCookie } from '@fastify/cookie'
import { fastifyCors } from '@fastify/cors'
import { fastifyJwt } from '@fastify/jwt'
import { fastifyMultipart } from '@fastify/multipart'
import { fastifyRateLimit } from '@fastify/rate-limit'
import { fastifySwagger } from '@fastify/swagger'
import ScalarApiReference from '@scalar/fastify-api-reference'
import { fastify } from 'fastify'
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'
import { errorHandler } from './_errors'
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

// Registrado antes das rotas: o plugin instala um hook em cada rota declarada depois dele.
app.register(fastifyRateLimit, globalRateLimit).after(() => {
  app.setNotFoundHandler({ preHandler: app.rateLimit({ max: 60, timeWindow: '1 minute' }) }, (request, reply) => {
    return reply.status(404).send({
      message: 'Rota não encontrada.',
      route: request.url,
    })
  })
})

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

app.register(fastifyCors, {
  origin: '*',
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
