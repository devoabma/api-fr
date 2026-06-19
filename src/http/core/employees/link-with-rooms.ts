import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const linkWithRoomsSchema = {
  tags: ['employees'],
  summary: 'Vincula um funcionário a uma ou mais salas',
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
    400: z.object({
      message: z.string(),
    }),
  },
} satisfies FastifySchema

export async function linkWithRooms(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post('/link-with-rooms', { schema: linkWithRoomsSchema }, async (request, reply) => {
      await request.checkIfEmployeeIsAdmin()

      const { employeeId } = request.body

      // Remove IDs repetidos do payload (ex.: [A, A] viraria [A]).
      // Sem isso, ids duplicados quebrariam a checagem "rooms.length !== roomIds.length" com erro enganoso.
      const roomIds = [...new Set(request.body.roomIds)]

      const [employee, rooms] = await Promise.all([
        prisma.employees.findUnique({
          where: { id: employeeId },
          select: { id: true },
        }),
        prisma.rooms.findMany({
          where: { id: { in: roomIds } },
          select: { id: true, name: true, inactive: true },
        }),
      ])

      if (!employee) {
        throw new NotFoundError('Funcionário não encontrado.')
      }

      // Verificar se todas as salas solicitadas foram encontradas
      if (rooms.length !== roomIds.length) {
        throw new BadRequestError('Uma ou mais salas não foram encontradas.')
      }

      // Verificar se alguma sala está inativa
      const inactiveRooms = rooms.filter(room => room.inactive)

      if (!!inactiveRooms.length) {
        const inactiveRoomsNames = inactiveRooms.map(room => room.name).join(', ')
        throw new BadRequestError(`As salas ${inactiveRoomsNames} estão inativas.`)
      }

      // Verificar vinculações existentes para evitar duplicação
      const existingLinks = await prisma.employeesRooms.findMany({
        where: {
          employeeId,
          roomId: { in: roomIds },
        },
        select: {
          roomId: true,
        },
      })

      if (!!existingLinks.length) {
        const existingRoomsNames = rooms
          .filter(room => existingLinks.some(existingLink => existingLink.roomId === room.id))
          .map(room => room.name)
          .join(', ')

        throw new BadRequestError(`As salas ${existingRoomsNames} já foram vinculadas ao funcionário.`)
      }

      // Cria todos os vínculos em um único INSERT (atômico por natureza).
      // skipDuplicates + o @@unique([employeeId, roomId]) do schema garantem idempotência
      // (mesmo numa corrida entre requisições, não estoura erro de duplicidade).
      await prisma.employeesRooms.createMany({
        data: roomIds.map(roomId => ({ employeeId, roomId })),
        skipDuplicates: true,
      })

      return reply
        .status(200)
        .send({ message: `${rooms.length > 1 ? 'Vinculações criadas com sucesso.' : 'Vinculação criada com sucesso.'}` })
    })
}
