import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { dayjs } from '@/lib/dayjs'
import { prisma } from '@/lib/prisma'
import { getDailyQuota } from './helpers/daily-quota'

const closeSessionSchema = {
  tags: ['lawyers'],
  summary: 'Encerra a sessão do advogado(a)',
  params: z.object({
    sessionId: z.cuid2().trim().nonempty('Session ID obrigatório'),
  }),
  response: {
    200: z.object({
      message: z.string(),
      remainingTime: z.number().int().nonnegative(),
    }),
    400: z.object({
      message: z.string(),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
} satisfies FastifySchema

export async function closeSession(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/close-computer/:sessionId',
    {
      schema: closeSessionSchema,
    },
    async (request, reply) => {
      const { sessionId } = request.params

      const session = await prisma.computerSessions.findUnique({
        where: {
          id: sessionId,
        },
        select: {
          startedAt: true,
          endedAt: true,
          computerId: true,
          lawyerId: true,
          computer: {
            select: {
              room: {
                select: {
                  standardTime: true,
                },
              },
            },
          },
        },
      })

      if (!session) {
        throw new BadRequestError('Nenhuma sessão ativa foi encontrada com o ID fornecido.')
      }

      if (session.endedAt) {
        throw new BadRequestError('Esta sessão já foi encerrada e não pode ser utilizada novamente.')
      }

      const now = dayjs().tz()

      // Cota diária GLOBAL (mesmo modelo do release-computer): considera as sessões já
      // finalizadas hoje e soma o tempo desta sessão que está sendo encerrada agora.
      const { dailyLimitMinutes, usedMinutes } = await getDailyQuota(session.lawyerId, session.computer.room.standardTime)

      const currentUsedMinutes = now.diff(dayjs(session.startedAt).tz(), 'minute')
      const remainingTime = Math.max(dailyLimitMinutes - (usedMinutes + currentUsedMinutes), 0)

      await prisma.$transaction([
        prisma.computerSessions.update({
          where: {
            id: sessionId,
          },
          data: {
            endedAt: now.toDate(),
          },
        }),
        prisma.computers.update({
          where: {
            id: session.computerId,
          },
          data: {
            inUse: false,
            currentLawyerId: null,
          },
        }),
        prisma.lawyers.update({
          where: {
            id: session.lawyerId,
          },
          data: {
            lastAccess: now.toDate(),
            remainingTime,
          },
        }),
      ])

      return reply.status(200).send({
        message: 'Sessão encerrada com sucesso.',
        remainingTime,
      })
    }
  )
}
