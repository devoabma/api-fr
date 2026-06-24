import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const getAllComputersSchema = {
  tags: ['computers'],
  summary: 'Recupera todos os computadores por sala e/ou descricão',
  security: [{ bearerAuth: [] }],
  querystring: z.object({
    roomId: z.cuid2().optional(),
    description: z.string().optional(),
  }),
  response: {
    200: z.object({
      computers: z.array(
        z.object({
          id: z.cuid2(),
          macCode: z.string(),
          number: z.number(),
          description: z.string(),
          inUse: z.boolean(),
          maintenance: z.date().nullable(),
          room: z.object({
            id: z.cuid2(),
            name: z.string(),
          }),
        })
      ),
    }),
  },
} satisfies FastifySchema

export async function getAllComputers(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/get-all',
      {
        schema: getAllComputersSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { roomId, description } = request.query

        const computers = await prisma.computers.findMany({
          where: {
            roomId,
            description: {
              contains: description,
              mode: 'insensitive',
            },
          },
          select: {
            id: true,
            macCode: true,
            number: true,
            description: true,
            inUse: true,
            maintenance: true,
            room: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        return reply.status(200).send({ computers })
      }
    )
}
