import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const getMemberRoomsSchema = {
  tags: ['rooms'],
  summary: 'Recupera as salas em que o funcionário está vinculado',
  security: [{ bearerAuth: [] }],
  response: {
    200: z.object({
      rooms: z.array(
        z.object({
          id: z.cuid2(),
          name: z.string(),
          standardTime: z.number(),
          description: z.string().nullable(),
          computers: z.array(
            z.object({
              id: z.cuid2(),
              macCode: z.string(),
              number: z.number(),
              description: z.string(),
              inUse: z.boolean(),
              maintenance: z.date().nullable(),
            })
          ),
        })
      ),
    }),
  },
} satisfies FastifySchema

export async function getMemberRooms(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get('/get-member-rooms', { schema: getMemberRoomsSchema }, async (request, reply) => {
      const employeeId = await request.getIdCurrentEmployee()

      const rooms = await prisma.rooms.findMany({
        where: {
          employeesRooms: {
            // some => significa que pelo menos um item de employeesRooms tem employeeId
            some: {
              employeeId,
            },
          },
          inactive: null,
        },
        select: {
          id: true,
          name: true,
          standardTime: true,
          description: true,
          computers: {
            select: {
              id: true,
              macCode: true,
              number: true,
              description: true,
              inUse: true,
              maintenance: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return reply.status(200).send({ rooms })
    })
}
