## 1. Listagem de salas

- [x] 1.1 Criar `get-all.ts` com rota `GET /rooms/get-all` protegida por `auth`
- [x] 1.2 Restringir a ADMIN via `request.checkIfEmployeeIsAdmin()`
- [x] 1.3 Recuperar todas as salas via `findMany`, ordenadas por `createdAt` desc, incluindo os `computers` de cada sala
- [x] 1.4 Responder `200` com `{ rooms }`

## 2. Edição de sala

- [x] 2.1 Criar `update.ts` com rota `PATCH /rooms/update/:id` protegida por `auth`
- [x] 2.2 Restringir a ADMIN via `request.checkIfEmployeeIsAdmin()`
- [x] 2.3 Validar `id` (cuid2) no params e body parcial (`name`, `standardTime`, `description` opcionais)
- [x] 2.4 Rejeitar com `404` (`NotFoundError`) quando a sala não existir
- [x] 2.5 Quando `name` muda: normalizar para maiúsculas, regerar `slug` e rejeitar com `400` se outra sala (`id: { not: id }`) já tiver o mesmo slug
- [x] 2.6 Não tocar no slug quando o nome não muda; montar `dataToUpdate` apenas com os campos enviados
- [x] 2.7 Responder `200` com `{ message }`

## 3. Registro e verificação

- [x] 3.1 Registrar as rotas em `routes/index.ts` sob o prefixo `/rooms`
- [x] 3.2 `npx tsc --noEmit` sem erros
- [x] 3.3 `npx biome check` sem issues
- [ ] 3.4 Validar manualmente os fluxos `200`/`400`/`401` (ADMIN e não-ADMIN)
