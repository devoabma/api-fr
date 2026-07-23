import { fastifyCookie } from '@fastify/cookie'
import { fastifyCors } from '@fastify/cors'
import { fastifyJwt } from '@fastify/jwt'
import { fastifyMultipart } from '@fastify/multipart'
import { fastifySwagger } from '@fastify/swagger'
import ScalarApiReference from '@scalar/fastify-api-reference'
import { fastify } from 'fastify'
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'
import { errorHandler } from './_errors'
import { env } from './env'
import { appRoutes } from './routes'

export const app = fastify().withTypeProvider<ZodTypeProvider>()

app.setSerializerCompiler(serializerCompiler)
app.setValidatorCompiler(validatorCompiler)

app.setErrorHandler(errorHandler)
app.setNotFoundHandler((request, reply) => {
  return reply.status(404).send({
    message: 'Rota não encontrada.',
    route: request.url,
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

app.register(appRoutes)
