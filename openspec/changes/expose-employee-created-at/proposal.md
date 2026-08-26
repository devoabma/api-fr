## Why

`GET /employees/get-all` devolvia a equipe sem a data de cadastro. O painel web não conseguia exibir "cadastrado em" nem ordenar os funcionários por antiguidade no cliente — a mesma lacuna já fechada nas listagens de salas (`expose-room-created-at`) e de computadores (`expose-computer-created-at`). O campo `employees.createdAt` já existe no modelo; expô-lo custa uma linha no `select`.

Junto disso apareceu o mesmo problema real das outras listagens: a consulta **não tinha `orderBy`**. Sem ordenação explícita o Postgres devolve as linhas na ordem que quiser (varia conforme plano de execução, `UPDATE`s e vacuum), então a mesma chamada podia trazer a equipe embaralhada de uma requisição para outra — e a paginação que ainda está pendente nessa rota nasceria inconsistente, com funcionários repetidos ou sumidos entre páginas. Expor `createdAt` sem ordenação determinística só tornaria a bagunça visível. Antes desta change, `employees/get-all` era a última listagem do projeto ainda sem `orderBy`.

## What Changes

- **`createdAt` no response de `GET /employees/get-all`**: adicionado ao `select` do Prisma e ao schema Zod de resposta (`z.date()`), junto dos demais campos públicos.
- **Ordenação determinística**: a consulta passa a usar `orderBy: { createdAt: 'desc' }`, alinhando a rota ao padrão já adotado em `rooms/get-all`, `computers/get-all`, `printers/get-all` e `lawyers/get-all-releases` — mais novo primeiro.
- Nenhuma mudança de permissão (segue ADMIN-only) nem de quais funcionários entram na lista (ativos e inativos continuam sendo devolvidos, com `inactive` distinguindo os dois).

## Capabilities

### Modified Capabilities
- `employee-listing`: a listagem de funcionários passa a incluir `createdAt` em cada item e a devolver a lista ordenada por data de cadastro decrescente.

## Impact

- Código: altera apenas `src/http/core/employees/get-all.ts`.
- Banco: nenhuma migração; `employees.createdAt` já existe.
- Contrato HTTP: campo **adicionado**, sem breaking change. Clientes que ignoram campos desconhecidos seguem funcionando; o Swagger/Scalar passa a documentar `createdAt` como `string` no formato date-time.
- Comportamento: a ordem da lista muda de "indefinida" para "mais recente primeiro". Quem reordenava localmente não é afetado; quem exibia na ordem crua passa a ver uma ordem estável.
- Escopo: as demais rotas de funcionário (`create-account`, `update`, `activate`, `deactivate`, `profile`, vínculos com salas) não mudam.
