import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import { formattedCodeMac } from '@/utils'

const createComputerSchema = {
  tags: ['computers'],
  summary: 'Cria um computador',
  security: [{ bearerAuth: [] }],
  body: z.object({
    macCode: z.string().trim().nonempty('Mac Code obrigatório'),
    number: z.number('Número obrigatório').int('Número deve ser um inteiro').positive('Número deve ser positivo'),
    description: z.string().trim().nonempty('Descrição obrigatória'),
    roomId: z.cuid2('Sala obrigatória'),
  }),
  response: {
    201: z.object({
      macCode: z.string(),
    }),
    400: z.object({
      message: z.string(),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
} satisfies FastifySchema
export async function createComputer(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/create',
      {
        schema: createComputerSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { macCode, number, description, roomId } = request.body

        const uppercaseDescription = description.toUpperCase()

        const formattedMacCode = formattedCodeMac(macCode)

        if (formattedMacCode.length !== 17) {
          throw new BadRequestError('Mac Code inválido. Padrão de 17 caracteres.')
        }

        const computerWithSameMacCode = await prisma.computers.findUnique({
          where: {
            macCode: formattedMacCode,
          },
        })

        if (computerWithSameMacCode) {
          throw new BadRequestError('Já existe um computador cadastrado com este código MAC.')
        }

        const room = await prisma.rooms.findUnique({
          where: {
            id: roomId,
          },
        })

        if (!room) {
          throw new NotFoundError('Sala informada não existe.')
        }

        const computerWithSameNumber = await prisma.computers.findFirst({
          where: {
            number,
            roomId,
          },
        })

        if (computerWithSameNumber) {
          throw new BadRequestError('Já existe um computador com esse número nesta sala.')
        }

        const computerWithSameDescription = await prisma.computers.findFirst({
          where: {
            description: uppercaseDescription,
            roomId,
          },
        })

        if (computerWithSameDescription) {
          throw new BadRequestError('Já existe um computador com essa descrição nesta sala.')
        }

        const computer = await prisma.computers.create({
          data: {
            macCode: formattedMacCode,
            number,
            description: uppercaseDescription,
            roomId,
          },
        })

        return reply.status(201).send({ macCode: computer.macCode })
      }
    )
}
