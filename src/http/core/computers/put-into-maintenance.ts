import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const putIntoMaintenanceComputerSchema = {
  tags: ['computers'],
  summary: 'Coloca um computador em manutenção por ID',
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

export async function putIntoMaintenanceComputer(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/maintenance/:id',
      {
        schema: putIntoMaintenanceComputerSchema,
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

        // Manutenção é operação, não inventário: ADMIN coloca qualquer máquina em
        // manutenção; funcionário comum só as de salas vinculadas a ele.
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
          select: { maintenance: true, inUse: true },
        })

        if (!computer) {
          throw new NotFoundError('Computador não encontrado ou não pertence a uma sala vinculada a você.')
        }

        if (computer.maintenance) {
          throw new BadRequestError('Computador já está em manutenção.')
        }

        // Não derruba a sessão de um advogado silenciosamente: a sessão deve ser
        // encerrada antes de a máquina entrar em manutenção.
        if (computer.inUse) {
          throw new BadRequestError(
            'Computador em uso por um advogado. Encerre a sessão antes de colocá-lo em manutenção.'
          )
        }

        // Estado consistente: máquina em manutenção não fica disponível para uso e
        // não mantém vínculo com nenhum advogado.
        await prisma.computers.update({
          where: { id },
          data: {
            maintenance: new Date(),
            inUse: false,
            currentLawyerId: null,
          },
        })

        return reply.status(200).send({ message: 'Computador colocado em manutenção.' })
      }
    )
}
