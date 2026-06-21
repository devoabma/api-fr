## ADDED Requirements

### Requirement: Listagem de computadores restrita a ADMIN

A API SHALL expor `GET /computers/get-all` para listar computadores. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`.

A rota MUST aceitar filtros opcionais na query string: `roomId` (cuid) filtra por sala via igualdade, e `description` (string) faz busca parcial case-insensitive (`contains` + `mode: 'insensitive'`). Quando um filtro não é informado, ele MUST ser ignorado; sem nenhum filtro, a API MUST retornar todos os computadores. Em caso de sucesso, a API MUST responder `200` com `{ computers: [...] }`, onde cada computador traz `id`, `macCode`, `number`, `description`, `inUse`, `maintenance` e a `room` vinculada (`id`, `name`).

#### Scenario: ADMIN lista todos os computadores

- **WHEN** um funcionário ADMIN autenticado chama `GET /computers/get-all` sem filtros
- **THEN** a API responde `200` com `{ computers }` contendo todos os computadores e suas salas

#### Scenario: Filtro por descrição

- **WHEN** a chamada inclui `?description=` com um termo
- **THEN** a API retorna apenas os computadores cuja `description` contém o termo, ignorando maiúsculas/minúsculas

#### Scenario: Filtro por sala

- **WHEN** a chamada inclui `?roomId=` com um cuid de sala
- **THEN** a API retorna apenas os computadores daquela sala

#### Scenario: Funcionário sem permissão

- **WHEN** a chamada é feita por um funcionário não-ADMIN
- **THEN** a API responde `401`

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
