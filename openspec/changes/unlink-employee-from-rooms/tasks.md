## 1. Desvínculo funcionário-salas (concluída)

- [x] 1.1 Criar `unlink-with-rooms.ts` com rota `POST /employees/unlink-with-rooms` protegida por `auth`
- [x] 1.2 `checkIfEmployeeIsAdmin()` como primeira etapa do handler
- [x] 1.3 Body validado por Zod (`employeeId: cuid2`, `roomIds: cuid2[]` com `.min(1)`)
- [x] 1.4 Deduplicar `roomIds` antes da remoção (`[...new Set(...)]`)
- [x] 1.5 `404` quando o funcionário não existe
- [x] 1.6 Remover os vínculos via `deleteMany` e usar o `count` retornado
- [x] 1.7 `404` quando `count === 0` (nenhum vínculo nas salas informadas)
- [x] 1.8 Responder `200` em caso de sucesso
- [x] 1.9 Usar `POST` (não `DELETE`) por conta do body com lista

## 2. Registro e verificação

- [x] 2.1 Registrar a rota em `routes/index.ts` sob o prefixo `/employees`
- [x] 2.2 `npx tsc --noEmit` sem erros
- [x] 2.3 `npx biome check` sem issues
- [ ] 2.4 Validar manualmente os fluxos `200`/`404`/`401`
