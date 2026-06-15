import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const updateEmployeeSchema = {
  tags: ['employees'],
  summary: 'Atualiza um funcionário por ID',
  security: [{ bearerAuth: [] }],
  params: z.object({
    id: z.cuid2(),
  }),
  body: z.object({
    name: z.string().trim().optional(),
    email: z.email('E-mail inválido').trim().optional(),
    role: z.enum(['MEMBER', 'ADMIN']).optional(),
  }),
  response: {
    200: z.object({
      message: z.string(),
    }),
    404: z.object({
      message: z.string(),
    }),
    400: z.object({
      message: z.string(),
    }),
  },
} satisfies FastifySchema

export async function updateEmployee(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put(
      '/update/:id',
      {
        schema: updateEmployeeSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { id } = request.params
        const { name, email, role } = request.body

        const employee = await prisma.employees.findUnique({
          where: { id },
          select: { email: true },
        })

        if (!employee) {
          throw new NotFoundError('Funcionário não encontrado.')
        }

        if (email && email !== employee.email) {
          const emailAlreadyExists = await prisma.employees.findUnique({
            where: {
              email,
            },
            select: {
              email: true,
            },
          })

          if (emailAlreadyExists) {
            throw new BadRequestError('Já existe um funcionário com esse e-mail.')
          }
        }

        // Verifica se algum campo foi informado e atualiza apenas aqueles que foram informados
        const dataToUpdate = {
          ...(name && { name }),
          ...(email && { email }),
          ...(role && { role }),
        }

        await prisma.employees.update({
          where: { id },
          data: dataToUpdate,
        })

        return reply.status(200).send({
          message: 'Funcionário atualizado com sucesso.',
        })
      }
    )
}
