## Why

`GET /rooms/get-all` já ordena as salas por `createdAt` desc, mas **não devolve** esse campo no response. O painel web e o app desktop recebem a lista na ordem certa sem conseguir mostrar *quando* a sala foi cadastrada — não dá para exibir "criada em", agrupar por período nem reordenar no cliente (por exemplo, ao filtrar ou paginar em memória) sem perder a informação de data. Como o campo já existe no modelo `Rooms` e já é usado no `orderBy`, expô-lo custa uma linha no `select` e fecha essa lacuna.

## What Changes

- **`createdAt` no response de `GET /rooms/get-all`**: adicionado ao `select` do Prisma e ao schema Zod de resposta (`z.date()`), junto dos demais campos da sala.
- Vale para os dois papéis: ADMIN (que vê o inventário completo, inclusive salas inativas) e MEMBER (que vê apenas as próprias salas ativas) recebem o novo campo.
- Nenhuma mudança de filtro, ordenação ou permissão.

## Capabilities

### Modified Capabilities
- `room`: a listagem de salas passa a incluir `createdAt` em cada item de `rooms`.

## Impact

- Código: altera apenas `src/http/core/rooms/get-all.ts`.
- Banco: nenhuma migração; `rooms.createdAt` já existe e já era usado no `orderBy`.
- Contrato HTTP: campo **adicionado**, sem breaking change. Clientes que ignoram campos desconhecidos seguem funcionando; o Swagger/Scalar passa a documentar `createdAt` como `string` no formato date-time.
- Escopo: as demais rotas de sala (`create`, `update`, `activate`, `deactivate`) não mudam.
