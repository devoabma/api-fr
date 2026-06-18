import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import slugify from 'slugify'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const updateRoomSchema = {
  tags: ['rooms'],
  summary: 'Atualiza uma sala por ID',
  security: [{ bearerAuth: [] }],
  params: z.object({
    id: z.cuid2(),
  }),
  body: z.object({
    name: z.string().trim().optional(),
    standardTime: z
      .number('Tempo padrão obrigatório')
      .int('Tempo padrão deve ser um inteiro')
      .positive('Tempo padrão deve ser positivo')
      .optional(),
    description: z.string().optional(),
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
export async function updateRoom(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/update/:id',
      {
        schema: updateRoomSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { id } = request.params
        const { name, standardTime, description } = request.body

        const room = await prisma.rooms.findUnique({
          where: { id },
          select: { name: true },
        })

        if (!room) {
          throw new NotFoundError('Sala não encontrada.')
        }

        const dataToUpdate: {
          name?: string
          slug?: string
          standardTime?: number
          description?: string
        } = {
          ...(standardTime && { standardTime }),
          ...(description && { description }),
        }

        if (name) {
          const uppercaseName = name.toUpperCase()

          // Só recalcula e valida o slug se o nome realmente mudou
          if (uppercaseName !== room.name) {
            const slug = slugify(name, { lower: true, strict: true })

            const roomWithSameSlug = await prisma.rooms.findFirst({
              where: {
                slug,
                id: { not: id },
              },
            })

            if (roomWithSameSlug) {
              throw new BadRequestError('Sala com esse nome já cadastrada.')
            }

            dataToUpdate.name = uppercaseName
            dataToUpdate.slug = slug
          }
        }

        await prisma.rooms.update({
          where: { id },
          data: dataToUpdate,
        })

        return reply.status(200).send({
          message: 'Sala atualizada com sucesso.',
        })
      }
    )
}
