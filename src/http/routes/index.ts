import type { FastifyInstance } from 'fastify'
import { activateEmployee } from '../core/employees/activate'
import { authenticate } from '../core/employees/authenticate'
import { changePassword } from '../core/employees/change-password'
import { createAccount } from '../core/employees/create-account'
import { deactivateEmployee } from '../core/employees/deactivate'
import { getAllEmployees } from '../core/employees/get-all'
import { getProfile } from '../core/employees/get-profile'
import { requestPasswordRecovery } from '../core/employees/request-password-recovery'
import { resetPassword } from '../core/employees/reset-password'
import { updateEmployee } from '../core/employees/update'
import { updateEmployeeImage } from '../core/employees/update-image'
import { activateRoom } from '../core/rooms/activate'
import { createRoom } from '../core/rooms/create'
import { deactivateRoom } from '../core/rooms/deactivate'
import { getAllRooms } from '../core/rooms/get-all'
import { updateRoom } from '../core/rooms/update'

export async function appRoutes(app: FastifyInstance) {
  /* Employees (Funcionários) */
  app.register(createAccount, { prefix: '/employees' })
  app.register(authenticate, { prefix: '/employees' })
  app.register(getProfile, { prefix: '/employees' })
  app.register(requestPasswordRecovery, { prefix: '/employees' })
  app.register(resetPassword, { prefix: '/employees' })
  app.register(getAllEmployees, { prefix: '/employees' })
  app.register(deactivateEmployee, { prefix: '/employees' })
  app.register(activateEmployee, { prefix: '/employees' })
  app.register(changePassword, { prefix: '/employees' })
  app.register(updateEmployee, { prefix: '/employees' })
  app.register(updateEmployeeImage, { prefix: '/employees' })

  /* Rooms (Salas) */
  app.register(createRoom, { prefix: '/rooms' })
  app.register(getAllRooms, { prefix: '/rooms' })
  app.register(updateRoom, { prefix: '/rooms' })
  app.register(activateRoom, { prefix: '/rooms' })
  app.register(deactivateRoom, { prefix: '/rooms' })
}
