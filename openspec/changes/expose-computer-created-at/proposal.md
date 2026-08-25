## Why

`GET /computers/get-all` devolve o inventário de máquinas sem a data de cadastro. O painel web e o app desktop não conseguem exibir "cadastrado em", nem ordenar/agrupar as estações por antiguidade no cliente. É a mesma lacuna já fechada na listagem de salas (change `expose-room-created-at`): o campo `computers.createdAt` existe no modelo e expô-lo custa uma linha no `select`.

Junto disso apareceu um problema real: a consulta **não tinha `orderBy`**. Sem ordenação explícita o Postgres devolve as linhas na ordem que quiser (varia conforme plano de execução, `UPDATE`s e vacuum), então a mesma chamada podia trazer a lista embaralhada de uma requisição para outra — e qualquer paginação futura ficaria inconsistente. Expor `createdAt` sem ordenação determinística só tornaria a bagunça visível.

## What Changes

- **`createdAt` no response de `GET /computers/get-all`**: adicionado ao `select` do Prisma e ao schema Zod de resposta (`z.date()`), junto dos demais campos do computador.
- **Ordenação determinística**: a consulta passa a usar `orderBy: { createdAt: 'desc' }`, alinhando a rota ao padrão já adotado em `rooms/get-all`, `printers/get-all` e `lawyers/get-all-releases` — mais novo primeiro.
- Nenhuma mudança de filtro (`roomId`, `description`) ou de permissão (segue ADMIN-only).

## Capabilities

### Modified Capabilities
- `computer`: a listagem de computadores passa a incluir `createdAt` em cada item e a devolver a lista ordenada por data de cadastro decrescente.

## Impact

- Código: altera apenas `src/http/core/computers/get-all.ts`.
- Banco: nenhuma migração; `computers.createdAt` já existe.
- Contrato HTTP: campo **adicionado**, sem breaking change. Clientes que ignoram campos desconhecidos seguem funcionando; o Swagger/Scalar passa a documentar `createdAt` como `string` no formato date-time.
- Comportamento: a ordem da lista muda de "indefinida" para "mais recente primeiro". Clientes que reordenavam localmente não são afetados; quem exibia na ordem crua passa a ver uma ordem estável.
- Escopo: as demais rotas de computador (`create`, `update`, `delete`, `maintenance`, `online`) não mudam.
