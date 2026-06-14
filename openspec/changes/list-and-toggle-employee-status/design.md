## Contexto

A coluna `inactive` (timestamp anulável) já existe no modelo `employees` e é a fonte de verdade do status: `null` = ativo, data preenchida = inativo (desde quando). O fluxo de `authenticate` já recusa login de funcionário com `inactive` preenchido. Faltavam apenas os casos de uso administrativos para popular/limpar essa coluna e para listar o quadro.

## Decisões

### Status modelado por timestamp, não booleano

Inativar grava `inactive: dayjs().toDate()` e ativar grava `inactive: null`. Mantém o registro de *quando* o funcionário foi desligado sem coluna extra, e o teste de status é simplesmente `!!employee.inactive`.

### Guardas de idempotência explícitas

- `deactivate`: se `inactive` já preenchido → `BadRequestError('Funcionário já está inativo.')`.
- `activate`: se `inactive` já é `null` → `BadRequestError('Funcionário já está ativo.')`.

Evita updates redundantes e devolve erro claro em vez de um `200` silencioso que mascara intenção equivocada do cliente.

### Proteção contra auto-inativação

`deactivate` compara `:id` com `request.getIdCurrentEmployee()`; se forem iguais → `BadRequestError`. Impede que um ADMIN se tranque para fora do sistema inativando o próprio cadastro. `activate` não precisa da guarda (um funcionário inativo não consegue autenticar para chamar a rota).

### Autorização por rota

As três rotas seguem o padrão já adotado (`get-profile.ts`, `create-account.ts`): `.register(auth)` na cadeia de construção e `checkIfEmployeeIsAdmin()` como primeira linha do handler, antes de qualquer consulta ao banco.

### Listagem sem paginação (provisório)

`get-all` retorna o conjunto completo via `findMany` com `select` dos campos públicos. A paginação reutilizável (10 itens/página) é uma peça de infraestrutura ainda pendente no roadmap; quando entregar, esta rota será adaptada.

## Ordem de execução (activate/deactivate)

1. `preHandler` do plugin `auth` decora `request`.
2. `checkIfEmployeeIsAdmin()` → `401` se não-admin/sem token.
3. `findUnique` pelo `:id` → `404` se não existir.
4. Guarda de idempotência → `400` se já no status alvo.
5. (`deactivate`) Guarda de auto-inativação → `400` se `:id` == funcionário logado.
6. `update` da coluna `inactive` → `200` com mensagem de sucesso.
