import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { env } from '@/http/env'
import { prisma } from '@/lib/prisma'
import { resend } from '@/lib/resend'
import { generateRecoveryCode } from '@/utils'
import ResetPasswordEmail from '@/utils/emails/resetPasswordEmail'
import { cpfSchema } from '@/utils/validations/cpf'

export async function requestPasswordRecover(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/password-recovery',
    {
      schema: {
        tags: ['employees'],
        summary: 'Requisita uma redefinição de senha',
        body: z.object({
          cpf: cpfSchema,
          email: z.email('E-mail inválido').trim(),
        }),
        response: {
          200: z.object({
            message: z.string(),
          }),
          400: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { cpf, email } = request.body

      const employee = await prisma.employees.findUnique({
        where: {
          cpf,
          email,
        },
        select: {
          id: true,
          name: true,
        },
      })

      if (!employee) {
        throw new BadRequestError('Credenciais inválidas. Verifique suas informações e tente novamente.')
      }

      await prisma.$transaction(async transaction => {
        const token = await transaction.tokens.create({
          data: {
            type: 'PASSWORD_RECOVER',
            employeeId: employee.id,
            code: generateRecoveryCode(),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutos
          },
        })

        const { error } = await resend.emails.send({
          from: '📧 Sala Livre <salalivre@hit.dev.br>',
          to: env.NODE_ENV === 'production' ? email : 'hilquiasfmelo@gmail.com',
          subject: '🔄 Redefinição de Senha - Sala Livre',
          react: ResetPasswordEmail({
            name: employee.name,
            code: token.code,
            link: `${env.WEB_URL}/employees/reset-password?code=${token.code}`,
          }),
        })

        if (error) {
          console.error({ err: error, email }, 'Falha ao enviar e-mail de redefinição de senha.')

          throw new BadRequestError('Falha ao enviar e-mail de redefinição de senha.')
        }

        // Somente em ambiente de desenvolvimento mostra no console
        if (env.NODE_ENV === 'dev') {
          console.log('> ✅ Email de redefinição de senha enviado com sucesso.', token.code)
        }
      })

      return reply.status(200).send({
        message: 'Email de redefinição de senha enviado com sucesso.',
      })
    }
  )
}
