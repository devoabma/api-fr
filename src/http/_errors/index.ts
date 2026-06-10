import { AxiosError } from 'axios'
import type { FastifyInstance } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { BadRequestError } from './bad-request'
import { NotFoundError } from './not-found'
import { UnauthorizedError } from './unauthorized'

type FastifyErrorHandler = FastifyInstance['errorHandler']

export const errorHandler: FastifyErrorHandler = (error, _request, reply) => {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.status(400).send({
      message: 'Erro na validação, verifique os dados enviados.',
      errors: error.validation.map(issue => ({
        // Remove o / do inicio da string
        field: issue.instancePath.replace(/^\//, ''),
        message: issue.message,
      })),
    })
  }

  if (error instanceof BadRequestError) {
    return reply.status(400).send({
      message: error.message,
    })
  }

  if (error instanceof NotFoundError) {
    return reply.status(404).send({
      message: error.message,
    })
  }

  if (error instanceof UnauthorizedError) {
    return reply.status(401).send({
      message: error.message,
    })
  }

  // Erro global disparado se não houver advogado ou API indisponível
  if (error instanceof AxiosError) {
    return reply.status(404).send({
      message: 'Consulta indisponível ou advogado(a) não encontrado.',
    })
  }

  //TODO: Enviar erro para alguma plataforma de observabilidade
  console.error(error)

  return reply.status(500).send({
    message: 'Erro interno do servidor. Tente novamente mais tarde.',
  })
}
