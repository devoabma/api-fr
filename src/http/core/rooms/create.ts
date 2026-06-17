import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import slugify from 'slugify'
import { z } from 'zod'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const createRoomSchema = {
  tags: ['rooms'],
  summary: 'Cria uma sala',
  security: [{ bearerAuth: [] }],
  body: z.object({
    name: z.string().trim().nonempty('Nome obrigatório'),
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

        const { name, standardTime, description } = request.body

        const uppercaseName = name.toUpperCase()

        const rawSlug = slugify(name, { lower: true, strict: true })

        const slugCount = await prisma.rooms.count({
          where: {
            slug: {
              startsWith: rawSlug,
            },
          },
        })

        const slug = slugCount > 0 ? `${rawSlug}-${slugCount + 1}` : rawSlug

        const room = await prisma.rooms.create({
          data: {
            name: uppercaseName,
            slug,
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
