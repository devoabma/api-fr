import { compare } from 'bcryptjs'
import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { badRequestSchema } from '@/http/_errors/schemas/error-responses'
import { UnauthorizedError } from '@/http/_errors/unauthorized'
import { env } from '@/http/env'
import { prisma } from '@/lib/prisma'
import { cpfSchema } from '@/utils/validations/cpf'

const authenticateSchema = {
  tags: ['employees'],
  summary: 'Autentica um funcionário',
  body: z.object({
    cpf: cpfSchema,
    password: z.string('Senha obrigatória').trim().min(8, 'Senha mínima de 8 caracteres'),
  }),
  response: {
    200: z.object({
      token: z.string(),
    }),
    400: badRequestSchema,
  },
} satisfies FastifySchema

export async function authenticate(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/session/auth',
    {
      schema: authenticateSchema,
    },
    async (request, reply) => {
      const { cpf, password } = request.body

      const employee = await prisma.employees.findUnique({
        where: {
          cpf,
        },
        select: {
          id: true,
          role: true,
          passwordHash: true,
          inactive: true,
        },
      })

      if (!employee) {
        throw new UnauthorizedError('Credenciais inválidas. Verifique suas informações e tente novamente.')
      }

      if (employee.inactive) {
        throw new UnauthorizedError('Funcionário inativo. Entre em contato com o administrador.')
      }

      const isValidPassword = await compare(password, employee.passwordHash)

      if (!isValidPassword) {
        throw new UnauthorizedError('Credenciais inválidas. Verifique suas informações e tente novamente.')
      }

      const token = await reply.jwtSign(
        {
          sub: employee.id,
          role: employee.role,
        },
        {
          sign: {
            expiresIn: '1d',
          },
        }
      )

      return reply
        .setCookie(env.TOKEN_COOKIE_NAME, token, {
          path: '/',
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
          domain: env.DOMAIN_URL,
          maxAge: 60 * 60 * 24, // 1 dia
        })
        .status(200)
        .send({ token })
    }
  )
}
