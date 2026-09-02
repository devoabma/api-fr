import { createPublicKey, createVerify } from 'node:crypto'

/**
 * Comparação de versões do Desktop e leitura do manifesto assinado.
 *
 * Vive fora do `http/` porque é regra pura — sem banco, sem rede, sem Fastify. É a mesma conta que
 * o cliente WPF faz antes de aceitar qualquer pacote; a daqui existe só para o painel saber o que
 * pintar e para a API saber se o que chegou é mais novo do que ela já tinha.
 */

/** Três partes (`major.minor.patch`) é o formato que o publicador gera e o cliente compara. */
const VERSION_PARTS = 3

/**
 * Quebra `"1.0.8"` em `[1, 0, 8]`, ou devolve `null` quando o texto não é uma versão.
 *
 * **O `null` é o ponto inteiro desta função.** O protocolo do canal aceita a versão informada pela
 * estação depois de um saneamento permissivo (`[\w.+-]`, ver `protocol.ts`), então `"1.0.8-beta"`,
 * `"v1.0.8"` e `"dev"` chegam ao banco sem problema. A comparação ingênua — `Number("8-beta")` —
 * devolve `NaN`, e `NaN` perde toda comparação: a máquina apareceria como **em dia** para sempre,
 * que é o pior desfecho possível para um campo cuja única função é denunciar atraso.
 *
 * Por isso "não sei ler" é um resultado nomeado, e não um número chutado.
 */
export function parseVersion(version: string | null | undefined): number[] | null {
  if (!version) {
    return null
  }

  const parts = version.trim().split('.')

  // Aceita `"1.0"` (completado com zero) mas recusa `"1.0.8.4"`: sobra de parte é sinal de que o
  // texto não é o que este código pensa que é, e adivinhar aí seria repetir o erro do `NaN`.
  if (parts.length === 0 || parts.length > VERSION_PARTS) {
    return null
  }

  const numbers: number[] = []

  for (let index = 0; index < VERSION_PARTS; index++) {
    const part = parts[index]

    // Parte ausente vale zero: `"1.0"` é `1.0.0`.
    if (part === undefined) {
      numbers.push(0)
      continue
    }

    // `Number` sozinho aceitaria `""`, `" 8 "`, `"0x10"` e `"1e3"` como números válidos. A regra
    // aqui é literal: dígitos, e nada além de dígitos.
    if (!/^\d+$/.test(part)) {
      return null
    }

    numbers.push(Number(part))
  }

  return numbers
}

/**
 * Compara duas versões já quebradas em partes.
 *
 * `> 0` = `a` é mais nova; `< 0` = `b` é mais nova; `0` = iguais.
 */
function compareParts(a: number[], b: number[]): number {
  for (let index = 0; index < VERSION_PARTS; index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)

    if (difference !== 0) {
      return difference
    }
  }

  return 0
}

/**
 * `> 0` quando `version` é mais nova que `other`. `null` quando alguma das duas não é legível —
 * e quem chama **precisa** tratar esse `null`, em vez de deixá-lo virar "iguais".
 */
export function compareVersions(version: string | null | undefined, other: string | null | undefined): number | null {
  const parsed = parseVersion(version)
  const parsedOther = parseVersion(other)

  if (!parsed || !parsedOther) {
    return null
  }

  return compareParts(parsed, parsedOther)
}

/**
 * Situação de uma estação diante da versão publicada. Três estados, nunca dois:
 *
 * - `outdated`: está atrás da publicada. É o único que acende o botão de atualizar no painel.
 * - `up-to-date`: está na publicada — ou à frente dela, o que acontece de verdade quando alguém
 *   testa um pacote novo numa máquina antes de publicar para o parque.
 * - `unknown`: a estação nunca informou a versão, ou informou algo que não dá para comparar, ou a
 *   API ainda não sabe qual é a publicada. Aparece no painel como aviso, **jamais** como "em dia":
 *   confundir "não sei" com "está certo" é como uma máquina desatualizada some do radar.
 */
export type ComputerUpdateStatus = 'outdated' | 'up-to-date' | 'unknown'

export function getUpdateStatus(
  installedVersion: string | null | undefined,
  publishedVersion: string | null | undefined
): ComputerUpdateStatus {
  const comparison = compareVersions(installedVersion, publishedVersion)

  if (comparison === null) {
    return 'unknown'
  }

  return comparison < 0 ? 'outdated' : 'up-to-date'
}

/* -------------------------------------------------------------------------- */
/*                             Manifesto assinado                             */
/* -------------------------------------------------------------------------- */

/**
 * O envelope que a publicação gera e as estações consultam.
 *
 * A API **nunca** assina nem monta este arquivo: a chave privada fica no cofre de quem publica. Aqui
 * ele é só transportado e lido — e guardado como texto, byte a byte, porque é isso que a fase 2
 * (`GET /app/version`) vai devolver às estações.
 */
