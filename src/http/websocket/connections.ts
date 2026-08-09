import type { WebSocket } from '@fastify/websocket'
import { type ServerMessage, sendMessage } from './protocol'

/**
 * Registro em memória das estações conectadas.
 *
 * É estado volátil de propósito: se a API reinicia, todo Desktop cai e reconecta, e o
 * estado real (sessão, manutenção, sala) continua no banco. Persistir conexão só criaria
 * uma tabela que mente sobre quem está online.
 */

export type ComputerConnection = {
  /** Chave do registro — já normalizado por `formattedCodeMac`, igual ao gravado em `computers.macCode`. */
  macCode: string
  socket: WebSocket
  connectedAt: Date
  /**
   * Marcado como vivo a cada `pong`. O heartbeat derruba quem não responde: sem isso,
   * um PC desligado na tomada ficaria no mapa até o TCP do sistema desistir (horas).
   */
  isAlive: boolean
}

class ComputerConnectionsManager {
  #connections = new Map<string, ComputerConnection>()

  /**
   * Registra a estação. Se o macCode já tinha conexão, a nova vence e a antiga é devolvida
   * para ser encerrada pelo chamador.
   *
   * A alternativa (recusar a nova) parece mais segura, mas é pior na prática: numa queda de
   * rede o servidor pode demorar a perceber que o socket velho morreu, e o Desktop ficaria
   * impedido de voltar justamente enquanto está tentando.
   */
  register(macCode: string, socket: WebSocket): { connection: ComputerConnection; replaced: ComputerConnection | null } {
    const previous = this.#connections.get(macCode) ?? null

    const connection: ComputerConnection = {
      macCode,
      socket,
      connectedAt: new Date(),
      isAlive: true,
    }

    this.#connections.set(macCode, connection)

    return { connection, replaced: previous?.socket === socket ? null : previous }
  }

  /**
   * Remove a estação **somente** se o socket informado for o que está registrado.
   *
   * O `close` da conexão substituída chega depois que a nova já assumiu a chave; sem essa
   * checagem, o adeus da conexão velha apagaria a conexão nova do mapa.
   */
  unregister(macCode: string, socket: WebSocket): boolean {
    const current = this.#connections.get(macCode)

    if (!current || current.socket !== socket) {
      return false
    }

    return this.#connections.delete(macCode)
  }

  get(macCode: string): ComputerConnection | undefined {
    return this.#connections.get(macCode)
  }

  has(macCode: string): boolean {
    return this.#connections.has(macCode)
  }

  /** Envia uma mensagem para uma estação específica. `false` = computador não está conectado. */
  sendTo(macCode: string, message: ServerMessage): boolean {
    const connection = this.#connections.get(macCode)

    if (!connection) {
      return false
    }

    return sendMessage(connection.socket, message)
  }

  list(): ComputerConnection[] {
    return [...this.#connections.values()]
  }

  get size(): number {
    return this.#connections.size
  }

  clear(): void {
    this.#connections.clear()
  }
}

/** Singleton, no mesmo espírito do `prisma` em `src/lib/prisma.ts`. */
export const computerConnections = new ComputerConnectionsManager()
