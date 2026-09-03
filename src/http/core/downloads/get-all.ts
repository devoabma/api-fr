import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '../../../../generated/prisma/client'

const getAllDownloadsSchema = {
  tags: ['downloads'],
  summary: 'Lista os arquivos para download: ADMIN vê todos; MEMBER vê apenas os ativos',
  security: [{ bearerAuth: [] }],
  response: {
    200: z.object({
      downloads: z.array(
        z.object({
          id: z.cuid2(),
          kind: z.enum(['INSTALLER', 'UNINSTALLER']),
          name: z.string(),
          description: z.string().nullable(),
          url: z.url(),
          version: z.string().nullable(),
          inactive: z.date().nullable(),
          createdAt: z.date(),
        })
      ),
    }),
  },
} satisfies FastifySchema

export async function getAllDownloads(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get('/get-all', { schema: getAllDownloadsSchema }, async (request, reply) => {
      const { role } = await request.getCurrentEmployee()

      // ADMIN enxerga também os inativos: é a mesma tela que gerencia os links, e o histórico é
      // o que responde "para onde isto apontava antes". MEMBER só recebe o que dá para baixar —
      // link inativo na tela de operação é botão que leva a um arquivo que não deveria mais existir.
      const where: Prisma.DownloadsWhereInput = role === 'ADMIN' ? {} : { inactive: null }

      const downloads = await prisma.downloads.findMany({
        where,
        select: {
          id: true,
          kind: true,
          name: true,
          description: true,
          url: true,
          version: true,
          inactive: true,
          createdAt: true,
        },
        // Tipo primeiro para o painel já receber agrupado (instalador antes de desinstalador, por
        // ordem alfabética do enum); dentro de cada tipo, o mais recente primeiro — para o ADMIN,
        // que é quem vê mais de um, o ativo tende a ser o de cima.
        orderBy: [{ kind: 'asc' }, { createdAt: 'desc' }],
      })

      return reply.status(200).send({ downloads })
    })
}
