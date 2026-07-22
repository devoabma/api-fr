import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { auth } from '@/http/middleware/auth'
import { dayjs } from '@/lib/dayjs'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '../../../../generated/prisma/client'

const getAllReleasesSchema = {
  tags: ['lawyers'],
  summary:
    'Busca as sessões de liberação: ADMIN vê todas as salas (ou filtra por uma via roomId); MEMBER só vê as salas em que está vinculado',
  security: [{ bearerAuth: [] }],
  params: z.object({
    roomId: z.cuid2().optional(),
  }),
  querystring: z.object({
    lawyer: z.string().trim().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
  response: {
    200: z.array(
      z.object({
        id: z.cuid2(),
        startDate: z.date(),
        endDate: z.date().nullable(),
        lawyer: z.object({
          id: z.cuid2(),
          name: z.string(),
        }),
        room: z.object({
          id: z.cuid2(),
          name: z.string(),
          standardTime: z.number().int().nonnegative(),
        }),
        computer: z.object({
          id: z.cuid2(),
          description: z.string(),
        }),
        usedMinutes: z.number().int().nonnegative(),
        remainingMinutes: z.number().int().nonnegative(),
        usedAllTime: z.boolean(),
      })
    ),
  },
} satisfies FastifySchema

export async function getAllReleases(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/get-all-releases/:roomId?',
      {
        schema: getAllReleasesSchema,
      },
      async (request, reply) => {
        const { id: employeeId, role } = await request.getCurrentEmployee()
        const { roomId } = request.params
        const { lawyer, startDate, endDate } = request.query

        // ADMIN pode ver as sessões de qualquer sala (ou filtrar por uma via roomId).
        // MEMBER só pode ver as sessões das salas em que está vinculado — se passar
        // roomId de uma sala à qual não pertence, a busca simplesmente não retorna nada.
        const computerWhere: Prisma.ComputersWhereInput =
          role === 'ADMIN'
            ? { roomId }
            : {
                roomId,
                room: {
                  employeesRooms: {
                    some: { employeeId },
                  },
                },
              }

        const where: Prisma.ComputerSessionsWhereInput = {
          lawyer: lawyer
            ? {
                name: {
                  contains: lawyer,
                  mode: 'insensitive',
                },
              }
            : undefined,
          startedAt: {
            gte: startDate,
            lte: endDate,
          },
          computer: computerWhere,
        }

        const sessions = await prisma.computerSessions.findMany({
          where,
          select: {
            id: true,
            startedAt: true,
            endedAt: true,
            lawyer: {
              select: {
                id: true,
                name: true,
              },
            },
            computer: {
              select: {
                id: true,
                description: true,
                room: {
                  select: {
                    id: true,
                    name: true,
                    standardTime: true,
                  },
                },
              },
            },
          },
          orderBy: {
            startedAt: 'desc',
          },
        })

        const now = dayjs().tz()

        const releases = sessions.map(session => {
          const { standardTime } = session.computer.room

          // Tempo de USO desta sessão específica (não a cota diária global do advogado).
          // Sessão em andamento (endedAt null) usa o momento atual como referência.
          const usedMinutes = (session.endedAt ? dayjs(session.endedAt).tz() : now).diff(dayjs(session.startedAt).tz(), 'minute')
          const remainingMinutes = Math.max(standardTime - usedMinutes, 0)
          const usedAllTime = usedMinutes >= standardTime

          return {
            id: session.id,
            startDate: session.startedAt,
            endDate: session.endedAt,
            lawyer: session.lawyer,
            room: session.computer.room,
            computer: {
              id: session.computer.id,
              description: session.computer.description,
            },
            usedMinutes,
            remainingMinutes,
            usedAllTime,
          }
        })

        return reply.status(200).send(releases)
      }
    )
}
