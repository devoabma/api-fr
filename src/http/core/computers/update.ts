import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import { formattedCodeMac } from '@/utils'

const updateComputerSchema = {
  tags: ['computers'],
  summary: 'Atualiza um computador por ID',
  security: [{ bearerAuth: [] }],
  params: z.object({
    id: z.cuid2(),
  }),
  body: z.object({
    macCode: z.string().trim().optional(),
    number: z.number().int().positive().optional(),
    description: z.string().trim().optional(),
    roomId: z.cuid2().optional(),
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

export async function updateComputer(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/update/:id',
      {
        schema: updateComputerSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { id } = request.params
        const { macCode, number, description, roomId } = request.body

        const computer = await prisma.computers.findUnique({
          where: { id },
          select: { number: true, description: true, roomId: true },
        })

        if (!computer) {
          throw new NotFoundError('Computador não encontrado.')
        }

        const dataToUpdate: {
          macCode?: string
          number?: number
          description?: string
          roomId?: string
        } = {}

        // Sala/número/descrição efetivos: usa o valor novo quando enviado, senão o atual.
        const targetRoomId = roomId ?? computer.roomId

        if (macCode) {
          const formattedMacCode = formattedCodeMac(macCode)

          if (formattedMacCode.length !== 17) {
            throw new BadRequestError('Mac Code inválido. Padrão de 17 caracteres.')
          }

          const computerWithSameMacCode = await prisma.computers.findFirst({
            where: {
              id: { not: id },
              macCode: formattedMacCode,
            },
          })

          if (computerWithSameMacCode) {
            throw new BadRequestError('Já existe um computador cadastrado com este código MAC.')
          }

          dataToUpdate.macCode = formattedMacCode
        }

        if (roomId) {
          const room = await prisma.rooms.findUnique({
            where: {
              id: roomId,
            },
          })

          if (!room) {
            throw new NotFoundError('Sala informada não existe.')
          }

          dataToUpdate.roomId = roomId
        }

        // Revalida número quando o número ou a sala mudam (escopo: sala efetiva).
        if (number !== undefined || roomId) {
          const targetNumber = number ?? computer.number

          const computerWithSameNumber = await prisma.computers.findFirst({
            where: {
              number: targetNumber,
              roomId: targetRoomId,
              id: { not: id },
            },
          })

          if (computerWithSameNumber) {
            throw new BadRequestError('Já existe um computador com esse número nesta sala.')
          }

          if (number !== undefined) {
            dataToUpdate.number = number
          }
        }

        // Revalida descrição quando a descrição ou a sala mudam (escopo: sala efetiva).
        if (description !== undefined || roomId) {
          const targetDescription = description ? description.toUpperCase() : computer.description

          const computerWithSameDescription = await prisma.computers.findFirst({
            where: {
              description: targetDescription,
              roomId: targetRoomId,
              id: { not: id },
            },
          })

          if (computerWithSameDescription) {
            throw new BadRequestError('Já existe um computador com essa descrição nesta sala.')
          }

          if (description) {
            dataToUpdate.description = description.toUpperCase()
          }
        }

        await prisma.computers.update({
          where: { id },
          data: dataToUpdate,
        })

        return reply.status(200).send({ message: 'Computador atualizado com sucesso.' })
      }
    )
}
