## Why

A listagem `GET /rooms/get-all` (entregue em `list-and-update-rooms`) retorna cada sala com seus computadores, mas não mostra quais funcionários estão vinculados a ela. Com o vínculo funcionário↔sala já implementado (`link-employee-to-rooms` / `unlink-employee-from-rooms`), o ADMIN precisa enxergar, na própria listagem de salas, quem opera cada sala — para conferir e gerir os vínculos sem cruzar endpoints.

## What Changes

- **`get-all.ts`** (`GET /rooms/get-all`): cada sala passa a incluir `employeesRooms`, uma lista dos funcionários vinculados (via `employees_rooms`), trazendo de cada funcionário apenas `id`, `name` e `imageUrl`. O `select` do Prisma e o schema de resposta Zod foram estendidos de forma consistente. A rota continua restrita a ADMIN e ordenada por `createdAt` desc.

## Capabilities

### Modified Capabilities
- `room`: a listagem de todas as salas passa a incluir, além dos computadores, os funcionários vinculados a cada sala (`id`, `name`, `imageUrl`).

## Impact

- Código alterado: `src/http/core/rooms/get-all.ts` (apenas o `select` e o schema `200`).
- Banco: usa os modelos `EmployeesRooms` e `Employees` já existentes; nenhuma migração.
- Contrato HTTP: `GET /rooms/get-all` → `200` com `{ rooms: [...] }`, agora cada sala com `employeesRooms: [{ employees: { id, name, imageUrl } }]` além de `computers`; sem JWT/permissão → `401`.
- Documentação: `docs/ROADMAP.md` detalha que a listagem de salas inclui os funcionários vinculados.
