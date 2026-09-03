import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { badRequestSchema } from '@/http/_errors/schemas/error-responses'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import { ensureNoActiveDownloadOfKind } from './helpers/ensure-single-active'

const activateDownloadSchema = {
  tags: ['downloads'],
  summary: 'Reativa um arquivo para download por ID',
  description:
    'Serve para voltar atrás: o link novo saiu quebrado e o anterior precisa valer de novo. Só passa ' +
    'se não houver outro ativo do mesmo tipo — inative o atual antes.',
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

export async function activateDownload(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch('/activate/:id', { schema: activateDownloadSchema }, async (request, reply) => {
      await request.checkIfEmployeeIsAdmin()

      const { id } = request.params

      const download = await prisma.downloads.findUnique({
        where: { id },
        select: { kind: true, inactive: true },
      })

      if (!download) {
        throw new NotFoundError('Download não encontrado.')
      }

      if (download.inactive === null) {
        throw new BadRequestError('Download já está ativo.')
      }

      // Ignorando o próprio registro: ele está inativo, então não apareceria na busca de qualquer
      // forma, mas passar o `id` deixa a intenção explícita e protege quem reordenar as guardas.
      await ensureNoActiveDownloadOfKind(download.kind, id)

      await prisma.downloads.update({
        where: { id },
        data: { inactive: null },
      })

      return reply.status(200).send({ message: 'Download reativado com sucesso.' })
    })
}