export type SignedEnvelope = {
  conteudo: string
  algoritmo: string
  chave: string
  assinatura: string
}

/** O que está dentro do `conteudo`, em base64. É aqui que mora o número da versão. */
export type ManifestContent = {
  versao: string
  geradoEm?: string
  notas?: string
  implantacao?: unknown
}

/**
 * Confere que o objeto tem as quatro chaves do envelope, todas como texto não vazio.
 *
 * Vale tanto para o corpo do `POST /app/version` quanto para o arquivo lido do bucket pelo job —
 * nenhuma das duas origens é confiável a ponto de dispensar a conferência.
 */
export function isSignedEnvelope(value: unknown): value is SignedEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const envelope = value as Record<string, unknown>

  return (['conteudo', 'algoritmo', 'chave', 'assinatura'] as const).every(
    key => typeof envelope[key] === 'string' && (envelope[key] as string).length > 0
  )
}

/**
 * Abre o `conteudo` do envelope e devolve o manifesto de dentro.
 *
 * Nunca lança: as duas origens do envelope são externas (o script de publicação e um arquivo na
 * CDN), e um base64 truncado no meio do caminho não pode virar 500 nem derrubar o job.
 *
 * O `versao` é o único campo exigido — sem ele o registro não serve para nada, porque é justamente
 * o número que o painel compara. Os demais são enfeite de tela e podem faltar.
 */
export function readManifestContent(envelope: SignedEnvelope): ManifestContent | null {
  try {
    const decoded = Buffer.from(envelope.conteudo, 'base64').toString('utf8')
    const content = JSON.parse(decoded) as unknown

    if (typeof content !== 'object' || content === null) {
      return null
    }

    const { versao } = content as Record<string, unknown>

    // Precisa ser legível, e não apenas presente: guardar uma versão que a comparação não entende
    // deixaria o parque inteiro em `unknown` — e ninguém atualizaria nada naquele dia.
    if (typeof versao !== 'string' || !parseVersion(versao)) {
      return null
    }

    return content as ManifestContent
  } catch {
    return null
  }
}

/** O único algoritmo que o publicador usa hoje. Envelope com outro rótulo não é conferido às cegas. */
const MANIFEST_SIGNATURE_ALGORITHM = 'ECDSA-P256-SHA256'

/**
 * Confere a assinatura do envelope contra a chave pública do publicador.
 *
 * **Isto não é o que protege o parque.** Quem protege é cada estação, que valida o mesmo envelope
 * com a chave pública embutida no próprio executável antes de instalar qualquer coisa — e recusa em
 * silêncio o que não bater. A conferência aqui é uma rede a mais, e cobre dois casos que a estação
 * cobriria tarde demais: alguém de posse do token de publicação empurrando lixo pela rota, e um
 * arquivo corrompido em trânsito virando "versão publicada" no painel para todo mundo ver.
 *
 * A chave é **pública**: ela já viaja dentro de todo executável instalado no parque. Publicá-la não
 * abre nada. O que abre tudo é a privada, e essa nunca sai do cofre de quem publica — a API não
 * assina nada, em hipótese nenhuma.
 *
 * A assinatura é feita sobre os **bytes decodificados do `conteudo`**, não sobre o envelope inteiro:
 * é justamente isso que permite conferir a origem sem ninguém precisar concordar sobre ordem de
 * chaves, espaços ou escapes do JSON de fora.
 *
 * @param publicKeyInBase64 Chave pública em DER/SPKI, base64. `null`/vazio = conferência desligada,
 *   e aí a função devolve `true` — a API segue transportando o que já vem assinado, como sempre fez.
 */
export function isEnvelopeSignatureValid(envelope: SignedEnvelope, publicKeyInBase64: string | null | undefined): boolean {
  if (!publicKeyInBase64) {
    return true
  }

  // Rótulo diferente do combinado significa que o publicador mudou de algoritmo sem avisar. Conferir
  // com o verificador errado daria `false` e pareceria adulteração; recusar de saída é mais honesto.
  if (envelope.algoritmo !== MANIFEST_SIGNATURE_ALGORITHM) {
    return false
  }

  try {
    const key = createPublicKey({
      key: Buffer.from(publicKeyInBase64, 'base64'),
      format: 'der',
      type: 'spki',
    })

    return createVerify('SHA256')
      .update(Buffer.from(envelope.conteudo, 'base64'))
      .verify({ key, dsaEncoding: 'der' }, Buffer.from(envelope.assinatura, 'base64'))
  } catch {
    // Chave mal configurada ou assinatura truncada. Recusar é o certo: o que não dá para conferir
    // não pode passar como conferido.
    return false
  }
}
