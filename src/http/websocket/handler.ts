import type { WebSocket } from '@fastify/websocket'
import type { FastifyRequest } from 'fastify'
import { formattedCodeMac } from '@/utils'
import { computerConnections } from './connections'
import { parseClientMessage, type RegisterMessage, sendError, sendMessage, WS_CLOSE_CODES, WS_ERROR_CODES } from './protocol'

/** Mesmo formato validado no cadastro e na liberação: `AA-BB-CC-DD-EE-FF`. */
const MAC_CODE_LENGTH = 17

/**
 * Prazo para o Desktop se identificar depois de conectar.
 *
 * Conexão anônima consome socket e não serve para nada — sem esse corte, um cliente que
 * só abre a conexão e some ficaria pendurado para sempre (o heartbeat só cobre estações
 * já registradas).
 */
const REGISTRATION_TIMEOUT_MS = 10_000

export function handleComputerConnection(socket: WebSocket, _request: FastifyRequest): void {
  /** `null` enquanto a estação não se identificar. */
  let registeredMacCode: string | null = null

  const registrationTimeout = setTimeout(() => {
    console.warn('[WS ⚠️ ] Conexão encerrada por não se identificar dentro do prazo.')

    socket.close(WS_CLOSE_CODES.REGISTRATION_TIMEOUT, 'registration_timeout')
  }, REGISTRATION_TIMEOUT_MS)

  console.log('[WS 🔌] Nova conexão aberta, aguardando registro...')

  function handleRegister(message: RegisterMessage) {
    const macCode = formattedCodeMac(message.macCode)

    if (macCode.length !== MAC_CODE_LENGTH) {
      // O valor recebido não vai para o log: é texto arbitrário de cliente não confiável.
      console.warn('[WS ⚠️ ] Registro recusado: Mac Code fora do padrão.')

      sendError(socket, WS_ERROR_CODES.INVALID_MAC_CODE, 'Mac Code inválido. Padrão de 17 caracteres.')

      return
    }

    if (registeredMacCode && registeredMacCode !== macCode) {
      sendError(socket, WS_ERROR_CODES.ALREADY_REGISTERED, 'Esta conexão já está registrada em outro computador.')

      return
    }

    clearTimeout(registrationTimeout)

    const { connection, replaced } = computerConnections.register(macCode, socket)

    // A estação antiga é avisada e desligada: duas conexões para o mesmo computador
    // significariam evento entregue em duplicidade ou na máquina errada.
    if (replaced) {
      console.warn(`[WS ♻️ ] Computador ${macCode} reconectou; conexão anterior foi encerrada.`)

      replaced.socket.close(WS_CLOSE_CODES.REPLACED_BY_NEW_CONNECTION, 'replaced_by_new_connection')
    }

    registeredMacCode = macCode

    sendMessage(socket, {
      type: 'registered',
      macCode,
      connectedAt: connection.connectedAt.toISOString(),
    })

    console.log(`[WS ✅] Computador ${macCode} registrado (${computerConnections.size} conectado(s)).`)
  }

  socket.on('message', raw => {
    // O conteúdo bruto nunca vai para o log: pode carregar credencial quando a
    // autenticação de estação entrar.
    const parsed = parseClientMessage(raw.toString())

    if (!parsed.success) {
      console.warn(`[WS ⚠️ ] Mensagem inválida (${parsed.code}) de ${registeredMacCode ?? 'conexão não registrada'}.`)

      sendError(socket, parsed.code, parsed.message)

      return
    }

    try {
      switch (parsed.data.type) {
        case 'register':
          handleRegister(parsed.data)
          break

        default: {
          // Trava de compilação: um tipo novo no protocolo quebra o build até ser tratado aqui.
          const exhaustiveCheck: never = parsed.data.type

          throw new Error(`Tipo de mensagem não tratado: ${String(exhaustiveCheck)}`)
        }
      }
    } catch (err) {
      console.error(`[WS ❌] Erro ao processar mensagem de ${registeredMacCode ?? 'conexão não registrada'}:`, err)

      sendError(socket, WS_ERROR_CODES.INTERNAL_ERROR, 'Erro ao processar a mensagem.')
    }
  })

  // Resposta ao ping do heartbeat: prova que a estação continua viva de verdade.
  socket.on('pong', () => {
    if (!registeredMacCode) {
      return
    }

    const connection = computerConnections.get(registeredMacCode)

    if (connection?.socket === socket) {
      connection.isAlive = true
    }
  })

  socket.on('close', (code, reason) => {
    clearTimeout(registrationTimeout)

    if (!registeredMacCode) {
      console.log(`[WS 🔻] Conexão não registrada encerrada (código ${code}).`)

      return
    }

    const removed = computerConnections.unregister(registeredMacCode, socket)

    // `removed === false` significa que este socket já tinha sido substituído por uma
    // reconexão — o registro atual pertence à conexão nova e não pode ser apagado.
    if (removed) {
      console.log(
        `[WS 🔻] Computador ${registeredMacCode} desconectado (código ${code}${reason?.length ? `: ${reason.toString()}` : ''}). ` +
          `${computerConnections.size} conectado(s).`
      )
    }
  })

  socket.on('error', err => {
    console.error(`[WS ❌] Erro no socket de ${registeredMacCode ?? 'conexão não registrada'}:`, err)
  })
}
