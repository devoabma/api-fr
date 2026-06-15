import { compare, hash } from 'bcryptjs'
import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { badRequestSchema } from '@/http/_errors/schemas/error-responses'
import { env } from '@/http/env'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import { resend } from '@/lib/resend'
import SendConfirmationChangedPassword from '@/utils/emails/sendConfirmationChangedPassword'

const changePasswordSchema = {
  tags: ['employees'],
  summary: 'Altera a senha do funcionário autenticado',
  security: [{ bearerAuth: [] }],
  body: z
    .object({
      currentPassword: z.string('Senha obrigatória').trim().min(8, 'Senha mínima de 8 caracteres'),
      newPassword: z.string('Senha obrigatória').trim().min(8, 'Senha mínima de 8 caracteres'),
      confirmNewPassword: z.string('Confirmação de senha obrigatória').trim().min(8, 'Senha mínima de 8 caracteres'),
    })
    .refine(data => data.newPassword === data.confirmNewPassword, {
      message: 'As senhas devem ser iguais.',
      path: ['confirmNewPassword'],
    }),
  response: {
    200: z.object({
      message: z.string(),
    }),
    400: badRequestSchema,
  },
} satisfies FastifySchema

export async function changePassword(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch('/change-password', { schema: changePasswordSchema }, async (request, reply) => {
      const employeeId = await request.getIdCurrentEmployee()

      const { currentPassword, newPassword } = request.body

      const employee = await prisma.employees.findUnique({
        where: {
          id: employeeId,
        },
        select: {
          name: true,
          email: true,
          passwordHash: true,
        },
      })

      if (!employee) {
        throw new BadRequestError('Funcionário nao encontrado.')
      }

      const isPasswordCorrect = await compare(currentPassword, employee.passwordHash)

      if (!isPasswordCorrect) {
        throw new BadRequestError('Senha atual incorreta. Por favor, tente novamente.')
      }

      if (newPassword === currentPassword) {
        throw new BadRequestError('A nova senha deve ser diferente da senha atual.')
      }

      const newPasswordHash = await hash(newPassword, 8)

      await prisma.employees.update({
        where: {
          id: employeeId,
        },
        data: {
          passwordHash: newPasswordHash,
        },
      })

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
        message: 'Senha alterada com sucesso.',
      })
    })
}
