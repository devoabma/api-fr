## MODIFIED Requirements

### Requirement: Listagem de todas as salas restrita a ADMIN

A API SHALL expor `GET /rooms/get-all` para recuperar todas as salas cadastradas. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`. As salas MUST ser retornadas ordenadas por `createdAt` em ordem decrescente. Cada sala MUST incluir a lista de `computers` vinculados (`id`, `macCode`, `number`, `description`, `inUse`, `maintenance`) e MUST incluir `employeesRooms`, a lista dos funcionários vinculados à sala (via `employees_rooms`), expondo de cada funcionário apenas `id`, `name` e `imageUrl`. Em caso de sucesso, a API MUST responder `200` com `{ rooms }`.

#### Scenario: ADMIN lista todas as salas

- **WHEN** um funcionário ADMIN autenticado chama `GET /rooms/get-all`
- **THEN** a API responde `200` com `{ rooms }` ordenadas por `createdAt` desc
- **AND** cada sala inclui seus computadores vinculados
- **AND** cada sala inclui `employeesRooms` com os funcionários vinculados (`id`, `name`, `imageUrl`)

#### Scenario: Sala sem funcionários vinculados

- **WHEN** uma sala não possui nenhum vínculo em `employees_rooms`
- **THEN** essa sala é retornada com `employeesRooms` como lista vazia

#### Scenario: Funcionário sem permissão

- **WHEN** a chamada é feita por um funcionário não-ADMIN
- **THEN** a API responde `401`

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
