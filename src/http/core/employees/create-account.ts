import { hash } from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { env } from '@/http/env'
import { prisma } from '@/lib/prisma'
import { resend } from '@/lib/resend'
import SendEmailEmployeeSignUp from '@/utils/emails/sendEmailEmployeeSignUp'
import { cpfSchema } from '@/utils/validations/cpf'

export async function createAccount(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/create-account',
    {
      schema: {
        tags: ['employees'],
        summary: 'Cria um novo funcionário',
        body: z.object({
          name: z.string().trim().nonempty('Nome obrigatório'),
          cpf: cpfSchema,
          email: z.email('E-mail inválido').trim(),
          password: z.string('Senha obrigatória').trim().min(8, 'Senha mínimo de 8 caracteres'),
        }),
        response: {
          201: z.object({
            message: z.string(),
          }),
          400: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, cpf, email, password } = request.body

      const [employeeWithSameCpf, employeeWithSameEmail] = await Promise.all([
        prisma.employees.findUnique({ where: { cpf }, select: { id: true } }),
        prisma.employees.findUnique({ where: { email }, select: { id: true } }),
      ])

      if (employeeWithSameCpf) {
        return reply.status(400).send({
          message: 'Já existe um funcionário cadastrado com o mesmo CPF.',
        })
      }

      if (employeeWithSameEmail) {
        return reply.status(400).send({
          message: 'Já existe um funcionário cadastrado com o mesmo e-mail.',
        })
      }

      const passwordHash = await hash(password, 8)

      try {
        await prisma.$transaction(async transaction => {
          await transaction.employees.create({
            data: {
              name,
              cpf,
              email,
              passwordHash,
            },
          })

          // Envia o e-mail dentro da transação: se o envio falhar, o cadastro do funcionário sofre rollback.
          const { error } = await resend.emails.send({
            from: '📧 Sala Livre <nao-responda@hit.dev.br>',
            to: env.NODE_ENV === 'production' ? email : 'hilquiasfmelo@gmail.com',
            subject: '🎉 Bem-vindo à equipe! Aqui estão suas informações.',
            react: SendEmailEmployeeSignUp({
              name,
              cpf,
              email,
              tempPassword: password,
              link: `${env.WEB_URL}/sign-in`,
            }),
          })

          if (error) {
            throw new Error(error.message)
          }
        })
      } catch (err) {
        console.error({ err })
        return reply.status(400).send({
          message: 'Não foi possível enviar o e-mail de boas-vindas. O funcionário não foi cadastrado, tente novamente.',
        })
      }

      return reply.status(201).send({
        message: 'Funcionário criado com sucesso!',
      })
    }
  )
}
