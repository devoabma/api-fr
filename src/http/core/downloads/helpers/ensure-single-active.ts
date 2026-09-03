import { BadRequestError } from '@/http/_errors/bad-request'
import { prisma } from '@/lib/prisma'
import type { DownloadKinds } from '../../../../../generated/prisma/enums'

/**
 * Recusa a operação quando já existe um download **ativo** do mesmo tipo.
 *
 * A regra existe porque quem escolhe o link é o front, e ele escolhe pelo `kind`. Com dois
 * instaladores ativos não haveria critério: ele pegaria o primeiro da lista e ninguém perceberia
 * que o botão passou a apontar para o arquivo errado — o pior tipo de erro, o que não avisa.
 *
 * Mora aqui, e não repetida em cada handler, pelo mesmo motivo de `savePublishedVersion`: regra
 * duplicada em dois lugares diverge na primeira correção que alguém fizer só de um lado.
 *
 * A garantia é de aplicação, não do banco. O índice `UNIQUE` parcial que valeria de verdade
 * (`WHERE inactive IS NULL`) não é expressável no schema do Prisma — o comentário da migration
 * `20260903120204_catalogo_de_downloads` registra por que não foi criado só no SQL. Duas
 * requisições simultâneas de ADMIN ainda conseguiriam, em tese, cadastrar dois ativos; é uma tela
 * de configuração usada por um punhado de pessoas, e o próprio `get-all` mostraria a duplicidade.
 *
 * @param ignoreId o registro que está sendo reativado — ele não pode contar como concorrente de si
 * mesmo, senão nenhuma reativação passaria.
 */
export async function ensureNoActiveDownloadOfKind(kind: DownloadKinds, ignoreId?: string) {
  const activeDownload = await prisma.downloads.findFirst({
    where: {
      kind,
      inactive: null,
      ...(ignoreId && { id: { not: ignoreId } }),
    },
    select: { name: true },
  })

  if (activeDownload) {
    throw new BadRequestError(
      `Já existe um download ativo deste tipo ("${activeDownload.name}"). Inative-o antes de deixar outro no lugar.`
    )
  }
}
