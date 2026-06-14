import { hash } from 'bcryptjs'
import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { env } from '@/http/env'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import { resend } from '@/lib/resend'
import SendEmailEmployeeSignUp from '@/utils/emails/sendEmailEmployeeSignUp'
import { cpfSchema } from '@/utils/validations/cpf'

const createAccountSchema = {
  tags: ['employees'],
  summary: 'Cria um novo funcionário',
  security: [{ bearerAuth: [] }],
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
} satisfies FastifySchema

export async function createAccount(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/create-account',
      {
        schema: createAccountSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { name, cpf, email, password } = request.body

        const [employeeWithSameCpf, employeeWithSameEmail] = await Promise.all([
          prisma.employees.findUnique({ where: { cpf }, select: { id: true } }),
          prisma.employees.findUnique({ where: { email }, select: { id: true } }),
        ])

        if (employeeWithSameCpf) {
          throw new BadRequestError('Já existe um funcionário cadastrado com esse CPF.')
        }

        if (employeeWithSameEmail) {
          throw new BadRequestError('Já existe um funcionário cadastrado com esse e-mail.')
        }

        const passwordHash = await hash(password, 8)

        await prisma.employees.create({
          data: {
            name,
            cpf,
            email,
            passwordHash,
          },
        })

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
          console.error({ err: error, email }, 'Falha ao enviar e-mail de boas-vindas.')
        }

        return reply.status(201).send({
          message: 'Funcionário criado com sucesso!',
        })
      }
    )
}
