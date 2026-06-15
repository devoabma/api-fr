import { compare, hash } from 'bcryptjs'
import dayjs from 'dayjs'
import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { badRequestSchema } from '@/http/_errors/schemas/error-responses'
import { env } from '@/http/env'
import { prisma } from '@/lib/prisma'
import { resend } from '@/lib/resend'
import SendConfirmationChangedPassword from '@/utils/emails/sendConfirmationChangedPassword'

const resetPasswordSchema = {
  tags: ['employees'],
  summary: 'Redefine a senha',
  body: z
    .object({
      code: z.string('Código de redefinição obrigatório').trim(),
      password: z.string('Senha obrigatória').trim().min(8, 'Senha mínima de 8 caracteres'),
      confirmPassword: z.string('Confirmação de senha obrigatória').trim().min(8, 'Senha mínima de 8 caracteres'),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: 'As senhas devem ser iguais.',
      path: ['confirmPassword'],
    }),
  response: {
    200: z.object({
      message: z.string(),
    }),
    400: badRequestSchema,
  },
} satisfies FastifySchema

export async function resetPassword(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/reset-password',
    {
      schema: resetPasswordSchema,
    },
    async (request, reply) => {
      const { code, password } = request.body

      const token = await prisma.tokens.findUnique({
        where: {
          code,
          type: 'PASSWORD_RECOVER',
        },
        select: {
          id: true,
          employeeId: true,
          expiresAt: true,
        },
      })

      if (!token) throw new BadRequestError('Código de redefinição de senha inválido.')

      if (token.expiresAt && dayjs().isAfter(token.expiresAt)) {
        throw new BadRequestError('Código de redefinição de senha expirado. Por favor, solicite uma nova redefinição de senha.')
      }

      const employee = await prisma.employees.findUnique({
        where: {
          id: token.employeeId,
        },
      })

      if (!employee) {
        throw new BadRequestError('Funcionário não encontrado.')
      }

      const isSamePassword = await compare(password, employee.passwordHash)

      if (isSamePassword) {
        throw new BadRequestError('Informe uma senha ainda não utilizada anteriormente.')
      }

      const passwordHash = await hash(password, 8)

      await prisma.$transaction([
        prisma.tokens.delete({
          where: {
            id: token.id,
          },
        }),
        prisma.employees.update({
          where: {
            id: employee.id,
          },
          data: {
            passwordHash,
          },
        }),
      ])

      const { error } = await resend.emails.send({
        from: '📧 Sala Livre <salalivre@hit.dev.br>',
        to: env.NODE_ENV === 'production' ? employee.email : 'hilquiasfmelo@gmail.com',
        subject: '🔑 Confirmação de redefinição de senha',
        react: SendConfirmationChangedPassword({
          name: employee.name,
          link: env.WEB_URL,
        }),
      })

      if (error) {
        console.error({ err: error }, 'Falha ao enviar e-mail de confirmação.')
      }

      return reply.status(200).send({
        message: 'Senha redefinida com sucesso.',
      })
    }
  )
}
