import type { FastifyRequest } from 'fastify'

/**
 * Ponto único de autorização do handshake do WebSocket.
 *
 * Hoje ele apenas libera a conexão: o `macCode` enviado no `register` é uma **afirmação do
 * cliente**, não uma identidade verificada. Qualquer processo que alcance a porta consegue
 * dizer que é o PC-SALA-001. Por isso nada sensível deve trafegar por este canal enquanto
 * a verificação abaixo não existir.
 *
 * TODO(credencial de estação): validar o token opaco enviado no header `Authorization`
 * contra a credencial emitida no primeiro contato do MAC (TOFU) e recusar o upgrade com
 * `WS_CLOSE_CODES.UNAUTHORIZED` quando não bater. O token nunca vai na query string —
 * URL de upgrade aparece em log de proxy — e nunca é escrito em log.
 *
 * TODO(origem): o CORS da API não protege este canal. WebSocket não é barrado pela
 * same-origin policy, então qualquer página aberta em um navegador consegue abrir a
 * conexão. Quando a credencial entrar, recusar também `Origin` de navegador — o Desktop
 * nunca envia esse header.
 */

export type AuthorizationResult = { authorized: true } | { authorized: false; reason: string }

/** Extrai o token do header `Authorization: Bearer <token>`, sem nunca devolvê-lo a log. */
export function extractStationToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization

  if (!header) {
    return null
  }

  const [scheme, token] = header.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token.trim() || null
}

export function authorizeHandshake(_request: FastifyRequest): AuthorizationResult {
  return { authorized: true }
}
