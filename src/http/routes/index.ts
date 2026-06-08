import type { FastifyInstance } from 'fastify'

import { createAccount } from '../core/employees/create-account'

export async function appRoutes(app: FastifyInstance) {
  app.register(createAccount, { prefix: '/employees' })
}
