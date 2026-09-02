import { env } from '@/http/env'
import { prisma } from '@/lib/prisma'
import {
  compareVersions,
  isEnvelopeSignatureValid,
  isSignedEnvelope,
  type ManifestContent,
  readManifestContent,
} from '@/utils/app-version'
import { type AppVersionOrigins, Prisma } from '../../../../generated/prisma/client'

/**
 * Porta de entrada única da versão publicada.
 *
 * As duas fontes passam por aqui — o `POST /app/version` (a publicação avisando) e o job que
 * espelha o arquivo público. Elas escrevem na mesma tabela, então a regra de "o que pode
 * sobrescrever o quê" precisa morar num lugar só, e não duplicada nas duas pontas.
 */

type SavePublishedVersionInput = {
  /** O envelope assinado **como texto**, exatamente como chegou. Nunca um objeto já parseado. */
  envelope: string
  origin: AppVersionOrigins
  /** `ETag` da leitura, quando veio do espelho. O aviso da publicação não tem uma. */
  etag?: string | null
}

export type SavePublishedVersionResult =
  | { status: 'saved'; version: string }
  /** Chegou, foi lido, e foi recusado — com o motivo. Nenhum destes é erro de servidor. */
  | {
      status: 'ignored'
      /**
       * `older` = número de versão menor que o guardado.
       * `stale_rollout` = mesmo número, mas publicado antes do que já está guardado — tipicamente o
       * espelho lendo do cache da CDN uma onda que a publicação já substituiu.
       */
      reason: 'invalid_envelope' | 'invalid_signature' | 'invalid_manifest' | 'older' | 'stale_rollout'
      version?: string
    }

/**
 * `implantacao` vai para o banco como veio, sem interpretar.
 *
 * O `DbNull` é necessário porque, em coluna `Json`, `undefined` no Prisma significa "não mexe neste
 * campo" — o que faria um manifesto novo *sem* onda herdar silenciosamente a onda do anterior.
 */
function toJsonColumn(value: unknown) {
  if (value === undefined || value === null) {
    return Prisma.DbNull
  }

  return value as Prisma.InputJsonValue
}

/** `geradoEm` é do arquivo, e arquivo externo mente: data impossível vira ausência, não `Invalid Date`. */
function toGeneratedAt(value: string | undefined): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Entre dois manifestos com o **mesmo número de versão**, este é mais recente que o guardado?
 *
 * ## Por que o número da versão não basta
 *
 * A onda sobe republicando o mesmo número: `1.0.8` a 0%, depois a 10%, 50%, 100%. E o freio de mão —
 * conter uma versão ruim — é o mesmo movimento ao contrário, republicar com percentual menor. Nos
 * dois casos só a `implantacao` muda, então uma guarda que olhe apenas o número deixa passar tudo,
 * inclusive o espelho lendo do cache da CDN uma onda que já foi substituída.
 *
 * Na fase 1 isso é cosmético: o painel mostra uma fatia velha. Na fase 2, quando `GET /app/version`
 * passar a servir este envelope, é grave — a API entregaria a onda antiga para sempre, e o parque
 * pararia de atualizar sem erro em lugar nenhum.
 *
 * ## Por que `geradoEm`, e não o percentual
 *
 * Comparar percentual pareceria natural e quebraria justamente o freio de mão, que **precisa**
 * baixar a fatia. O que ordena publicações é o instante em que foram feitas — e `geradoEm` vem de
 * dentro do `conteudo` assinado, então não é falsificável sem invalidar a assinatura.
 *
 * `geradoEm` igual é o mesmo arquivo chegando pelas duas fontes: passa, e serve para atualizar o
 * `ETag` e registrar quem confirmou.
 *
 * ## Quando não dá para comparar
 *
 * Faltando o carimbo de um dos lados, a decisão vai para a origem: o **aviso da publicação vence**,
 * porque é alguém publicando naquele instante, e o **espelho perde**, porque é leitura oportunista
 * de um arquivo que pode estar em cache. Na dúvida, quem tem intenção ganha de quem tem cópia.
 */
function isFresherThanCurrent(
  content: ManifestContent,
  current: { generatedAt: Date | null },
  origin: AppVersionOrigins
): boolean {
  const incoming = toGeneratedAt(content.geradoEm)

  if (!incoming || !current.generatedAt) {
    // Este caminho é quase inalcançável na prática: o `publicar.ps1` escreve `geradoEm` em toda
    // publicação, sem condição, e o campo vive dentro do `conteudo` assinado — não há como se
    // perder em trânsito sem invalidar a assinatura junto. Para faltar, alguém teria que montar o
    // conteúdo à mão e assiná-lo fora do processo de publicação.
    //
    // Por isso o aviso: não é um empate comum, é sinal de manifesto entrando por fora. Silencioso,
    // ele seria a única pista de que isso aconteceu — e não haveria pista nenhuma.
    console.warn(
      `[Versão ⚠️ ] Manifesto da ${content.versao} sem \`geradoEm\` comparável; desempate pela origem (${origin}). ` +
        'Manifesto publicado fora do processo normal?'
    )

    return origin === 'PUBLISHER'
  }

  return incoming.getTime() >= current.generatedAt.getTime()
}

