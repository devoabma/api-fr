import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { badRequestSchema } from '@/http/_errors/schemas/error-responses'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import { downloadUrlSchema } from '@/utils/validations/download-url'
import { ensureNoActiveDownloadOfKind } from './helpers/ensure-single-active'

const createDownloadSchema = {
  tags: ['downloads'],
  summary: 'Cadastra um arquivo para download (instalador ou desinstalador)',
  security: [{ bearerAuth: [] }],
  body: z.object({
    kind: z.enum(['INSTALLER', 'UNINSTALLER'], 'Tipo inválido. Use INSTALLER ou UNINSTALLER.'),
    name: z.string().trim().nonempty('Nome obrigatório').max(80, 'Nome deve ter no máximo 80 caracteres'),
    url: downloadUrlSchema,
    description: z.string().trim().optional(),
    version: z.string().trim().max(40, 'Versão deve ter no máximo 40 caracteres').optional(),
  }),
  response: {
    201: z.object({
      downloadId: z.cuid2(),
    }),
    400: badRequestSchema,
  },
} satisfies FastifySchema

export async function createDownload(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/create',
      {
        schema: createDownloadSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { kind, name, url, description, version } = request.body

        // Antes de gravar, e não depois: cadastrar e só então reclamar deixaria o registro órfão
        // na tabela, ativo, exatamente a duplicidade que a regra existe para impedir.
        await ensureNoActiveDownloadOfKind(kind)

        const download = await prisma.downloads.create({
          data: { kind, name, url, description, version },
        })

        return reply.status(201).send({ downloadId: download.id })
      }
    )
}
