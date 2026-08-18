import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { env } from '@/http/env'

const logoutSchema = {
  tags: ['employees'],
  summary: 'Encerra a sessão do funcionário logado',
  response: {
    200: z.object({
      message: z.string(),
    }),
  },
} satisfies FastifySchema

export async function logoutEmployee(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/session/logout',
    {
      schema: logoutSchema,
    },
    async (_request, reply) => {
      return reply
        .clearCookie(env.TOKEN_COOKIE_NAME, {
          path: '/',
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
          domain: env.DOMAIN_URL,
        })
        .status(200)
        .send({
          message: 'Sessão encerrada com sucesso.',
        })
    }
  )
}
