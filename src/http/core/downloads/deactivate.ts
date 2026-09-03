import dayjs from 'dayjs'
import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { badRequestSchema } from '@/http/_errors/schemas/error-responses'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'

const deactivateDownloadSchema = {
  tags: ['downloads'],
  summary: 'Inativa um arquivo para download por ID',
  description:
    'Inativar não apaga: o registro sai da lista do funcionário e continua no banco, respondendo ' +
    'para onde aquele link apontava. É também o passo obrigatório antes de cadastrar outro do mesmo tipo.',
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
    400: badRequestSchema,
  },
} satisfies FastifySchema

export async function deactivateDownload(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch('/deactivate/:id', { schema: deactivateDownloadSchema }, async (request, reply) => {
      await request.checkIfEmployeeIsAdmin()

      const today = dayjs().toDate()

      const { id } = request.params

      const download = await prisma.downloads.findUnique({
        where: { id },
        select: { inactive: true },
      })

      if (!download) {
        throw new NotFoundError('Download não encontrado.')
      }

      if (download.inactive !== null) {
        throw new BadRequestError('Download já está inativo.')
      }

      await prisma.downloads.update({
        where: { id },
        data: { inactive: today },
      })

      return reply.status(200).send({ message: 'Download inativado com sucesso.' })
    })
}
