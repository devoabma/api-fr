## Why

O change `list-member-rooms` criou uma segunda rota (`GET /rooms/get-member-rooms`) só para a visão do funcionário, mantendo `GET /rooms/get-all` restrito a ADMIN. Isso duplicou schema, `select` e lógica de listagem entre dois arquivos que retornam o mesmo contrato de sala. Como o cliente (app desktop + front web) sempre pede "as salas que eu posso ver", faz mais sentido **uma única rota** que decide o escopo pelo papel do funcionário autenticado.

## What Changes

- **Rota única `GET /rooms/get-all` por papel**: a rota deixa de exigir ADMIN e passa a escopar o resultado pelo papel:
  - `ADMIN` → inventário completo (inclusive salas inativas), `where: {}`.
  - `MEMBER` → apenas salas **ativas** (`inactive: null`) às quais está vinculado (`employeesRooms: { some: { employeeId } }`).
- **Novo helper `request.getCurrentEmployee()`**: retorna `{ id, role }` do funcionário autenticado em uma única query, para decidir fluxo por papel **sem lançar erro** (ao contrário de `checkIfEmployeeIsAdmin()`, que só bloqueia). Lança `401` apenas se o token for válido mas o funcionário não existir mais. O `checkIfEmployeeIsAdmin()` passa a reusar esse helper.
- **Remoção de `get-member-rooms.ts`** e do seu registro em `routes/index.ts`: a rota `GET /rooms/get-member-rooms` deixa de existir; seu comportamento vive agora dentro de `get-all`.

Supersede o change `list-member-rooms`.

## Capabilities

### Modified Capabilities
- `room`: a listagem de salas passa a ser servida por uma rota única (`get-all`) cujo escopo depende do papel — ADMIN vê tudo, MEMBER vê apenas as próprias salas ativas —, e a rota dedicada do membro (`get-member-rooms`) é removida.

## Impact

- Código: remove `src/http/core/rooms/get-member-rooms.ts`; altera `src/http/core/rooms/get-all.ts`, `src/http/middleware/auth.ts`, `src/http/routes/index.ts` e o tipo `FastifyRequest` em `src/types/fastify.d.ts`.
- Banco: usa `rooms`, `employees_rooms` e `computers` já existentes; nenhuma migração.
- Contrato HTTP (breaking para quem consumia a rota do membro):
  - `GET /rooms/get-member-rooms` → **removida** (404).
  - `GET /rooms/get-all` → agora acessível a qualquer funcionário autenticado; ADMIN recebe todas as salas, MEMBER recebe apenas as suas salas ativas; sem JWT → `401`.
- Documentação: `docs/ROADMAP.md` consolida os dois casos de uso de listagem em um só.
