import 'fastify'

declare module 'fastify' {
  export interface FastifyRequest {
    getIdCurrentEmployee(): Promise<string>
    checkIfEmployeeIsAdmin(): Promise<void>
  }
}
