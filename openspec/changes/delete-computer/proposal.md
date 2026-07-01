## Why

O roadmap (seção 3 — Computadores) prevê o ciclo completo de gestão de inventário das máquinas (cadastrar, listar, editar e **remover**). Faltava o caso de uso para **deletar um computador** do inventário. Sem ele, máquinas descomissionadas permanecem no banco e continuam aparecendo nas listagens. Esta change fecha o CRUD de computadores entregando a remoção definitiva, protegendo sessões de advogados em andamento e limpando o histórico dependente de forma consistente.

## What Changes

- **Novo caso de uso `delete.ts`** (`DELETE /computers/delete/:id`): rota autenticada que remove um computador do inventário.
- **Permissão restrita a ADMIN (inventário, não operação)**: a rota usa `request.checkIfEmployeeIsAdmin()`. Diferente de manutenção/uso (operação, permissão híbrida), remover do inventário é ação de gestão e MUST ser exclusiva de ADMIN. Sem JWT → `401`; funcionário comum → `403`.
- **Protege sessão em andamento**: se o computador está em uso (`inUse`), a API recusa com `400` em vez de derrubar a sessão do advogado silenciosamente — a sessão MUST ser encerrada antes.
- **Remoção em cascata do histórico dependente**: a relação `ComputerSessions.computer` passa a usar `onDelete: Cascade`, de modo que deletar o computador remove suas sessões de histórico. `Printers` já era `Cascade`. Assim o delete não falha por violação de foreign key.
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/computers`.

## Capabilities

### Modified Capabilities
- `computer`: além de cadastrar, listar, editar e gerenciar manutenção, agora permite **deletar um computador do inventário** (ADMIN-only), protegendo sessões ativas e removendo o histórico dependente em cascata.

## Impact

- Código novo: `src/http/core/computers/delete.ts`; alteração em `src/http/routes/index.ts`.
- Contrato HTTP: novo endpoint `DELETE /computers/delete/:id`, exigindo JWT de ADMIN; sucesso → `200` com `{ message }`; computador em uso → `400`; computador inexistente → `404`; sem JWT → `401`; funcionário comum → `403`.
- Banco: **migração** `20260701003534_computer_sessions_cascade_on_delete` altera a FK de `computer_sessions` para `ON DELETE CASCADE`. Deletar um computador remove permanentemente seu histórico de sessões — decisão consciente do projeto (auditoria não é preservada nesta fase).
- Documentação: `docs/ROADMAP.md` registra "Deletar computador" como concluído.
