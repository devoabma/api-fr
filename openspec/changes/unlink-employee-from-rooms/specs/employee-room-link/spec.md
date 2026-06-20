## ADDED Requirements

### Requirement: Desvínculo de funcionário de salas por ADMIN

A API SHALL expor `POST /employees/unlink-with-rooms` para remover o vínculo de um funcionário com uma ou mais salas. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()` como primeira etapa, que o funcionário autenticado tenha papel `ADMIN`. O corpo MUST conter `employeeId` (`cuid2`) e `roomIds` (lista de `cuid2` com ao menos um item). IDs repetidos em `roomIds` MUST ser tratados como um único alvo. A operação MUST apagar de `employees_rooms` os vínculos do funcionário com as salas informadas, de forma idempotente (apagar vínculo inexistente não gera erro). A operação MUST ser interrompida quando o funcionário não existe (`404`) ou quando nenhum vínculo é encontrado entre o funcionário e as salas informadas (`404`). Em caso de sucesso, a API MUST responder `200` com `{ message }`. A rota MUST usar o verbo `POST` (e não `DELETE`), pois a lista `roomIds` trafega no corpo e body em `DELETE` tem semântica indefinida pela RFC 9110, podendo ser descartado por intermediários.

#### Scenario: ADMIN desvincula funcionário de salas

- **WHEN** um ADMIN chama `POST /employees/unlink-with-rooms` com um `employeeId` válido e `roomIds` de salas às quais o funcionário está vinculado
- **THEN** os registros correspondentes em `employees_rooms` são apagados
- **AND** a API responde `200` com mensagem de sucesso

#### Scenario: Lista de salas vazia

- **WHEN** `roomIds` chega como lista vazia
- **THEN** a API responde `400` (validação de schema) e nenhum vínculo é removido

#### Scenario: Funcionário inexistente

- **WHEN** o `employeeId` informado não corresponde a nenhum funcionário
- **THEN** a API responde `404` e nenhum vínculo é removido

#### Scenario: Nenhum vínculo encontrado

- **WHEN** o funcionário existe mas não está vinculado a nenhuma das salas informadas
- **THEN** a API responde `404` e nenhum vínculo é removido

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT, com token inválido/expirado ou por um funcionário não-ADMIN
- **THEN** a API responde `401`
