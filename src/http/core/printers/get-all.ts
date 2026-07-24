import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '../../../../generated/prisma/client'

const getAllPrintersSchema = {
  tags: ['printers'],
  summary: 'Busca impressões por permissão: ADMIN todas (ou por sala); MEMBER apenas vinculadas',
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
    200: z.object({
      printers: z.array(
        z.object({
          id: z.cuid2(),
          fileUrl: z.url(),
          createdAt: z.date(),
          lawyer: z.object({
            id: z.cuid2(),
            name: z.string(),
          }),
          room: z.object({
            id: z.cuid2(),
            name: z.string(),
          }),
          computer: z.object({
            id: z.cuid2(),
            description: z.string(),
          }),
        })
      ),
    }),
  },
} satisfies FastifySchema

export async function getAllPrinters(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/get-all/:roomId?',
      {
        schema: getAllPrintersSchema,
      },
      async (request, reply) => {
        const { id: employeeId, role } = await request.getCurrentEmployee()
        const { roomId } = request.params
        const { lawyer, startDate, endDate } = request.query

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

        const where: Prisma.PrintersWhereInput = {
          lawyer: lawyer
            ? {
                name: {
                  contains: lawyer,
                  mode: 'insensitive',
                },
              }
            : undefined,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          computer: computerWhere,
        }

        const printers = await prisma.printers.findMany({
          where,
          select: {
            id: true,
            fileUrl: true,
            createdAt: true,
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
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        return reply.status(200).send({
          printers: printers.map(printer => ({
            id: printer.id,
            fileUrl: printer.fileUrl,
            createdAt: printer.createdAt,
            lawyer: printer.lawyer,
            room: printer.computer.room,
            computer: {
              id: printer.computer.id,
              description: printer.computer.description,
            },
          })),
        })
      }
    )
}
