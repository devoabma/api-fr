import { AxiosError } from 'axios'
import type { FastifyInstance } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { BadRequestError } from './bad-request'
import { NotFoundError } from './not-found'
import { TooManyRequestsError } from './too-many-requests'
import { UnauthorizedError } from './unauthorized'

type FastifyErrorHandler = FastifyInstance['errorHandler']

/** Traduções dos erros 4xx que nascem no próprio Fastify, antes de qualquer código nosso rodar. */
const FRAMEWORK_ERROR_MESSAGES: Record<string, string> = {
  FST_ERR_CTP_BODY_TOO_LARGE: 'Corpo da requisição maior que o limite permitido.',
  FST_ERR_CTP_INVALID_MEDIA_TYPE: 'Formato de conteúdo não suportado nesta rota.',
  FST_ERR_CTP_INVALID_CONTENT_LENGTH: 'Tamanho declarado do corpo da requisição não confere com o enviado.',
  FST_ERR_CTP_EMPTY_JSON_BODY: 'Corpo da requisição vazio.',
}

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

  if (error instanceof TooManyRequestsError) {
    return reply.status(429).send({
      message: error.message,
      retryAfterInSeconds: error.retryAfterInSeconds,
    })
  }

  // Erro global disparado se não houver advogado ou API indisponível
  if (error instanceof AxiosError) {
    return reply.status(404).send({
      message: 'Consulta indisponível ou advogado(a) não encontrado.',
    })
  }

  // Arquivo enviado excede o limite definido no @fastify/multipart (global ou por rota)
  if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
    return reply.status(413).send({
      message: 'Arquivo muito grande. Verifique o tamanho máximo permitido para este envio.',
    })
  }

  /**
   * Rede de segurança para os 4xx do próprio Fastify (corpo grande demais, mídia não
   * suportada, URL malformada). Sem ela o cliente recebia `500 Erro interno do servidor`
   * por um problema que é dele — e o log de erro enchia de ruído que não é bug da API.
   *
   * A mensagem original do framework vem em inglês e descreve o Fastify, não o domínio,
   * então só o status é aproveitado; o texto sai daqui, em pt-BR como o resto da API.
   */
  const { statusCode, code } = error as { statusCode?: number; code?: string }

  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    return reply.status(statusCode).send({
      message: FRAMEWORK_ERROR_MESSAGES[code ?? ''] ?? 'Requisição inválida. Verifique os dados enviados.',
    })
  }

  //TODO: Enviar erro para alguma plataforma de observabilidade
  console.error(error)

  return reply.status(500).send({
    message: 'Erro interno do servidor. Tente novamente mais tarde.',
  })
}
