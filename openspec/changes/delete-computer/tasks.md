## 1. Caso de uso de remoção de computador

- [x] 1.1 Criar `delete.ts` com rota `DELETE /computers/delete/:id` protegida por `auth`
- [x] 1.2 Restringir a ação a ADMIN via `request.checkIfEmployeeIsAdmin()` e validar `id` (cuid) no path
- [x] 1.3 Carregar o computador por `id`; inexistente → `404`
- [x] 1.4 Rejeitar com `400` quando o computador estiver em uso (`inUse`), protegendo a sessão do advogado
- [x] 1.5 Deletar o computador; responder `200` com `{ message }`

## 2. Banco — cascata do histórico dependente

- [x] 2.1 Ajustar `ComputerSessions.computer` para `onDelete: Cascade` no `schema.prisma`
- [x] 2.2 Gerar e aplicar migração (`20260701003534_computer_sessions_cascade_on_delete`)

## 3. Registro e verificação

- [x] 3.1 Registrar a rota em `routes/index.ts` sob o prefixo `/computers`
- [x] 3.2 `npx tsc --noEmit` sem erros
- [ ] 3.3 Validar manualmente os fluxos `200`/`400`/`404`/`401`/`403` (ADMIN, funcionário comum, em uso, inexistente)
