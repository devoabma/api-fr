import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import { cpfSchema } from '@/utils/validations/cpf'

export async function getProfile(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/profile',
      {
        schema: {
          tags: ['employees'],
          summary: 'Recupera o perfil do funcionário autenticado',
          security: [{ bearerAuth: [] }],
          response: {
            200: z.object({
              employee: z.object({
                id: z.cuid2(),
                name: z.string(),
                cpf: cpfSchema,
                email: z.email(),
                imageUrl: z.string().nullable(),
                role: z.enum(['MEMBER', 'ADMIN']),
              }),
            }),
          },
        },
      },
      async (request, reply) => {
        const employeeId = await request.getIdCurrentEmployee()

        const employee = await prisma.employees.findUnique({
          where: {
            id: employeeId,
          },
          select: {
            id: true,
            name: true,
            cpf: true,
            email: true,
            imageUrl: true,
            role: true,
          },
        })

        if (!employee) {
          throw new NotFoundError('Funcionário não encontrado.')
        }

        return reply.status(200).send({ employee })
      }
    )
}
