## ADDED Requirements

### Requirement: Vínculo de funcionário a salas por ADMIN

A API SHALL expor `POST /employees/link-with-rooms` para vincular um funcionário a uma ou mais salas. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()` como primeira etapa, que o funcionário autenticado tenha papel `ADMIN`. O corpo MUST conter `employeeId` (`cuid2`) e `roomIds` (lista de `cuid2` com ao menos um item). IDs repetidos em `roomIds` MUST ser tratados como um único vínculo. A operação MUST criar um registro em `employees_rooms` para cada sala informada, de forma atômica e idempotente (sem duplicar vínculos já existentes). A operação MUST ser interrompida quando o funcionário não existe (`404`), quando uma ou mais salas não são encontradas (`400`), quando alguma sala-alvo está inativa (`400`) ou quando já existe vínculo para alguma das salas (`400`). Em caso de sucesso, a API MUST responder `200` com `{ message }`.

#### Scenario: ADMIN vincula funcionário a salas ativas

- **WHEN** um ADMIN chama `POST /employees/link-with-rooms` com um `employeeId` válido e `roomIds` de salas ativas ainda não vinculadas
- **THEN** um registro é criado em `employees_rooms` para cada sala
- **AND** a API responde `200` com mensagem de sucesso

#### Scenario: Lista de salas vazia

- **WHEN** `roomIds` chega como lista vazia
- **THEN** a API responde `400` (validação de schema) e nenhum vínculo é criado

#### Scenario: Funcionário inexistente

- **WHEN** o `employeeId` informado não corresponde a nenhum funcionário
- **THEN** a API responde `404` e nenhum vínculo é criado

#### Scenario: Sala inexistente

- **WHEN** algum `roomId` informado não corresponde a uma sala existente
- **THEN** a API responde `400` e nenhum vínculo é criado

#### Scenario: Sala inativa

- **WHEN** alguma sala-alvo está com `inactive` preenchido
- **THEN** a API responde `400`, citando as salas inativas, e nenhum vínculo é criado

#### Scenario: Vínculo já existente

- **WHEN** o funcionário já está vinculado a alguma das salas informadas
- **THEN** a API responde `400`, citando as salas já vinculadas, e nenhum novo vínculo é criado

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT, com token inválido/expirado ou por um funcionário não-ADMIN
- **THEN** a API responde `401`
