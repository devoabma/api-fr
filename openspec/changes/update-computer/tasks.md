## 1. Caso de uso de edição

- [x] 1.1 Criar `update.ts` com rota `PATCH /computers/update/:id` protegida por `auth`
- [x] 1.2 Restringir a ADMIN via `request.checkIfEmployeeIsAdmin()`
- [x] 1.3 Validar `id` (cuid) no path e body com `macCode`/`number`/`description`/`roomId` todos opcionais
- [x] 1.4 Rejeitar com `404` quando o computador não existir
- [x] 1.5 Quando `macCode` enviado: normalizar via `formattedCodeMac`, rejeitar `400` se ≠ 17 chars e `400` se colidir com outro computador (excluindo o próprio)
- [x] 1.6 Quando `roomId` enviado: rejeitar `404` se a sala não existir
- [x] 1.7 Calcular a sala efetiva (`roomId ?? sala atual`) e revalidar `number` único na sala efetiva quando `number` ou `roomId` mudam (excluindo o próprio) → `400`
- [x] 1.8 Revalidar `description` (maiúsculas) única na sala efetiva quando `description` ou `roomId` mudam (excluindo o próprio) → `400`
- [x] 1.9 Persistir somente os campos enviados e responder `200` com `{ message }`

## 2. Registro e verificação

- [x] 2.1 Registrar a rota em `routes/index.ts` sob o prefixo `/computers`
- [x] 2.2 `npx tsc --noEmit` e `biome check` sem erros
- [ ] 2.3 Validar manualmente os fluxos `200`/`400`/`404`/`401` (ADMIN e não-ADMIN, incluindo troca de sala)
