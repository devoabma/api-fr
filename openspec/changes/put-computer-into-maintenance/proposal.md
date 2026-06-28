## Why

O roadmap (seção 3 — Computadores) prevê o ciclo de disponibilidade de uma máquina (`inUse`/`maintenance`), mas não havia caso de uso para **colocar um computador em manutenção**. Sem isso, uma máquina com defeito permanece elegível para uso pelos advogados. Esta change entrega o primeiro passo desse ciclo: marcar a máquina como em manutenção, registrando o instante e protegendo a sessão de um advogado em andamento.

## What Changes

- **Novo caso de uso `put-into-maintenance.ts`** (`PATCH /computers/maintenance/:id`): rota protegida que coloca um computador em manutenção, registrando o instante em `maintenance` (`DateTime?`, que serve de auditoria de quando entrou em manutenção).
- **Somente ADMIN**: a rota chama `request.checkIfEmployeeIsAdmin()`; funcionário não-ADMIN ou sem JWT recebe `401`. O ADMIN pode colocar qualquer computador em manutenção, sem precisar estar vinculado à sala. Computador inexistente → `404`.
- **Idempotência**: se o computador já está em manutenção (`maintenance` não-nulo) → `400`.
- **Protege sessão em andamento**: se o computador está em uso (`inUse`), a API recusa com `400` em vez de derrubar a sessão do advogado silenciosamente — a sessão MUST ser encerrada antes.
- **Estado consistente**: ao entrar em manutenção, além de gravar `maintenance`, a rota zera `inUse` (`false`) e desvincula o advogado (`currentLawyerId = null`).
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/computers`.

## Capabilities

### Modified Capabilities
- `computer`: além de cadastrar, listar e editar, agora permite **colocar um computador em manutenção** (restrito a ADMIN), protegendo sessões ativas.

## Impact

- Código novo: `src/http/core/computers/put-into-maintenance.ts`; alteração em `src/http/routes/index.ts`.
- Contrato HTTP: novo endpoint `PATCH /computers/maintenance/:id`, exigindo JWT de ADMIN; sucesso → `200` com `{ message }`; já em manutenção ou em uso → `400`; computador inexistente → `404`; sem JWT ou sem permissão → `401`.
- Banco: usa o modelo `computers` já existente; nenhuma migração.
- Pendência relacionada (fora desta change): retirar de manutenção (`maintenance = null`) — fecha o ciclo e ainda não tem rota.
- Documentação: `docs/ROADMAP.md` registra "Colocar computador em manutenção" como concluído.
