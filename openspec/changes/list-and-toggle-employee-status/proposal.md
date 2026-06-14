## Why

A fundação de autenticação e autorização (`request-authorization`) já está entregue, mas o ADMIN ainda não tinha como gerenciar o quadro de funcionários: faltavam endpoints para listar todos os cadastros e para alternar o status ativo/inativo. Sem inativação, um funcionário desligado permaneceria apto a se autenticar; sem listagem, o app desktop/front web não conseguia exibir o painel de funcionários. Esta change adiciona os três casos de uso administrativos correspondentes.

## What Changes

- **`get-all.ts`** (`GET /employees/get-all`): nova rota protegida que retorna todos os funcionários cadastrados (campos públicos: `id`, `name`, `cpf`, `email`, `imageUrl`, `role`, `inactive`). Exige ADMIN via `checkIfEmployeeIsAdmin()`.
- **`deactivate.ts`** (`PATCH /employees/deactivate/:id`): inativa um funcionário gravando `inactive` com a data/hora atual. Bloqueia se já estiver inativo e impede o ADMIN de inativar o próprio cadastro.
- **`activate.ts`** (`PATCH /employees/activate/:id`): reativa um funcionário zerando `inactive` (`null`). Bloqueia se já estiver ativo.
- **`routes/index.ts`**: registra as três novas rotas sob o prefixo `/employees`.
- Os três endpoints declaram `security: [{ bearerAuth: [] }]` na doc OpenAPI e executam `checkIfEmployeeIsAdmin()` como primeira etapa do handler.

## Capabilities

### Added Capabilities
- `employee-listing`: listagem de todos os funcionários cadastrados, restrita a ADMIN.
- `employee-status`: ativação e inativação de funcionários por ADMIN, com a coluna `inactive` como fonte de verdade do status.

## Impact

- Código novo: `src/http/core/employees/get-all.ts`, `deactivate.ts`, `activate.ts`; alteração de registro em `src/http/routes/index.ts`.
- Contrato HTTP: três novos endpoints, todos exigindo JWT de um `ADMIN`; chamadas anônimas ou de não-admins recebem `401`.
- Negócio: a inativação passa a impedir login (já coberto por `authenticate` — funcionário inativo não autentica) e protege contra auto-inativação do ADMIN logado.
- Depende de `request-authorization` (plugin `auth` e augmentação de tipos), entregue em `employee-profile-and-error-foundation`.
- Pendência conhecida: a listagem ainda não é paginada (RNF de 10 itens/página segue no roadmap como infraestrutura futura).
