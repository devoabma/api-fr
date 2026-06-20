import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const unlinkWithRoomsSchema = {
  tags: ['employees'],
  summary: 'Desvincula um funcionário de uma ou mais salas',
  security: [{ bearerAuth: [] }],
  body: z.object({
    employeeId: z.cuid2(),
    roomIds: z.array(z.cuid2()).min(1, 'Informe ao menos uma sala.'),
  }),
  response: {
    200: z.object({
      message: z.string(),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
} satisfies FastifySchema

export async function unlinkWithRooms(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/unlink-with-rooms',
      {
        schema: unlinkWithRoomsSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { employeeId } = request.body

        const roomIds = [...new Set(request.body.roomIds)]

        const employee = await prisma.employees.findUnique({
          where: { id: employeeId },
          select: { id: true },
        })

        if (!employee) {
          throw new NotFoundError('Funcionário não encontrado.')
        }

        const { count } = await prisma.employeesRooms.deleteMany({
          where: { employeeId, roomId: { in: roomIds } },
        })

        if (count === 0) {
          throw new NotFoundError('Nenhum vínculo encontrado entre o funcionário e a(s) sala(s) informada(s).')
        }

        return reply.status(200).send({
          message: 'Vínculos removidos com sucesso.',
        })
      }
    )
}
