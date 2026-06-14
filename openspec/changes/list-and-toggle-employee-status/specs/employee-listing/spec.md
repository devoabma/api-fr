## ADDED Requirements

### Requirement: Listagem de funcionários restrita a ADMIN

A API SHALL expor `GET /employees/get-all` para retornar todos os funcionários cadastrados. A rota MUST registrar o plugin `auth` e executar `request.checkIfEmployeeIsAdmin()` como primeira etapa do handler. Apenas campos públicos SHALL ser retornados por funcionário: `id`, `name`, `cpf`, `email`, `imageUrl`, `role` e `inactive`. O hash de senha e demais campos sensíveis MUST NOT ser expostos.

#### Scenario: ADMIN lista os funcionários

- **WHEN** um funcionário autenticado com `role: 'ADMIN'` chama `GET /employees/get-all`
- **THEN** a API responde `200` com `{ employees: [...] }` contendo os campos públicos de cada funcionário

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT, com token inválido/expirado ou de um funcionário não-ADMIN
- **THEN** a API responde `401`
- **AND** nenhum dado de funcionário é retornado
