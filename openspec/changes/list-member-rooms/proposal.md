## Why

Depois que o ADMIN vincula um funcionário a salas (change `link-employee-to-rooms`), o próprio funcionário (papel `MEMBER`) precisa enxergar, no app desktop/web, apenas as salas que lhe pertencem para operar os computadores. Hoje só existe `GET /rooms/get-all` (restrito a ADMIN), que lista todas as salas. Falta a visão do membro: somente as salas **ativas** às quais ele está vinculado, já com a disponibilidade de cada computador.

## What Changes

- **Novo caso de uso `get-member-rooms.ts`** (`GET /rooms/get-member-rooms`): rota protegida que recupera apenas as salas às quais o funcionário autenticado está vinculado, escopadas pelo `employeeId` de `request.getIdCurrentEmployee()` via filtro `employeesRooms: { some: { employeeId } }`. Não exige ADMIN — cada funcionário vê só as próprias salas.
- **Apenas salas ativas**: o filtro inclui `inactive: null`, de modo que salas desativadas após o vínculo não aparecem para o membro.
- **Disponibilidade dos computadores no payload**: cada computador retorna `inUse` e `maintenance` (além de `id`, `macCode`, `number`, `description`), permitindo ao cliente saber o que está livre.
- **`get-all.ts` passa a expor disponibilidade**: a listagem de ADMIN também inclui `inUse` e `maintenance` em cada computador, alinhando o contrato com a visão do membro.
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/rooms`.

## Capabilities

### Modified Capabilities
- `room`: a capability passa a cobrir a listagem das salas de um funcionário (somente ativas, escopadas pelo vínculo), e a listagem de ADMIN (`get-all`) passa a incluir a disponibilidade (`inUse`, `maintenance`) de cada computador.

## Impact

- Código novo: `src/http/core/rooms/get-member-rooms.ts`; alterações em `src/http/core/rooms/get-all.ts` e `src/http/routes/index.ts`.
- Banco: usa os modelos `rooms`, `employees_rooms` e `computers` já existentes; nenhuma migração.
- Contrato HTTP:
  - `GET /rooms/get-member-rooms` → `200` com `{ rooms }` (somente salas ativas do funcionário, cada uma com `computers` incluindo `inUse`/`maintenance`); sem JWT → `401`.
  - `GET /rooms/get-all` → resposta passa a incluir `inUse`/`maintenance` em cada computador (mudança aditiva no payload).
- Documentação: `docs/ROADMAP.md` e `docs/DOC.md` registram a nova listagem do membro e a disponibilidade dos computadores.
