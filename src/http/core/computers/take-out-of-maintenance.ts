import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const takeOutOfMaintenanceComputerSchema = {
  tags: ['computers'],
  summary: 'Retira um computador de manutenção por ID',
  security: [{ bearerAuth: [] }],
  params: z.object({
    id: z.cuid2(),
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

export async function takeOutOfMaintenanceComputer(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/maintenance/:id/remove',
      {
        schema: takeOutOfMaintenanceComputerSchema,
      },
      async (request, reply) => {
        const currentEmployeeId = await request.getIdCurrentEmployee()

        const { id } = request.params

        const employee = await prisma.employees.findUnique({
          where: { id: currentEmployeeId },
          select: { role: true },
        })

        if (!employee) {
          throw new NotFoundError('Funcionário não encontrado.')
        }

        // Manutenção é operação, não inventário: ADMIN retira qualquer máquina da manutenção;
        // Funcionário comum só as de salas vinculadas a ele.
        const computer = await prisma.computers.findUnique({
          where: {
            id,
            ...(employee.role !== 'ADMIN' && {
              room: {
                employeesRooms: {
                  some: { employeeId: currentEmployeeId },
                },
              },
            }),
          },
          select: {
            maintenance: true,
          },
        })

        if (!computer) {
          throw new NotFoundError('Computador não encontrado ou não pertence a uma sala vinculada a você.')
        }

        if (!computer.maintenance) {
          throw new BadRequestError('Computador não estava em manutenção.')
        }

        await prisma.computers.update({
          where: { id },
          data: { maintenance: null },
        })

        return reply.status(200).send({ message: 'Computador retirado da manutenção.' })
      }
    )
}
