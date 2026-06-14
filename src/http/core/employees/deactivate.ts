import dayjs from 'dayjs'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

export async function deactivateEmployee(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/deactivate/:id',
      {
        schema: {
          tags: ['employees'],
          summary: 'Inativa um funcionário por ID',
          security: [{ bearerAuth: [] }],
          params: z.object({
            id: z.cuid2(),
          }),
          response: {
            200: z.object({
              message: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const today = dayjs().toDate()

        const { id } = request.params

        const employee = await prisma.employees.findUnique({
          where: { id },
          select: { inactive: true },
        })

        if (!employee) {
          throw new NotFoundError('Funcionário não encontrado.')
        }

        if (employee.inactive) {
          throw new BadRequestError('Funcionário já está inativo.')
        }

        const currentEmployeeId = await request.getIdCurrentEmployee()

        if (id === currentEmployeeId) {
          throw new BadRequestError('Não é possível inativar o seu próprio cadastro.')
        }

        await prisma.employees.update({
          where: { id },
          data: { inactive: today },
        })

        return reply.status(200).send({
          message: 'Funcionário inativado com sucesso.',
        })
      }
    )
}
