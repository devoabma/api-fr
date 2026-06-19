## 1. Inativação de sala (concluída)

- [x] 1.1 Criar `deactivate.ts` com rota `PATCH /rooms/deactivate/:id` protegida por `auth`
- [x] 1.2 `checkIfEmployeeIsAdmin()` como primeira etapa do handler
- [x] 1.3 `404` quando a sala não existe
- [x] 1.4 `400` quando já está inativa (idempotência)
- [x] 1.5 Gravar `inactive` com a data/hora atual e responder `200`

## 2. Ativação de sala (concluída)

- [x] 2.1 Criar `activate.ts` com rota `PATCH /rooms/activate/:id` protegida por `auth`
- [x] 2.2 `checkIfEmployeeIsAdmin()` como primeira etapa do handler
- [x] 2.3 `404` quando a sala não existe
- [x] 2.4 `400` quando já está ativa (idempotência)
- [x] 2.5 Zerar `inactive` (`null`) e responder `200`

## 3. Listagem expõe status (concluída)

- [x] 3.1 Incluir `inactive` no `select` e no schema de resposta `200` de `get-all.ts`

## 4. Registro e verificação

- [x] 4.1 Registrar as duas rotas em `routes/index.ts` sob o prefixo `/rooms`
- [x] 4.2 `npx tsc --noEmit` sem erros
- [ ] 4.3 Validar manualmente os fluxos `200`/`400`/`404`/`401` de cada endpoint
