import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { getCurrentPublishedVersion } from '@/http/core/app-version/save-published-version'
import { auth } from '@/http/middleware/auth'
import { computerConnections } from '@/http/websocket'
import { prisma } from '@/lib/prisma'
import { formattedCodeMac } from '@/utils'
import { getUpdateStatus } from '@/utils/app-version'

const getAllComputersSchema = {
  tags: ['computers'],
  summary: 'Recupera todos os computadores por sala e/ou descricão',
  security: [{ bearerAuth: [] }],
  querystring: z.object({
    roomId: z.cuid2().optional(),
    description: z.string().optional(),
  }),
  response: {
    200: z.object({
      computers: z.array(
        z.object({
          id: z.cuid2(),
          macCode: z.string(),
          number: z.number(),
          description: z.string(),
          inUse: z.boolean(),
          maintenance: z.date().nullable(),
          createdAt: z.date(),
          /**
           * Última versão do Desktop informada pela estação, como texto (`"1.0.7"`).
           *
           * `null` significa que a máquina nunca informou — ou porque não conectou desde que a
           * API passou a guardar, ou porque o envio está desligado na configuração dela. É o
           * campo que responde "quantas estações ainda estão na versão que quero tirar de campo".
           */
          appVersion: z.string().nullable(),
          /**
           * Quando a estação informou a versão. Não confundir com "vista por último": ela só se
           * apresenta ao conectar, então máquina que fica no ar sem cair mantém carimbo antigo.
           */
          appVersionReportedAt: z.date().nullable(),
          /**
           * A estação está com o canal aberto **agora**.
           *
           * Sai do mapa em memória do WebSocket, não do banco — e por isso não custa consulta
           * nenhuma. Vem junto daqui porque a tela de administração precisa das duas metades na
           * mesma linha: só faz sentido oferecer "atualizar agora" para quem está do outro lado
           * para ouvir o pedido.
           */
          isOnline: z.boolean(),
          /**
           * Situação desta estação diante da versão publicada, decidida no servidor.
           *
           * Três estados, nunca dois — `unknown` cobre "nunca informou a versão", "informou algo que
           * não dá para comparar" e "a API ainda não sabe qual é a publicada". A conta mora aqui, e
           * não no painel, porque comparar versão por texto é um erro que só aparece na décima
           * publicação (`"1.0.10"` é menor que `"1.0.9"` em ordem alfabética) e não pode ser
           * reescrito em cada tela que precisar dele.
           */
          updateStatus: z.enum(['outdated', 'up-to-date', 'unknown']),
          room: z.object({
            id: z.cuid2(),
            name: z.string(),
          }),
        })
      ),
      /**
       * A versão publicada mais recente que a API conhece. `null` enquanto nenhuma chegou — nem pelo
       * aviso da publicação, nem pelo job de espelho.
       *
       * As `notes` vêm do próprio manifesto, escritas em português para o funcionário ler antes de
       * mandar atualizar.
       */
      latestVersion: z
        .object({
          version: z.string(),
          notes: z.string().nullable(),
          generatedAt: z.date().nullable(),
        })
        .nullable(),
    }),
  },
} satisfies FastifySchema

export async function getAllComputers(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/get-all',
      {
        schema: getAllComputersSchema,
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { roomId, description } = request.query

        const computers = await prisma.computers.findMany({
          where: {
            roomId,
            description: {
              contains: description,
              mode: 'insensitive',
            },
          },
          select: {
            id: true,
            macCode: true,
            number: true,
            description: true,
            inUse: true,
            maintenance: true,
            createdAt: true,
            appVersion: true,
            appVersionReportedAt: true,
            room: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        const publishedVersion = await getCurrentPublishedVersion()

        // Uma leitura do mapa em memória serve a lista inteira, em vez de uma consulta por linha.
        const onlineMacCodes = new Set(computerConnections.list().map(({ macCode }) => macCode))

        return reply.status(200).send({
          computers: computers.map(computer => ({
            ...computer,
            // O mapa é indexado pelo MAC normalizado; normalizar dos dois lados evita que uma linha
            // antiga fora do padrão apareça offline estando conectada.
            isOnline: onlineMacCodes.has(formattedCodeMac(computer.macCode)),
            updateStatus: getUpdateStatus(computer.appVersion, publishedVersion?.version),
          })),
          latestVersion: publishedVersion
            ? {
                version: publishedVersion.version,
                notes: publishedVersion.notes,
                generatedAt: publishedVersion.generatedAt,
              }
            : null,
        })
      }
    )
}
