import type { FastifyInstance } from 'fastify'
import { fastifyPlugin } from 'fastify-plugin'
import { prisma } from '@/lib/prisma'
import { UnauthorizedError } from '../_errors/unauthorized'

export const auth = fastifyPlugin(async (app: FastifyInstance) => {
  app.addHook('preHandler', async request => {
    // Verifica se o usuário está autenticado e retorna o ID do funcionário
    request.getIdCurrentEmployee = async () => {
      try {
        const { sub } = await request.jwtVerify<{ sub: string }>()

        return sub
      } catch {
        throw new UnauthorizedError()
      }
    }

    request.checkIfEmployeeIsAdmin = async () => {
      const currentEmployeeId = await request.getIdCurrentEmployee()

      const employee = await prisma.employees.findUnique({
        where: {
          id: currentEmployeeId,
        },
        select: {
          role: true,
        },
      })

      if (!employee || employee.role !== 'ADMIN') {
        throw new UnauthorizedError('Acesso negado. Você não possui permissão para executar essa operação.')
      }
    }
  })
})
