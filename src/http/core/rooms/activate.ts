import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const activateRoomSchema = {
  tags: ['rooms'],
  summary: 'Ativar uma sala por ID',
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

export async function activateRoom(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch('/activate/:id', { schema: activateRoomSchema }, async (request, reply) => {
      await request.checkIfEmployeeIsAdmin()

      const { id } = request.params

      const room = await prisma.rooms.findUnique({
        where: { id },
        select: { inactive: true },
      })

      if (!room) {
        throw new NotFoundError('Sala nao encontrada.')
      }

      if (!room.inactive) {
        throw new BadRequestError('Sala já está ativa.')
      }

      await prisma.rooms.update({
        where: { id },
        data: { inactive: null },
      })

      return reply.status(200).send({ message: 'Sala ativada com sucesso.' })
    })
}
