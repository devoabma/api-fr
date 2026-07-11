import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '../../../../generated/prisma/client'

const getAllRoomsSchema = {
  tags: ['rooms'],
  summary: 'Lista as salas de acordo com o papel: ADMIN vê todas; MEMBER vê apenas as que participa',
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
          employeesRooms: z.array(
            z.object({
              employees: z.object({
                id: z.cuid2(),
                name: z.string(),
                imageUrl: z.url().nullable(),
              }),
            })
          ),
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

export async function getAllRooms(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get('/get-all', { schema: getAllRoomsSchema }, async (request, reply) => {
      const { id: employeeId, role } = await request.getCurrentEmployee()

      // ADMIN enxerga o inventário completo (inclusive salas inativas).
      // MEMBER enxerga somente as salas ATIVAS em que está vinculado.
      const where: Prisma.RoomsWhereInput =
        role === 'ADMIN'
          ? {}
          : {
              inactive: null,
              // some => pelo menos um vínculo em employeesRooms aponta para este funcionário
              employeesRooms: {
                some: { employeeId },
              },
            }

      const rooms = await prisma.rooms.findMany({
        where,
        select: {
          id: true,
          name: true,
          standardTime: true,
          description: true,
          inactive: true,
          employeesRooms: {
            select: {
              employees: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                },
              },
            },
          },
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
