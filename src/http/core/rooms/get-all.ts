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
          uf: z.string(),
          standardTime: z.number(),
          description: z.string().nullable(),
          inactive: z.date().nullable(),
          createdAt: z.date(),
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
              /** Última versão do Desktop informada pela estação. `null` = ela nunca informou. */
              appVersion: z.string().nullable(),
              /**
               * Quando a estação informou a versão — não quando esteve online pela última vez.
               * Ela só se apresenta ao conectar, então uma máquina semanas no ar mantém um
               * carimbo antigo. Quem está conectado agora é `GET /computers/online/:roomId?`.
               */
              appVersionReportedAt: z.date().nullable(),
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
          uf: true,
          standardTime: true,
          description: true,
          inactive: true,
          createdAt: true,
          employeesRooms: {
            // Desligar funcionário é soft delete: o vínculo continua na tabela de junção. Sem este
            // filtro, quem saiu da OAB seguiria listado como equipe da sala no painel.
            where: { employees: { inactive: null } },
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
              appVersion: true,
              appVersionReportedAt: true,
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
