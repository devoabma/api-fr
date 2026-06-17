export class UnauthorizedError extends Error {
  constructor(message?: string) {
    super(message ?? 'Token expirado ou inválido. Por favor, faça login novamente.')
  }
}
