import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import { cpfSchema } from '@/utils/validations/cpf'

const getAllEmployeesSchema = {
  tags: ['employees'],
  summary: 'Recupera todos os funcionários cadastrados',
  security: [{ bearerAuth: [] }],
  response: {
    200: z.object({
      employees: z.array(
        z.object({
          id: z.cuid2(),
          name: z.string(),
          cpf: cpfSchema,
          email: z.email(),
          imageUrl: z.string().nullable(),
          role: z.enum(['MEMBER', 'ADMIN']),
          inactive: z.date().nullable(),
        })
      ),
    }),
  },
} satisfies FastifySchema

export async function getAllEmployees(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/get-all',
      {
        schema: getAllEmployeesSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const employees = await prisma.employees.findMany({
          select: {
            id: true,
            name: true,
            cpf: true,
            email: true,
            imageUrl: true,
            role: true,
            inactive: true,
          },
        })

        return reply.status(200).send({ employees })
      }
    )
}
