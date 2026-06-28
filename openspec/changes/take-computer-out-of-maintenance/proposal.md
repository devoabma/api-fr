## Why

A change `put-computer-into-maintenance` entregou apenas a metade do ciclo: marcar uma máquina como em manutenção. Faltava o caminho de volta — **retirar o computador da manutenção** para que ele volte a ficar elegível para uso. Sem isso, uma máquina consertada permaneceria bloqueada indefinidamente. Esta change fecha o ciclo de disponibilidade.

## What Changes

- **Novo caso de uso `take-out-of-maintenance.ts`** (`PATCH /computers/maintenance/:id/remove`): rota autenticada que retira um computador da manutenção, zerando o campo `maintenance` (`DateTime?`).
- **Permissão híbrida (operação, não inventário)**: mesma regra do `put` — **ADMIN** retira qualquer computador da manutenção; **funcionário comum** apenas os de salas vinculadas a ele (`room.employeesRooms`). Computador inexistente ou fora do escopo → `404`. Sem JWT → `401`.
- **Idempotência**: se o computador não está em manutenção (`maintenance` nulo) → `400`.
- **Estado resultante**: ao sair da manutenção, a rota grava `maintenance = null`. A máquina volta a ficar disponível (`inUse`/`currentLawyerId` já estavam zerados desde a entrada em manutenção, então não precisam ser tocados).
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/computers`.

## Capabilities

### Modified Capabilities
- `computer`: além de colocar em manutenção, agora permite **retirar um computador da manutenção** (ADMIN em qualquer máquina; funcionário comum nas máquinas de suas salas), fechando o ciclo de disponibilidade.

## Impact

- Código novo: `src/http/core/computers/take-out-of-maintenance.ts`; alteração em `src/http/routes/index.ts`.
- Contrato HTTP: novo endpoint `PATCH /computers/maintenance/:id/remove`, exigindo JWT; ADMIN alcança qualquer computador, funcionário comum só os de suas salas; sucesso → `200` com `{ message }`; não estava em manutenção → `400`; computador inexistente ou fora do escopo → `404`; sem JWT → `401`.
- Banco: usa o modelo `computers` já existente; nenhuma migração.
- Documentação: `docs/ROADMAP.md` registra o ciclo de manutenção (colocar + retirar) como concluído.
