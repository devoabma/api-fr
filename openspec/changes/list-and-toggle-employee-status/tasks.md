## 1. Listagem de funcionários (concluída)

- [x] 1.1 Criar `get-all.ts` com rota `GET /employees/get-all` protegida por `auth`
- [x] 1.2 `checkIfEmployeeIsAdmin()` como primeira etapa do handler
- [x] 1.3 Retornar campos públicos via `select` (`id`, `name`, `cpf`, `email`, `imageUrl`, `role`, `inactive`)
- [x] 1.4 Declarar `security: [{ bearerAuth: [] }]` e schema de resposta `200`

## 2. Inativação (concluída)

- [x] 2.1 Criar `deactivate.ts` com rota `PATCH /employees/deactivate/:id`
- [x] 2.2 `404` quando o funcionário não existe
- [x] 2.3 `400` quando já está inativo (idempotência)
- [x] 2.4 `400` ao tentar inativar o próprio cadastro
- [x] 2.5 Gravar `inactive` com a data/hora atual e responder `200`

## 3. Ativação (concluída)

- [x] 3.1 Criar `activate.ts` com rota `PATCH /employees/activate/:id`
- [x] 3.2 `404` quando o funcionário não existe
- [x] 3.3 `400` quando já está ativo (idempotência)
- [x] 3.4 Zerar `inactive` (`null`) e responder `200`

## 4. Registro e verificação

- [x] 4.1 Registrar as três rotas em `routes/index.ts` sob o prefixo `/employees`
- [x] 4.2 `npx tsc --noEmit` sem erros
- [ ] 4.3 Validar manualmente os fluxos `200`/`400`/`404`/`401` de cada endpoint
