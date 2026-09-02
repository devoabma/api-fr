import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { getCurrentPublishedVersion } from '@/http/core/app-version/save-published-version'
import { auth } from '@/http/middleware/auth'
import { rateLimits } from '@/http/rate-limit'
import { computerConnections } from '@/http/websocket'
import { notifyUpdateNow } from '@/http/websocket/notifications'
import { prisma } from '@/lib/prisma'
import { formattedCodeMac } from '@/utils'
import { getUpdateStatus } from '@/utils/app-version'

/**
 * Manda **uma** estação atualizar agora.
 *
 * O caminho é `/update-app/:id`, e **não** `/update/:id`: este último já é o `PATCH` que edita o
 * cadastro do computador. Duas operações sem nada em comum na mesma URL, separadas só pelo verbo,
 * é um erro esperando acontecer — quem digitasse `POST` querendo editar mandaria uma estação inteira
 * baixar 60 MB, e o Swagger mostraria as duas empilhadas no mesmo caminho.
 *
 * Recebe o `id` do computador, e não o `macCode`, por dois motivos. Todas as rotas do painel já
 * falam por `cuid2` (`/maintenance/:id`, `/delete/:id`) e o front tem o `id` em mãos; e MAC em URL
 * convida a formato divergente — `formattedCodeMac` normaliza `00E04CF56778` e `00-E0-4C-F5-67-78`
 * para a mesma coisa, mas deixa passar `00:E0:4C:F5:67:78`, que tem os mesmos 17 caracteres e não
 * casa com ninguém no cadastro. Isso não afeta o cliente WPF em nada: quem chama esta rota é o
 * painel, nunca a estação.
 *
 * **A resposta confirma o envio do recado, jamais a atualização.** O resultado real chega depois,
 * pelo `register` seguinte trazendo a versão nova.
 */

const updateComputerAppSchema = {
  tags: ['computers'],
  summary: 'Manda uma estação consultar o manifesto e atualizar agora (ADMIN)',
  security: [{ bearerAuth: [] }],
  params: z.object({
    id: z.cuid2(),
  }),
  response: {
    200: z.object({
      message: z.string(),
      macCode: z.string(),
      /** Versão que a API esperava instalar. Ausente quando ela ainda não sabe qual é a publicada. */
      version: z.string().optional(),
    }),
    400: z.object({ message: z.string() }),
    401: z.object({ message: z.string() }),
    404: z.object({ message: z.string() }),
    // Estação fora do canal. Não é erro de quem pediu, e não vira fila: a máquina desligada pega a
    // versão sozinha na próxima partida.
    409: z.object({ message: z.string() }),
  },
} satisfies FastifySchema

export async function updateComputerApp(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/update-app/:id',
      {
        schema: updateComputerAppSchema,
        config: { rateLimit: rateLimits.updateComputerApp },
      },
      async (request, reply) => {
        await request.checkIfEmployeeIsAdmin()

        const { id } = request.params

        const computer = await prisma.computers.findUnique({
          where: { id },
          select: {
            macCode: true,
            description: true,
            inUse: true,
            appVersion: true,
          },
        })

        if (!computer) {
          throw new NotFoundError('Computador não encontrado.')
        }

        // Máquina em manutenção **pode** atualizar de propósito: é justamente quando ninguém está
        // usando, o melhor momento possível para trocar o executável.
        //
        // Sessão aberta, não. A API é quem enxerga o parque, e é a única que consegue aplicar esta
        // regra antes de gastar o canal: melhor não disparar do que disparar e receber `refused` de
        // volta. Nenhuma versão interrompe advogado(a) em atendimento, em hipótese alguma.
        if (computer.inUse) {
          throw new BadRequestError(
            'Computador em uso por um(a) advogado(a). A atualização precisa esperar o encerramento da sessão.'
          )
        }

        const publishedVersion = await getCurrentPublishedVersion()

        // Máquina comprovadamente em dia não gasta 60 MB do link da unidade à toa. `unknown` — nunca
        // informou a versão, ou informou algo ilegível — passa: é exatamente a máquina sobre a qual
        // não se sabe nada que mais precisa ser sacudida.
        if (publishedVersion && getUpdateStatus(computer.appVersion, publishedVersion.version) === 'up-to-date') {
          throw new BadRequestError(`Esta estação já está na versão publicada (v${publishedVersion.version}).`)
        }

        // O mapa de conexões é indexado pelo MAC normalizado. O cadastro já grava assim, mas
        // normalizar de novo custa nada e evita que uma linha antiga fora do padrão vire um
        // "estação desconectada" que não é verdade.
        const macCode = formattedCodeMac(computer.macCode)

        if (!computerConnections.has(macCode)) {
          return reply.status(409).send({
            message: 'Estação desconectada. Ela vai buscar a versão sozinha na próxima vez que for ligada.',
          })
        }

        const delivered = notifyUpdateNow({ macCode, version: publishedVersion?.version })

        // Corrida estreita e real: a estação caiu entre a checagem acima e o envio. Mesma resposta,
        // porque para quem está na frente do painel é a mesma situação.
        if (!delivered) {
          return reply.status(409).send({
            message: 'Estação desconectada. Ela vai buscar a versão sozinha na próxima vez que for ligada.',
          })
        }

        console.log(`[Versão 📤] Atualização pedida para ${computer.description} (${macCode}) por um ADMIN.`)

        return reply.status(200).send({
          message: 'Pedido de atualização enviado para a estação.',
          macCode,
          ...(publishedVersion ? { version: publishedVersion.version } : {}),
        })
      }
    )
}
