import { computerConnections } from './connections'
import type { ServerMessage, SessionClosedReason } from './protocol'

/**
 * Avisos que a API empurra para as estações.
 *
 * Fica separado do `connections` de propósito: as rotas e os jobs falam com este módulo e
 * não com o mapa de conexões, então o dia em que a entrega mudar (várias instâncias, fila,
 * Redis) só este arquivo muda.
 *
 * **Nenhuma função daqui lança.** Quando elas são chamadas o efeito já está gravado no
 * banco: transformar uma falha de socket em erro 500 faria o painel dizer que não deu certo
 * uma operação que deu. O retorno diz apenas se a mensagem saiu.
 */

/**
 * Entrega uma mensagem a uma estação e registra o resultado.
 *
 * `false` (estação offline) é situação esperada, não incidente: enquanto o `register` não
 * devolver o retrato do estado atual, o Desktop que estava fora do ar só se acerta com o
 * servidor no próximo contato HTTP.
 *
 * @param description Trecho em português usado no log, no formato "<o quê> da sessão X".
 */
function deliver(macCode: string, message: ServerMessage, description: string): boolean {
  try {
    const delivered = computerConnections.sendTo(macCode, message)

    if (delivered) {
      console.log(`[WS 📤] ${description} enviado para ${macCode}.`)
    } else {
      console.warn(`[WS 📭] Computador ${macCode} não está conectado; ${description} não foi entregue.`)
    }

    return delivered
  } catch (err) {
    console.error(`[WS ❌] Falha ao enviar para ${macCode} (${description}):`, err)

    return false
  }
}

type SessionStartedInput = {
  /** Já normalizado por `formattedCodeMac` — é a chave do mapa de conexões. */
  macCode: string
  sessionId: string
  lawyerName: string
  startedAt: Date
  expiresAt: Date
  remainingTime: number
}

/**
 * Manda a estação abrir a sessão do advogado(a).
 *
 * É o que torna possível liberar pelo painel: o funcionário preenche os dados no balcão, a
 * API grava a sessão e é **este aviso** que faz a máquina destravar sozinha — sem ele, o
 * banco diria que o computador está em uso e a tela continuaria trancada.
 *
 * Quando quem chamou a rota foi o próprio Desktop, o evento volta para ele sobre a sessão
 * que ele mesmo abriu; o cliente ignora pelo `sessionId` já em tela (ver `protocol.ts`).
 */
export function notifySessionStarted(input: SessionStartedInput): boolean {
  return deliver(
    input.macCode,
    {
      type: 'session_started',
      macCode: input.macCode,
      sessionId: input.sessionId,
      lawyerName: input.lawyerName,
      startedAt: input.startedAt.toISOString(),
      expiresAt: input.expiresAt.toISOString(),
      remainingTime: input.remainingTime,
    },
    `Abertura da sessão ${input.sessionId}`
  )
}

type SessionClosedInput = {
  /** Já normalizado por `formattedCodeMac` — é a chave do mapa de conexões. */
  macCode: string
  sessionId: string
  reason: SessionClosedReason
  closedAt: Date
  remainingTime: number
}

type UpdateNowInput = {
  /** Já normalizado por `formattedCodeMac` — é a chave do mapa de conexões. */
  macCode: string
  /** Versão publicada, quando a API sabe qual é. Informativa: a estação não instala por causa dela. */
  version?: string
}

/**
 * Manda a estação consultar o manifesto agora.
 *
 * Diferente dos avisos de sessão, aqui o retorno **importa para quem chamou**: nada foi gravado no
 * banco antes desta chamada, então `false` (estação fora do canal) é a resposta que o painel precisa
 * mostrar ao funcionário — "estação desconectada" — em vez de dizer que mandou e não mandou.
 *
 * O que acontece depois não passa mais por aqui: a estação baixa, confere assinatura e SHA-256, roda
 * o autoteste e reinicia. A prova de que deu certo é o `register` seguinte chegando com a versão
 * nova — não existe um "deu certo" separado, porque quem aplica reinicia.
 */
export function notifyUpdateNow(input: UpdateNowInput): boolean {
  return deliver(
    input.macCode,
    {
      type: 'update_now',
      macCode: input.macCode,
      ...(input.version ? { version: input.version } : {}),
    },
    `Pedido de atualização${input.version ? ` para a versão ${input.version}` : ''}`
  )
}

/** Avisa a estação de que a sessão terminou. */
export function notifySessionClosed(input: SessionClosedInput): boolean {
  return deliver(
    input.macCode,
    {
      type: 'session_closed',
      macCode: input.macCode,
      sessionId: input.sessionId,
      reason: input.reason,
      closedAt: input.closedAt.toISOString(),
      remainingTime: input.remainingTime,
    },
    `Encerramento (${input.reason}) da sessão ${input.sessionId}`
  )
}
