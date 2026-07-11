import type { FastifyInstance } from 'fastify'
import { createComputer } from '../core/computers/create'
import { deleteComputer } from '../core/computers/delete'
import { getAllComputers } from '../core/computers/get-all'
import { putIntoMaintenanceComputer } from '../core/computers/put-into-maintenance'
import { takeOutOfMaintenanceComputer } from '../core/computers/take-out-of-maintenance'
import { updateComputer } from '../core/computers/update'
import { activateEmployee } from '../core/employees/activate'
import { authenticate } from '../core/employees/authenticate'
import { changePassword } from '../core/employees/change-password'
import { createAccount } from '../core/employees/create-account'
import { deactivateEmployee } from '../core/employees/deactivate'
import { getAllEmployees } from '../core/employees/get-all'
import { getProfile } from '../core/employees/get-profile'
import { linkWithRooms } from '../core/employees/link-with-rooms'
import { requestPasswordRecovery } from '../core/employees/request-password-recovery'
import { resetPassword } from '../core/employees/reset-password'
import { unlinkWithRooms } from '../core/employees/unlink-with-rooms'
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

  /* Employees (Funcionários) e Salas (Salas) */
  app.register(linkWithRooms, { prefix: '/employees' })
  app.register(unlinkWithRooms, { prefix: '/employees' })

  /* Rooms (Salas) */
  app.register(createRoom, { prefix: '/rooms' })
  app.register(getAllRooms, { prefix: '/rooms' })
  app.register(updateRoom, { prefix: '/rooms' })
  app.register(activateRoom, { prefix: '/rooms' })
  app.register(deactivateRoom, { prefix: '/rooms' })

  /* Computers (Computadores) */
  app.register(createComputer, { prefix: '/computers' })
  app.register(getAllComputers, { prefix: '/computers' })
  app.register(updateComputer, { prefix: '/computers' })
  app.register(putIntoMaintenanceComputer, { prefix: '/computers' })
  app.register(takeOutOfMaintenanceComputer, { prefix: '/computers' })
  app.register(deleteComputer, { prefix: '/computers' })
}
