import { computerConnections } from './connections'
import type { SessionClosedReason } from './protocol'

/**
 * Avisos que a API empurra para as estações.
 *
 * Fica separado do `connections` de propósito: as rotas e os jobs falam com este módulo e
 * não com o mapa de conexões, então o dia em que a entrega mudar (várias instâncias, fila,
 * Redis) só este arquivo muda.
 */

type SessionClosedInput = {
  /** Já normalizado por `formattedCodeMac` — é a chave do mapa de conexões. */
  macCode: string
  sessionId: string
  reason: SessionClosedReason
  closedAt: Date
  remainingTime: number
}

/**
 * Avisa a estação de que a sessão terminou.
 *
 * **Nunca lança.** Quando esta função é chamada o encerramento já está gravado no banco:
 * transformar uma falha de socket em erro 500 faria o painel dizer que não deu certo uma
 * operação que deu. O retorno diz apenas se a mensagem saiu.
 *
 * `false` (estação offline) é situação esperada, não incidente: enquanto o `register` não
 * devolver o retrato do estado atual, o Desktop que estava fora do ar só descobre o
 * encerramento quando o próprio relógio dele zera e o `close-computer` responde que a
 * sessão já acabou.
 */
export function notifySessionClosed(input: SessionClosedInput): boolean {
  try {
    const delivered = computerConnections.sendTo(input.macCode, {
      type: 'session_closed',
      macCode: input.macCode,
      sessionId: input.sessionId,
      reason: input.reason,
      closedAt: input.closedAt.toISOString(),
      remainingTime: input.remainingTime,
    })

    if (delivered) {
      console.log(`[WS 📤] Encerramento (${input.reason}) da sessão ${input.sessionId} enviado para ${input.macCode}.`)
    } else {
      console.warn(`[WS 📭] Computador ${input.macCode} não está conectado; encerramento da sessão ${input.sessionId} não foi entregue.`)
    }

    return delivered
  } catch (err) {
    console.error(`[WS ❌] Falha ao avisar ${input.macCode} sobre o encerramento da sessão ${input.sessionId}:`, err)

    return false
  }
}
