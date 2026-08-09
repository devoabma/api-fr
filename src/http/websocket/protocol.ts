import type { WebSocket } from '@fastify/websocket'
import { z } from 'zod'

/**
 * Contrato das mensagens trocadas entre a API (servidor) e o Desktop (cliente).
 *
 * Toda mensagem é um JSON com o campo discriminador `type`. Novos eventos
 * (`computer_released`, `session_started`, `session_finished`, `heartbeat`...) entram
 * como novos membros das uniões abaixo, sem quebrar o que já existe.
 */

/**
 * Códigos de fechamento na faixa privada (4000-4999) reservada às aplicações.
 * O Desktop usa esses números para decidir se reconecta, e em quanto tempo.
 */
export const WS_CLOSE_CODES = {
  /** Conectou mas não se identificou dentro do prazo. Reconectar é inútil sem corrigir o cliente. */
  REGISTRATION_TIMEOUT: 4408,
  /** Outra conexão assumiu o mesmo macCode. Esta é a conexão velha: não reconectar imediatamente. */
  REPLACED_BY_NEW_CONNECTION: 4409,
  /** Reservado para quando a autenticação de estação entrar (ver `authorization.ts`). */
  UNAUTHORIZED: 4401,
  /** API está desligando. O Desktop deve reconectar com backoff. */
  SERVER_SHUTDOWN: 4503,
} as const

export type WsCloseCode = (typeof WS_CLOSE_CODES)[keyof typeof WS_CLOSE_CODES]

/** Motivos de erro de aplicação enviados no `{ type: 'error' }`. */
export const WS_ERROR_CODES = {
  INVALID_PAYLOAD: 'invalid_payload',
  UNKNOWN_MESSAGE_TYPE: 'unknown_message_type',
  INVALID_MAC_CODE: 'invalid_mac_code',
  ALREADY_REGISTERED: 'already_registered',
  NOT_REGISTERED: 'not_registered',
  INTERNAL_ERROR: 'internal_error',
} as const

export type WsErrorCode = (typeof WS_ERROR_CODES)[keyof typeof WS_ERROR_CODES]

/* -------------------------------------------------------------------------- */
/*                            Cliente -> Servidor                             */
/* -------------------------------------------------------------------------- */

const registerMessageSchema = z.object({
  type: z.literal('register'),
  macCode: z.string().trim().nonempty('Mac Code obrigatório'),
})

/**
 * Único tipo aceito hoje. Ao adicionar outro, basta criar o schema e incluí-lo aqui —
 * o `switch` do handler passa a acusar erro de tipo enquanto o caso novo não for tratado.
 */
export const clientMessageSchema = z.discriminatedUnion('type', [registerMessageSchema])

export type ClientMessage = z.infer<typeof clientMessageSchema>
export type RegisterMessage = z.infer<typeof registerMessageSchema>

const CLIENT_MESSAGE_TYPES = new Set<string>(clientMessageSchema.options.map(option => option.shape.type.value))

/* -------------------------------------------------------------------------- */
/*                            Servidor -> Cliente                             */
/* -------------------------------------------------------------------------- */

export type ServerMessage =
  | { type: 'registered'; macCode: string; connectedAt: string }
  | { type: 'error'; code: WsErrorCode; message: string }

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

type ParseResult = { success: true; data: ClientMessage } | { success: false; code: WsErrorCode; message: string }

/**
 * Traduz o frame bruto em mensagem tipada.
 *
 * Retorna o motivo em vez de lançar: um frame malformado é ruído de cliente, não
 * incidente de servidor, e não deve derrubar a conexão nem poluir o log de erros.
 */
export function parseClientMessage(raw: string): ParseResult {
  let payload: unknown

  try {
    payload = JSON.parse(raw)
  } catch {
    return { success: false, code: WS_ERROR_CODES.INVALID_PAYLOAD, message: 'Mensagem não é um JSON válido.' }
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { success: false, code: WS_ERROR_CODES.INVALID_PAYLOAD, message: 'Mensagem deve ser um objeto JSON.' }
  }

  const type = (payload as Record<string, unknown>).type

  if (typeof type !== 'string' || type.length === 0) {
    return { success: false, code: WS_ERROR_CODES.INVALID_PAYLOAD, message: 'Campo "type" obrigatório.' }
  }

  if (!CLIENT_MESSAGE_TYPES.has(type)) {
    return { success: false, code: WS_ERROR_CODES.UNKNOWN_MESSAGE_TYPE, message: `Tipo de mensagem não suportado: "${type}".` }
  }

  const result = clientMessageSchema.safeParse(payload)

  if (!result.success) {
    const issue = result.error.issues[0]

    return {
      success: false,
      code: WS_ERROR_CODES.INVALID_PAYLOAD,
      message: issue ? `${issue.path.join('.') || 'mensagem'}: ${issue.message}` : 'Mensagem inválida.',
    }
  }

  return { success: true, data: result.data }
}

/**
 * Envia uma mensagem tipada. Ignora sockets que já não estão abertos — durante a
 * desconexão o `send` do `ws` lançaria de forma assíncrona, fora de qualquer try/catch.
 */
export function sendMessage(socket: WebSocket, message: ServerMessage): boolean {
  if (socket.readyState !== socket.OPEN) {
    return false
  }

  socket.send(JSON.stringify(message))

  return true
}

export function sendError(socket: WebSocket, code: WsErrorCode, message: string): boolean {
  return sendMessage(socket, { type: 'error', code, message })
}
