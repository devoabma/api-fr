import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const getAllRoomsSchema = {
  tags: ['rooms'],
  summary: 'Recupera todas as salas cadastradas',
  security: [{ bearerAuth: [] }],
  response: {
    200: z.object({
      rooms: z.array(
        z.object({
          id: z.cuid2(),
          name: z.string(),
          standardTime: z.number(),
          description: z.string().nullable(),
          inactive: z.date().nullable(),
          computers: z.array(
            z.object({
              id: z.cuid2(),
              macCode: z.string(),
              number: z.number(),
              description: z.string(),
            })
          ),
        })
      ),
    }),
  },
} satisfies FastifySchema

export async function getAllRooms(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get('/get-all', { schema: getAllRoomsSchema }, async (request, reply) => {
      await request.checkIfEmployeeIsAdmin()

      const rooms = await prisma.rooms.findMany({
        select: {
          id: true,
          name: true,
          standardTime: true,
          description: true,
          inactive: true,
          computers: {
            select: {
              id: true,
              macCode: true,
              number: true,
              description: true,
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
