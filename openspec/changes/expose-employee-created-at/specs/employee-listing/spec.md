## MODIFIED Requirements

### Requirement: Listagem de funcionários restrita a ADMIN

A API SHALL expor `GET /employees/get-all` para retornar todos os funcionários cadastrados. A rota MUST registrar o plugin `auth` e executar `request.checkIfEmployeeIsAdmin()` como primeira etapa do handler. Apenas campos públicos SHALL ser retornados por funcionário: `id`, `name`, `cpf`, `email`, `imageUrl`, `role`, `inactive` e `createdAt` (a data de cadastro, para que o cliente possa exibi-la e reordenar localmente). O hash de senha e demais campos sensíveis MUST NOT ser expostos.

Os funcionários MUST ser ordenados por `createdAt` em ordem decrescente, para que a lista seja estável entre chamadas (sem `orderBy` o banco não garante ordem alguma).

#### Scenario: ADMIN lista os funcionários

- **WHEN** um funcionário autenticado com `role: 'ADMIN'` chama `GET /employees/get-all`
- **THEN** a API responde `200` com `{ employees: [...] }` contendo os campos públicos de cada funcionário
- **AND** a lista vem ordenada por `createdAt` desc

#### Scenario: Data de cadastro do funcionário no response

- **WHEN** um funcionário ADMIN autenticado chama `GET /employees/get-all`
- **THEN** cada funcionário devolvido inclui `createdAt` com a data/hora do cadastro
- **AND** a sequência de `createdAt` acompanha a ordenação decrescente da lista

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT, com token inválido/expirado ou de um funcionário não-ADMIN
- **THEN** a API responde `401`
- **AND** nenhum dado de funcionário é retornado
