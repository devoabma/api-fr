import dayjs from 'dayjs'
import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const deactivateRoomSchema = {
  tags: ['rooms'],
  summary: 'Inativa uma sala por ID',
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

export async function deactivateRoom(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch('/deactivate/:id', { schema: deactivateRoomSchema }, async (request, reply) => {
      await request.checkIfEmployeeIsAdmin()

      const today = dayjs().toDate()

      const { id } = request.params

      const room = await prisma.rooms.findUnique({
        where: { id },
        select: { inactive: true },
      })

      if (!room) {
        throw new NotFoundError('Sala nao encontrada.')
      }

      if (room.inactive !== null) {
        throw new BadRequestError('Sala já está inativa.')
      }

      await prisma.rooms.update({
        where: { id },
        data: { inactive: today },
      })

      return reply.status(200).send({ message: 'Sala inativada com sucesso.' })
    })
}
