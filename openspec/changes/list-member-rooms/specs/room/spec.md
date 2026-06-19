## ADDED Requirements

### Requirement: Listagem das salas do funcionário autenticado

A API SHALL expor `GET /rooms/get-member-rooms` para recuperar as salas às quais o funcionário autenticado está vinculado. A rota MUST registrar o plugin `auth`. O escopo MUST ser determinado pelo `employeeId` obtido de `request.getIdCurrentEmployee()`, filtrando por `employeesRooms: { some: { employeeId } }`; a rota NÃO exige papel `ADMIN`, pois cada funcionário acessa apenas as próprias salas. Apenas salas ativas (`inactive: null`) MUST ser retornadas. As salas MUST ser ordenadas por `createdAt` em ordem decrescente, e cada sala MUST incluir seus `computers` (`id`, `macCode`, `number`, `description`, `inUse`, `maintenance`). Em caso de sucesso, a API MUST responder `200` com `{ rooms }`.

#### Scenario: Funcionário lista suas salas ativas

- **WHEN** um funcionário autenticado chama `GET /rooms/get-member-rooms`
- **THEN** a API responde `200` com `{ rooms }` contendo apenas as salas ativas às quais ele está vinculado
- **AND** cada sala inclui seus computadores com `inUse` e `maintenance`

#### Scenario: Sala desativada após o vínculo não aparece

- **WHEN** uma sala vinculada ao funcionário tem `inactive` preenchido
- **THEN** essa sala não é incluída na resposta

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`

## MODIFIED Requirements

### Requirement: Listagem de todas as salas restrita a ADMIN

A API SHALL expor `GET /rooms/get-all` para recuperar todas as salas cadastradas. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`. As salas MUST ser retornadas ordenadas por `createdAt` em ordem decrescente, e cada sala MUST incluir a lista de `computers` vinculados (`id`, `macCode`, `number`, `description`, `inUse`, `maintenance`). Em caso de sucesso, a API MUST responder `200` com `{ rooms }`.

#### Scenario: ADMIN lista todas as salas

- **WHEN** um funcionário ADMIN autenticado chama `GET /rooms/get-all`
- **THEN** a API responde `200` com `{ rooms }` ordenadas por `createdAt` desc
- **AND** cada sala inclui seus computadores vinculados com `inUse` e `maintenance`

#### Scenario: Funcionário sem permissão

- **WHEN** a chamada é feita por um funcionário não-ADMIN
- **THEN** a API responde `401`

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
