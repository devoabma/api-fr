import 'fastify'
import type { Roles } from '../../generated/prisma/enums'

declare module 'fastify' {
  export interface FastifyRequest {
    getIdCurrentEmployee(): Promise<string>
    getCurrentEmployee(): Promise<{ id: string; role: Roles }>
    checkIfEmployeeIsAdmin(): Promise<void>
  }
}
