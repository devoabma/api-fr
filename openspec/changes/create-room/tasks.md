## 1. Caso de uso de criação

- [x] 1.1 Adicionar dependência `slugify`
- [x] 1.2 Criar `create.ts` com rota `POST /rooms/create` protegida por `auth`
- [x] 1.3 Restringir a ADMIN via `request.checkIfEmployeeIsAdmin()`
- [x] 1.4 Validar body: `name` obrigatório, `standardTime` inteiro positivo opcional, `description` opcional
- [x] 1.5 Normalizar `name` para maiúsculas
- [x] 1.6 Gerar `slug` via `slugify` (`lower`, `strict`) e rejeitar com `400` em caso de slug duplicado (`findUnique`)
- [x] 1.7 Criar a sala e responder `201` com `{ roomId }`

## 2. Registro e verificação

- [x] 2.1 Registrar a rota em `routes/index.ts` sob o prefixo `/rooms`
- [x] 2.2 `npx tsc --noEmit` sem erros
- [ ] 2.3 Validar manualmente os fluxos `201`/`400`/`401` (ADMIN e não-ADMIN)
