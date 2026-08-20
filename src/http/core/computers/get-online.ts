import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { auth } from '@/http/middleware/auth'
import { computerConnections } from '@/http/websocket'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '../../../../generated/prisma/client'

const getOnlineComputersSchema = {
  tags: ['computers'],
  summary: 'Lista os computadores conectados ao canal /ws/computers: ADMIN vê todas as salas; MEMBER só as suas',
  security: [{ bearerAuth: [] }],
  params: z.object({
    roomId: z.cuid2().optional(),
  }),
  response: {
    200: z.object({
      computers: z.array(
        z.object({
          id: z.cuid2(),
          macCode: z.string(),
          roomId: z.cuid2(),
          /** Quando a estação entrou no canal. Reconexão zera: é a conexão atual, não o uptime do PC. */
          connectedAt: z.date(),
        })
      ),
    }),
  },
} satisfies FastifySchema

export async function getOnlineComputers(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/online/:roomId?',
      {
        schema: getOnlineComputersSchema,
      },
      async (request, reply) => {
        const { id: employeeId, role } = await request.getCurrentEmployee()
        const { roomId } = request.params

        // `connections.macCode` já vem normalizado por `formattedCodeMac`, igual ao gravado na coluna.
        const connectedAtByMacCode = new Map(computerConnections.list().map(({ macCode, connectedAt }) => [macCode, connectedAt]))

        // Sala vazia (ou API recém-reiniciada) é o caso comum fora do horário de atendimento: sem isto,
        // seria um `IN ()` a cada polling do painel.
        if (connectedAtByMacCode.size === 0) {
          return reply.status(200).send({ computers: [] })
        }

        // Mesmo escopo por papel das outras listagens de operação: ADMIN enxerga qualquer sala (ou
        // filtra por uma), MEMBER só as salas vinculadas a ele. Sala de fora simplesmente não retorna.
        const where: Prisma.ComputersWhereInput = {
          macCode: { in: [...connectedAtByMacCode.keys()] },
          roomId,
          ...(role !== 'ADMIN' && {
            room: {
              employeesRooms: {
                some: { employeeId },
              },
            },
          }),
        }

        const computers = await prisma.computers.findMany({
          where,
          select: {
            id: true,
            macCode: true,
            roomId: true,
          },
        })

        return reply.status(200).send({
          computers: computers.map(computer => ({
            ...computer,
            // O `where` saiu das chaves do mapa, então a conexão existe — o `?? new Date()` é só para
            // o tipo, e nunca deve valer nada na prática.
            connectedAt: connectedAtByMacCode.get(computer.macCode) ?? new Date(),
          })),
        })
      }
    )
}
