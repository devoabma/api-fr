import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const activateEmployeeSchema = {
  tags: ['employees'],
  summary: 'Ativa um funcionário por ID',
  security: [{ bearerAuth: [] }],
  params: z.object({
    id: z.cuid2(),
  }),
  response: {
    200: z.object({
      message: z.string(),
    }),
  },
} satisfies FastifySchema

export async function activateEmployee(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/activate/:id',
      {
        schema: activateEmployeeSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { id } = request.params

        const employee = await prisma.employees.findUnique({
          where: { id },
          select: { inactive: true },
        })

        if (!employee) {
          throw new NotFoundError('Funcionário não encontrado.')
        }

        if (!employee.inactive) {
          throw new BadRequestError('Funcionário já está ativo.')
        }

        await prisma.employees.update({
          where: { id },
          data: { inactive: null },
        })

        return reply.status(200).send({
          message: 'Funcionário ativado com sucesso.',
        })
      }
    )
}
