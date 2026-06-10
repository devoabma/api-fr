## 1. Tratamento global de erros (concluída)

- [x] 1.1 Criar classes de erro em `src/http/_errors/`: `BadRequestError`, `NotFoundError`, `UnauthorizedError` (com mensagem padrão)
- [x] 1.2 Criar `errorHandler` em `src/http/_errors/index.ts` mapeando validação Zod, erros de domínio e `AxiosError`
- [x] 1.3 Registrar `app.setErrorHandler(errorHandler)` em `src/http/app.ts` antes das rotas
- [x] 1.4 Adicionar fallback `500` com log do erro no servidor

## 2. Middleware de autenticação/autorização (concluída)

- [x] 2.1 Criar `src/http/middleware/auth.ts` com `fastify-plugin` e hook `preHandler`
- [x] 2.2 Implementar `request.getIdCurrentEmployee()` validando o JWT e retornando `sub`
- [x] 2.3 Implementar `request.checkIfEmployeeIsAdmin()` exigindo `role: 'ADMIN'`
- [x] 2.4 Declarar os métodos em `src/types/fastify.d.ts` (augmentação de `FastifyRequest`)
- [x] 2.5 Adicionar dependência `fastify-plugin`

## 3. Endpoint de perfil (concluída)

- [x] 3.1 Criar `src/http/core/employees/get-profile.ts` com `GET /profile` tipado e protegido por `auth`
- [x] 3.2 Definir schema de resposta `200` (`id`, `name`, `cpf`, `email`, `imageUrl`, `role`)
- [x] 3.3 Buscar funcionário por id com `select` enxuto e lançar `NotFoundError` se ausente
- [x] 3.4 Registrar `getProfile` em `src/http/routes/index.ts` com prefixo `/employees`

## 4. Refactor dos casos de uso existentes (concluída)

- [x] 4.1 `authenticate.ts`: trocar `reply.status(400)` por `throw new UnauthorizedError(...)` (credenciais inválidas e inativo passam a `401`)
- [x] 4.2 `create-account.ts`: trocar duplicidade de CPF/e-mail por `BadRequestError`
- [x] 4.3 `create-account.ts`: remover `$transaction` e enviar e-mail fora da transação, não-fatal (apenas `request.log.error` em caso de falha)
- [x] 4.4 Adicionar dependência `axios`

## 5. Verificação

- [ ] 5.1 `GET /employees/profile` sem token retorna `401`
- [ ] 5.2 `GET /employees/profile` com token válido retorna `200` e o perfil do funcionário
- [ ] 5.3 Login com credenciais inválidas retorna `401` (não mais `400`)
- [ ] 5.4 Erro de validação Zod retorna `400` com lista de `{ field, message }`
- [ ] 5.5 Cadastro persiste o funcionário mesmo quando o envio do e-mail falha (apenas loga)

## 6. Melhorias futuras (opcional)

- [ ] 6.1 Avaliar middleware de autorização global em vez de registrar `auth` por rota
- [ ] 6.2 Reprocessar/reenfileirar e-mails de boas-vindas que falharam (a partir do log)
- [ ] 6.3 Distinguir token ausente de expirado em `getIdCurrentEmployee`
