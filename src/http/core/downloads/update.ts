import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { NotFoundError } from '@/http/_errors/not-found'
import { badRequestSchema } from '@/http/_errors/schemas/error-responses'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import { downloadUrlSchema } from '@/utils/validations/download-url'

const updateDownloadSchema = {
  tags: ['downloads'],
  summary: 'Atualiza um arquivo para download por ID',
  description:
    'O `kind` não é editável: trocar o tipo de um registro é, na prática, cadastrar outro — e obrigaria ' +
    'a repetir aqui a checagem de "um ativo por tipo". Para mudar de tipo, inative este e cadastre o novo.',
  security: [{ bearerAuth: [] }],
  params: z.object({
    id: z.cuid2(),
  }),
  body: z.object({
    name: z.string().trim().nonempty('Nome obrigatório').max(80, 'Nome deve ter no máximo 80 caracteres').optional(),
    url: downloadUrlSchema.optional(),
    description: z.string().trim().nullable().optional(),
    version: z.string().trim().max(40, 'Versão deve ter no máximo 40 caracteres').nullable().optional(),
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

export async function updateDownload(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/update/:id',
      {
        schema: updateDownloadSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { id } = request.params
        const { name, url, description, version } = request.body

        const download = await prisma.downloads.findUnique({
          where: { id },
          select: { id: true },
        })

        if (!download) {
          throw new NotFoundError('Download não encontrado.')
        }

        const dataToUpdate: {
          name?: string
          url?: string
          description?: string | null
          version?: string | null
        } = {
          ...(name && { name }),
          ...(url && { url }),
          // !== undefined: distingue "não enviou" (mantém) de "enviou null" (limpa). Vale para os
          // dois campos opcionais — apagar a versão de um link é edição legítima, não campo ausente.
          ...(description !== undefined && { description }),
          ...(version !== undefined && { version }),
        }

        await prisma.downloads.update({
          where: { id },
          data: dataToUpdate,
        })

        return reply.status(200).send({
          message: 'Download atualizado com sucesso.',
        })
      }
    )
}
