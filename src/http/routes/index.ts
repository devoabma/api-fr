import type { FastifyInstance } from 'fastify'
import { authenticate } from '../core/employees/authenticate'
import { createAccount } from '../core/employees/create-account'
import { getProfile } from '../core/employees/get-profile'

export async function appRoutes(app: FastifyInstance) {
  /* Employees (Funcionários) */
  app.register(createAccount, { prefix: '/employees' })
  app.register(authenticate, { prefix: '/employees' })
  app.register(getProfile, { prefix: '/employees' })
}
