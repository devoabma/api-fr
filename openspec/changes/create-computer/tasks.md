## 1. Caso de uso de criação

- [x] 1.1 Criar `create.ts` com rota `POST /computers/create` protegida por `auth`
- [x] 1.2 Restringir a ADMIN via `request.checkIfEmployeeIsAdmin()`
- [x] 1.3 Validar body: `macCode` obrigatório, `number` inteiro positivo obrigatório, `description` obrigatório, `roomId` cuid
- [x] 1.4 Criar util `formattedCodeMac` (remove separadores, maiúsculas, reaplica `AA-BB-CC-DD-EE-FF`) e rejeitar com `400` quando o resultado não tiver 17 caracteres
- [x] 1.5 Normalizar `description` para maiúsculas
- [x] 1.6 Rejeitar com `400` MAC duplicado (global, `findUnique`)
- [x] 1.7 Rejeitar com `404` quando a `roomId` não existir
- [x] 1.8 Rejeitar com `400` `number` duplicado na mesma sala e `description` duplicada na mesma sala
- [x] 1.9 Criar o computador e responder `201` com `{ macCode }`

## 2. Registro e verificação

- [x] 2.1 Registrar a rota em `routes/index.ts` sob o prefixo `/computers`
- [x] 2.2 `npx tsc --noEmit` sem erros
- [ ] 2.3 Validar manualmente os fluxos `201`/`400`/`404`/`401` (ADMIN e não-ADMIN)
