import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const deleteComputerSchema = {
  tags: ['computers'],
  summary: 'Deleta um computador por ID',
  security: [{ bearerAuth: [] }],
  params: z.object({
    id: z.cuid2(),
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

export async function deleteComputer(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete(
      '/delete/:id',
      {
        schema: deleteComputerSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { id } = request.params

        const computer = await prisma.computers.findUnique({
          where: { id },
          select: { inUse: true },
        })

        if (!computer) {
          throw new NotFoundError('Computador não encontrado.')
        }

        // Não derruba a sessão de um advogado silenciosamente: a sessão deve ser
        // encerrada antes de o computador ser removido do inventário.
        if (computer.inUse) {
          throw new BadRequestError('Computador em uso por um advogado. Encerre a sessão antes de deletá-lo.')
        }

        // Histórico de sessões é removido em cascata (onDelete: Cascade no schema).
        await prisma.computers.delete({
          where: { id },
        })

        return reply.status(200).send({ message: 'Computador deletado com sucesso.' })
      }
    )
}
