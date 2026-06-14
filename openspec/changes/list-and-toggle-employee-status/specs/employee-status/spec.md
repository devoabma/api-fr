## ADDED Requirements

### Requirement: Inativação de funcionário por ADMIN

A API SHALL expor `PATCH /employees/deactivate/:id` para inativar um funcionário. A rota MUST exigir um funcionário autenticado com papel `ADMIN` (`checkIfEmployeeIsAdmin()` como primeira etapa). A inativação MUST gravar a coluna `inactive` com a data/hora atual. A operação MUST ser interrompida quando o funcionário não existe (`404`), quando já está inativo (`400`) ou quando o `:id` é o do próprio funcionário autenticado (`400`).

#### Scenario: ADMIN inativa um funcionário ativo

- **WHEN** um ADMIN chama `PATCH /employees/deactivate/:id` para um funcionário ativo que não é ele mesmo
- **THEN** a coluna `inactive` recebe a data/hora atual
- **AND** a API responde `200` com mensagem de sucesso

#### Scenario: Funcionário inexistente

- **WHEN** o `:id` informado não corresponde a nenhum funcionário
- **THEN** a API responde `404` e nada é alterado

#### Scenario: Funcionário já inativo

- **WHEN** o funcionário-alvo já possui `inactive` preenchido
- **THEN** a API responde `400` e nada é alterado

#### Scenario: Auto-inativação bloqueada

- **WHEN** o `:id` informado é o do próprio funcionário autenticado
- **THEN** a API responde `400` e nada é alterado

### Requirement: Ativação de funcionário por ADMIN

A API SHALL expor `PATCH /employees/activate/:id` para reativar um funcionário. A rota MUST exigir um funcionário autenticado com papel `ADMIN`. A ativação MUST zerar a coluna `inactive` (`null`). A operação MUST ser interrompida quando o funcionário não existe (`404`) ou quando já está ativo (`400`).

#### Scenario: ADMIN ativa um funcionário inativo

- **WHEN** um ADMIN chama `PATCH /employees/activate/:id` para um funcionário com `inactive` preenchido
- **THEN** a coluna `inactive` passa a `null`
- **AND** a API responde `200` com mensagem de sucesso

#### Scenario: Funcionário inexistente

- **WHEN** o `:id` informado não corresponde a nenhum funcionário
- **THEN** a API responde `404` e nada é alterado

#### Scenario: Funcionário já ativo

- **WHEN** o funcionário-alvo já está com `inactive` em `null`
- **THEN** a API responde `400` e nada é alterado
