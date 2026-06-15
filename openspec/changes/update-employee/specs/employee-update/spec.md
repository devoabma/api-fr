## ADDED Requirements

### Requirement: Edição de funcionário por ADMIN

A API SHALL expor `PATCH /employees/update/:id` para editar os dados cadastrais de um funcionário. A rota MUST registrar o plugin `auth` e executar `request.checkIfEmployeeIsAdmin()` como primeira etapa do handler. O body SHALL aceitar os campos opcionais `name`, `email` e `role` (`MEMBER` | `ADMIN`); apenas os campos informados MUST ser gravados. A operação MUST ser interrompida quando o funcionário não existe (`404`) e quando o `email` informado já pertence a outro funcionário (`400`).

#### Scenario: ADMIN edita um funcionário existente

- **WHEN** um ADMIN chama `PATCH /employees/update/:id` com um ou mais campos válidos
- **THEN** apenas os campos informados são atualizados
- **AND** a API responde `200` com mensagem de sucesso

#### Scenario: Funcionário inexistente

- **WHEN** o `:id` informado não corresponde a nenhum funcionário
- **THEN** a API responde `404` e nada é alterado

#### Scenario: E-mail já em uso por outro funcionário

- **WHEN** o `email` informado difere do atual e já pertence a outro funcionário
- **THEN** a API responde `400` e nada é alterado

#### Scenario: Body sem campos

- **WHEN** o ADMIN chama a rota sem nenhum campo no body
- **THEN** a API responde `200` e nenhum dado do funcionário é alterado

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT, com token inválido/expirado ou de um funcionário não-ADMIN
- **THEN** a API responde `401`
- **AND** nenhum dado de funcionário é alterado
