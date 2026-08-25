import type { WebSocket } from '@fastify/websocket'
import type { FastifyRequest } from 'fastify'
import { prisma } from '@/lib/prisma'
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

  /**
   * Busca o rótulo da estação (sala, número e UF) no cadastro.
   *
   * Nunca lança: o registro já aconteceu quando isto roda, e uma indisponibilidade do banco
   * não pode custar o canal da máquina. Sem o rótulo o Desktop cai na configuração local.
   *
   * Os três campos andam juntos de propósito: como `rooms.uf` é NOT NULL, "veio a sala mas
   * não veio a UF" não existe. Ausência no `registered` significa uma coisa só — MAC fora do
   * cadastro (ou banco fora do ar) — e o Desktop trata os três da mesma forma.
   */
  async function findComputerLabel(macCode: string): Promise<{ roomName: string; number: number; uf: string } | null> {
    try {
      const computer = await prisma.computers.findUnique({
        where: { macCode },
        select: { number: true, room: { select: { name: true, uf: true } } },
      })

      if (!computer) {
        console.warn(`[WS ⚠️ ] Computador ${macCode} conectado mas não encontrado no cadastro; registrado sem sala e número.`)

        return null
      }

      return { roomName: computer.room.name, number: computer.number, uf: computer.room.uf }
    } catch (err) {
      console.error(`[WS ❌] Falha ao buscar o cadastro de ${macCode}; registrado sem sala e número:`, err)

      return null
    }
  }

  /**
   * Guarda a última versão que a estação informou.
   *
   * Três decisões que não são óbvias pelo formato da mensagem:
   *
   * 1. **Ausência não apaga.** Campo fora do JSON significa "configurada para não informar",
   *    e não "deu problema". Zerar a coluna aí destruiria o único dado que o suporte tem sobre
   *    a máquina — então o registro sem versão sai daqui sem tocar em nada.
   *
   * 2. **Grava o que chegou, sem comparar.** Quando uma atualização falha três vezes o cliente
   *    volta sozinho para o executável anterior, então uma estação pode legitimamente reportar
   *    `1.0.7` hoje e `1.0.6` amanhã. Qualquer lógica "só para frente" transformaria justamente
   *    o caso mais importante de enxergar em dado errado.
   *
   * 3. **`updateMany` e não `update`.** O canal aceita MAC que não está cadastrado; `update`
   *    responderia com `P2025` nesse caso, enquanto `updateMany` afeta zero linhas e cala.
   *
   * Nunca lança, pelo mesmo motivo de `findComputerLabel`: o registro já aconteceu, e o banco
   * fora do ar não pode custar o canal da máquina.
   */
  async function recordReportedVersion(macCode: string, version: string | undefined): Promise<void> {
    if (!version) {
      return
    }

    try {
      await prisma.computers.updateMany({
        where: { macCode },
        data: { appVersion: version, appVersionReportedAt: new Date() },
      })
    } catch (err) {
      console.error(`[WS ❌] Falha ao gravar a versão informada por ${macCode}; registro segue normalmente:`, err)
    }
  }

  async function handleRegister(message: RegisterMessage) {
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

    // Tudo que decide a identidade desta conexão já rodou de forma síncrona acima: o `await`
    // abaixo é o primeiro ponto de suspensão, então nem o timeout de registro nem uma segunda
    // mensagem conseguem se intrometer no meio do processo.
    //
    // As duas idas ao banco correm juntas de propósito: a versão é acessória e não pode atrasar
    // o ack, que é o que destrava a tela da estação. Nenhuma das duas rejeita, então o
    // `Promise.all` aqui não tem como falhar por uma delas.
    const [label] = await Promise.all([findComputerLabel(macCode), recordReportedVersion(macCode, message.version)])

    // Enquanto a consulta corria, uma reconexão pode ter assumido a chave — o ack pertence
    // à conexão que está no mapa, não a esta.
    if (computerConnections.get(macCode)?.socket !== socket) {
      return
    }

    sendMessage(socket, {
      type: 'registered',
      macCode,
      connectedAt: connection.connectedAt.toISOString(),
      ...(label ?? {}),
    })

    console.log(
      `[WS ✅] Computador ${macCode} registrado${label ? ` em ${label.roomName}/${label.uf} (nº ${label.number})` : ''}` +
        `${message.version ? ` — Desktop v${message.version}` : ''} (${computerConnections.size} conectado(s)).`
    )
  }

  socket.on('message', async raw => {
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
          // O `await` mantém a falha dentro deste try/catch: sem ele a rejeição escaparia
          // como unhandled rejection e derrubaria o processo.
          await handleRegister(parsed.data)
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
