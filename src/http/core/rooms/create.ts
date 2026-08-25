import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import slugify from 'slugify'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import { ufSchema } from '@/utils/validations/uf'

const createRoomSchema = {
  tags: ['rooms'],
  summary: 'Cria uma sala',
  security: [{ bearerAuth: [] }],
  body: z.object({
    name: z.string().trim().nonempty('Nome obrigatório'),
    // Padrão no Zod, não no banco: o painel que ainda não manda o campo continua cadastrando
    // sala no Maranhão — que é onde estão todas — sem exigir deploy casado dos dois lados.
    uf: ufSchema.default('MA'),
    standardTime: z
      .number('Tempo padrão obrigatório')
      .int('Tempo padrão deve ser um inteiro')
      .positive('Tempo padrão deve ser positivo')
      .optional(),
    description: z.string().optional(),
  }),
  response: {
    201: z.object({
      roomId: z.cuid2(),
    }),
  },
} satisfies FastifySchema

export async function createRoom(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/create',
      {
        schema: createRoomSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { name, uf, standardTime, description } = request.body

        const uppercaseName = name.toUpperCase()

        const slug = slugify(name, { lower: true, strict: true })

        const roomWithSameSlug = await prisma.rooms.findUnique({
          where: {
            slug,
          },
        })

        if (roomWithSameSlug) {
          throw new BadRequestError('Sala com esse nome já cadastrada.')
        }

        const room = await prisma.rooms.create({
          data: {
            name: uppercaseName,
            slug,
            uf,
            standardTime,
            description,
          },
        })

        return reply.status(201).send({
          roomId: room.id,
        })
      }
    )
}
