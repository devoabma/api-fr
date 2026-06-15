## Why

O roadmap (seção 1) lista "Alterar funcionário" como pendente. Depois de [`list-and-toggle-employee-status`](../list-and-toggle-employee-status/proposal.md) entregar listagem e ativação/inativação, faltava ao ADMIN editar os dados cadastrais de um funcionário existente (nome, e-mail e papel). Sem esse caso de uso, uma correção de e-mail ou uma promoção de `MEMBER` para `ADMIN` exigiria intervenção direta no banco. Esta change entrega a edição administrativa do funcionário por ID.

## What Changes

- **Novo caso de uso `update.ts`** (`PUT /employees/update/:id`): rota protegida que atualiza os campos `name`, `email` e `role` de um funcionário. Todos os campos do body são opcionais — apenas os informados são gravados (atualização parcial). Exige ADMIN via `checkIfEmployeeIsAdmin()`.
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/employees`.
- A rota declara `security: [{ bearerAuth: [] }]` na doc OpenAPI e executa `checkIfEmployeeIsAdmin()` como primeira etapa do handler.

## Capabilities

### Added Capabilities
- `employee-update`: edição dos dados cadastrais (`name`, `email`, `role`) de um funcionário por ID, restrita a ADMIN, com checagem de unicidade de e-mail.

## Impact

- Código novo: `src/http/core/employees/update.ts`; alteração de registro em `src/http/routes/index.ts`.
- Contrato HTTP: novo endpoint `PUT /employees/update/:id`, exigindo JWT de um `ADMIN`; chamadas anônimas ou de não-admins recebem `401`.
- Negócio: funcionário inexistente → `404`; tentativa de gravar um e-mail já usado por outro funcionário → `400`. Body vazio é aceito e não altera nada.
- Banco: usa a tabela `employees` existente; nenhuma migração.
- Depende de `request-authorization` (plugin `auth` e augmentação de tipos), entregue em `employee-profile-and-error-foundation`.
- Documentação: `docs/DOC.md` e `docs/ROADMAP.md` marcam "Alterar funcionário" como concluído.
