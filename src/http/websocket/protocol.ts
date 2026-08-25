import type { WebSocket } from '@fastify/websocket'
import { z } from 'zod'

/**
 * Contrato das mensagens trocadas entre a API (servidor) e o Desktop (cliente).
 *
 * Toda mensagem é um JSON com o campo discriminador `type`. Novos eventos entram como
 * novos membros das uniões abaixo, sem quebrar o que já existe.
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

/** Teto para a versão informada pelo Desktop: é texto de cliente e só vai para o log. */
const MAX_VERSION_LENGTH = 40

const registerMessageSchema = z.object({
  type: z.literal('register'),
  macCode: z.string().trim().nonempty('Mac Code obrigatório'),
  /**
   * Versão do Desktop instalado na estação, opcional.
   *
   * Declarada aqui de propósito, mesmo sem uso obrigatório: o `z.object` ignora chaves
   * desconhecidas, então o campo já passaria calado — mas ficaria refém de alguém trocar o
   * schema por `.strict()` um dia e derrubar o canal de toda estação que envia a versão.
   *
   * Hoje só aparece no log do registro. Persistir e mostrar no painel é passo seguinte, e
   * não muda nada deste lado.
   */
  version: z
    .string()
    .trim()
    .max(MAX_VERSION_LENGTH)
    // Sobra só o que parece número de versão. Sanear em vez de recusar é proposital: o valor
    // é acessório, e derrubar o registro da estação por causa dele seria o pior dos mundos.
    // De quebra fecha a porta para quebra de linha forjar entrada falsa no log.
    .transform(value => value.replace(/[^\w.+-]/g, ''))
    .optional(),
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

/**
 * Por que a sessão terminou. O Desktop usa isso só para escolher o texto que mostra —
 * a ação (fechar a tela e devolver a máquina à trava) é a mesma em todos os casos.
 */
export const SESSION_CLOSED_REASONS = {
  /** Alguém chamou `POST /close-computer/:sessionId` — o painel web ou o próprio Desktop. */
  MANUAL: 'manual',
  /** A cota do dia acabou e o job `auto-close-sessions` fechou a sessão. */
  EXPIRED: 'expired',
} as const

export type SessionClosedReason = (typeof SESSION_CLOSED_REASONS)[keyof typeof SESSION_CLOSED_REASONS]

export type ServerMessage =
  | {
      /**
       * Confirma que o servidor reconheceu a estação e devolve o rótulo dela.
       *
       * `roomName`, `number` e `uf` saem do cadastro do computador: é o servidor que sabe
       * onde a máquina está, então o instalador não precisa mais que alguém digite a sala nem
       * o estado à mão em cada quiosque, e um remanejamento feito no painel chega sozinho na
       * tela na conexão seguinte.
       *
       * Os três campos são opcionais **no protocolo** porque o canal aceita MAC que ainda
       * não está cadastrado (e porque uma falha de banco não pode custar o registro): nesse
       * caso o Desktop cai na configuração local, como já fazia. Vêm sempre juntos — a UF é
       * NOT NULL no cadastro da sala —, então nunca chega sala sem estado.
       */
      type: 'registered'
      macCode: string
      connectedAt: string
      /** Nome da sala a que o computador pertence. Ausente quando o MAC não está cadastrado. */
      roomName?: string
      /** Número do computador dentro da sala. Ausente quando o MAC não está cadastrado. */
      number?: number
      /**
       * Sigla do estado da sala, sempre em maiúsculas (`"MA"`).
       *
       * O Desktop grava em disco — diferente do rótulo da sala, que só vive em memória —
       * porque a decisão de atualizar é tomada no arranque, antes de o canal conectar: a UF
       * recebida vale a partir da execução seguinte. Chave ausente nunca significa `""`.
       */
      uf?: string
    }
  | { type: 'error'; code: WsErrorCode; message: string }
  | {
      /**
       * Uma sessão começou nesta estação — o Desktop deve destravar a máquina e abrir a
       * tela de sessão, exatamente como faz quando o próprio advogado(a) digita os dados
       * no quiosque.
       *
       * O gatilho é sempre a rota `POST /lawyers/release-computer`, venha ela do painel
       * (funcionário liberando no balcão) ou do próprio Desktop. No segundo caso a estação
       * recebe de volta um evento sobre a sessão que ela mesma acabou de abrir: o Desktop
       * deve tratar a mensagem como **idempotente** e ignorá-la quando o `sessionId` for o
       * da sessão que já está na tela, em vez de reiniciar a contagem.
       */
      type: 'session_started'
      /** Destinatário pretendido, conferido pelo Desktop — mesma proteção do `session_closed`. */
      macCode: string
      sessionId: string
      /**
       * Nome para a tela de boas-vindas. É o único dado do advogado(a) que trafega por
       * aqui: enquanto o canal não tiver credencial de estação (ver `authorization.ts`),
       * nada além do necessário para a UI deve sair por ele — nunca CPF, e-mail ou OAB.
       */
      lawyerName: string
      /** Início gravado no banco, em UTC (sufixo `Z`). */
      startedAt: string
      /** Instante em que o servidor vai encerrar esta sessão, em UTC — igual ao da resposta HTTP. */
      expiresAt: string
      /** Saldo da cota do dia concedido a esta sessão, em minutos. */
      remainingTime: number
    }
  | {
      type: 'session_closed'
      /**
       * Destinatário pretendido, no formato normalizado (`AA-BB-CC-DD-EE-FF`).
       *
       * Redundante com o roteamento — a mensagem já sai pelo socket daquela estação — e é
       * de propósito: o Desktop confere antes de fechar a tela, para que um engano de
       * roteamento no servidor não derrube a sessão da máquina errada.
       */
      macCode: string
      sessionId: string
      reason: SessionClosedReason
      /** Instante do encerramento gravado no banco, em UTC (sufixo `Z`). */
      closedAt: string
      /** Saldo da cota do dia depois deste encerramento, em minutos. */
      remainingTime: number
    }

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
