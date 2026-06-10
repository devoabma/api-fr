## ADDED Requirements

### Requirement: Recuperação do perfil do funcionário autenticado

O sistema SHALL expor `GET /employees/profile`, protegido pelo plugin `auth`, que retorna o perfil do funcionário autenticado. A rota MUST identificar o funcionário via `getIdCurrentEmployee()` e buscar no banco apenas os campos do perfil (`id`, `name`, `cpf`, `email`, `imageUrl`, `role`). Quando o funcionário não for encontrado, o sistema MUST lançar `NotFoundError`.

#### Scenario: Perfil recuperado com sucesso

- **WHEN** um funcionário autenticado envia `GET /employees/profile` com token válido
- **THEN** a API responde `200` com `{ employee: { id, name, cpf, email, imageUrl, role } }`

#### Scenario: Requisição sem autenticação

- **WHEN** a requisição é feita sem token ou com token inválido
- **THEN** a API responde `401` (via `UnauthorizedError` do middleware de auth)

#### Scenario: Funcionário não encontrado

- **WHEN** o id do token não corresponde a nenhum funcionário no banco
- **THEN** a API responde `404` (via `NotFoundError`)
