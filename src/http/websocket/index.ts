import { fastifyWebsocket } from '@fastify/websocket'
import type { FastifyInstance } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { authorizeHandshake } from './authorization'
import { computerConnections } from './connections'
import { handleComputerConnection } from './handler'
import { WS_CLOSE_CODES } from './protocol'

export type { ComputerConnection } from './connections'
export { computerConnections } from './connections'
export { notifySessionClosed } from './notifications'
export type { ServerMessage, SessionClosedReason } from './protocol'
export { SESSION_CLOSED_REASONS, WS_CLOSE_CODES, WS_ERROR_CODES } from './protocol'

/** Endpoint do canal permanente com os Desktops das salas. */
export const WEBSOCKET_COMPUTERS_PATH = '/ws/computers'

/**
 * Intervalo entre pings de controle.
 *
 * Ping é frame de protocolo, respondido pela própria pilha do WebSocket — não depende de
 * o Desktop implementar nada. Serve para detectar a conexão meio-aberta (PC desligado no
 * botão, cabo removido), que sem isso ficaria "conectada" no mapa por horas.
 */
const HEARTBEAT_INTERVAL_MS = 30_000

/**
 * Frames maiores que isso são recusados pelo `ws`. As mensagens do protocolo são pequenas;
 * o teto existe só para não deixar um cliente alocar memória à vontade no servidor.
 */
const MAX_PAYLOAD_BYTES = 4 * 1024

async function websocket(app: FastifyInstance) {
  await app.register(fastifyWebsocket, {
    options: {
      maxPayload: MAX_PAYLOAD_BYTES,
    },
  })

  app.get(
    WEBSOCKET_COMPUTERS_PATH,
    {
      websocket: true,
      // Fora do Swagger: não é rota REST e o Scalar não sabe representar upgrade.
      schema: { hide: true },
      // Último ponto em que ainda dá para recusar o upgrade com uma resposta HTTP comum.
      preValidation: async (request, reply) => {
        const result = authorizeHandshake(request)

        if (!result.authorized) {
          return reply.status(401).send({ message: result.reason })
        }
      },
    },
    handleComputerConnection
  )

  const heartbeat = setInterval(() => {
    for (const connection of computerConnections.list()) {
      if (!connection.isAlive) {
        console.warn(`[WS 💀] Computador ${connection.macCode} não respondeu ao ping; conexão descartada.`)

        computerConnections.unregister(connection.macCode, connection.socket)
        connection.socket.terminate()

        continue
      }

      connection.isAlive = false
      connection.socket.ping()
    }
  }, HEARTBEAT_INTERVAL_MS)

  // Um interval ativo seguraria o processo vivo no shutdown e travaria os testes.
  heartbeat.unref()

  app.addHook('onClose', async () => {
    clearInterval(heartbeat)

    for (const connection of computerConnections.list()) {
      connection.socket.close(WS_CLOSE_CODES.SERVER_SHUTDOWN, 'server_shutdown')
    }

    computerConnections.clear()
  })
}

/**
 * `fastify-plugin` evita o encapsulamento: sem ele, a rota nasceria em um escopo filho e
 * qualquer hook global registrado depois não a alcançaria.
 */
export const websocketPlugin = fastifyPlugin(websocket, {
  name: 'sala-livre-websocket',
})