/** A versão que vale hoje: a última que entrou, porque só entra o que é mais novo (ver abaixo). */
export async function getCurrentPublishedVersion() {
  return prisma.appVersions.findFirst({
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Grava a versão publicada, **se** ela for mais nova do que a que já está guardada.
 *
 * ## A guarda que parece paranoia e não é
 *
 * O arquivo público tem `Cache-Control: max-age=300`. A publicação sobe a 1.0.9 e avisa a API pelo
 * `POST` — a API já sabe. Minutos depois o job de espelho pergunta à CDN, que **ainda entrega a
 * 1.0.8 do cache**, e sem esta guarda o espelho rebaixaria a versão publicada.
 *
 * O estrago é pior do que parece: o painel volta a dizer que o parque está em dia, o botão de
 * atualizar some de todas as máquinas, e cinco minutos depois tudo se conserta sozinho. Um bug que
 * aparece e some sozinho é um bug que ninguém consegue reproduzir para reportar.
 *
 * Por isso a ordem aqui **nunca** é por quem escreveu por último. É por número de versão e, no
 * empate, pelo `geradoEm` de dentro do conteúdo assinado — ver `isFresherThanCurrent`, que explica
 * por que o número sozinho não basta quando a onda é republicada com a mesma versão.
 *
 * Mesmo arquivo chegando pelas duas fontes (número e `geradoEm` iguais) não é recusado: atualiza a
 * linha com o `ETag` novo e a origem que confirmou, e é assim que o espelho passa a receber `304`
 * depois de um aviso de publicação.
 *
 * **Nunca lança por conteúdo ruim.** Envelope quebrado e manifesto ilegível são respostas normais
 * de uma origem externa, e viram `ignored` com motivo. Falha de banco, essa sim, sobe — quem chama
 * decide (a rota vira 500, o job registra e tenta de novo em 5 minutos).
 */
export async function savePublishedVersion({
  envelope,
  origin,
  etag = null,
}: SavePublishedVersionInput): Promise<SavePublishedVersionResult> {
  let parsed: unknown

  try {
    parsed = JSON.parse(envelope)
  } catch {
    return { status: 'ignored', reason: 'invalid_envelope' }
  }

  if (!isSignedEnvelope(parsed)) {
    return { status: 'ignored', reason: 'invalid_envelope' }
  }

  // Antes de ler o conteúdo: um envelope adulterado não merece nem ser aberto. Sai desligado por
  // padrão (sem `APP_MANIFEST_PUBLIC_KEY` a função devolve `true`) — quem confere de verdade,
  // sempre, é a estação, com a chave embutida no executável.
  if (!isEnvelopeSignatureValid(parsed, env.APP_MANIFEST_PUBLIC_KEY)) {
    return { status: 'ignored', reason: 'invalid_signature' }
  }

  const content = readManifestContent(parsed)

  if (!content) {
    return { status: 'ignored', reason: 'invalid_manifest' }
  }

  const current = await getCurrentPublishedVersion()

  if (current) {
    const comparison = compareVersions(content.versao, current.version)

    // `null` só acontece se a versão guardada tiver virado ilegível por edição manual no banco —
    // e aí o que está no arquivo assinado vale mais do que o que alguém digitou na tabela.
    if (comparison !== null && comparison < 0) {
      return { status: 'ignored', reason: 'older', version: content.versao }
    }

    // Mesmo número de versão não quer dizer mesmo arquivo: a onda é republicada com o número
    // inalterado (`1.0.8` a 0%, depois 10%, 50%, 100%), e conter uma versão ruim é o mesmo
    // movimento ao contrário — republicar com percentual menor. Nos dois casos o que muda é a
    // `implantacao`, e o desempate precisa ser o instante da publicação.
    if (comparison === 0 && !isFresherThanCurrent(content, current, origin)) {
      return { status: 'ignored', reason: 'stale_rollout', version: content.versao }
    }
  }

  const data = {
    // O texto cru, sem passar por `JSON.stringify` de volta: é este campo que a fase 2 devolve
    // byte a byte às estações.
    envelope,
    generatedAt: toGeneratedAt(content.geradoEm),
    notes: content.notas ?? null,
    rollout: toJsonColumn(content.implantacao),
    origin,
    etag,
  }

  await prisma.appVersions.upsert({
    where: { version: content.versao },
    create: { version: content.versao, ...data },
    update: data,
  })

  return { status: 'saved', version: content.versao }
}
