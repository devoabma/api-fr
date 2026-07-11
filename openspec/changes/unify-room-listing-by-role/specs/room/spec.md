## REMOVED Requirements

### Requirement: Listagem das salas do funcionário autenticado

**Reason**: Consolidada na rota única `GET /rooms/get-all`, que agora escopa o resultado pelo papel do funcionário. A rota dedicada `GET /rooms/get-member-rooms` foi removida.

**Migration**: Clientes que chamavam `GET /rooms/get-member-rooms` devem passar a chamar `GET /rooms/get-all`; para um funcionário `MEMBER` o retorno já é escopado às suas salas ativas.

## MODIFIED Requirements

### Requirement: Listagem de salas por papel

A API SHALL expor `GET /rooms/get-all` para listar salas de acordo com o papel do funcionário autenticado. A rota MUST registrar o plugin `auth` e obter `{ id, role }` via `request.getCurrentEmployee()` (sem exigir ADMIN). O escopo MUST depender do papel:

- `ADMIN`: MUST retornar todas as salas cadastradas, inclusive inativas (`where: {}`).
- `MEMBER`: MUST retornar apenas as salas ativas (`inactive: null`) às quais o funcionário está vinculado, filtrando por `employeesRooms: { some: { employeeId } }`.

As salas MUST ser ordenadas por `createdAt` em ordem decrescente, e cada sala MUST incluir seus funcionários vinculados e seus `computers` (`id`, `macCode`, `number`, `description`, `inUse`, `maintenance`). Em caso de sucesso, a API MUST responder `200` com `{ rooms }`.

#### Scenario: ADMIN lista todas as salas

- **WHEN** um funcionário ADMIN autenticado chama `GET /rooms/get-all`
- **THEN** a API responde `200` com `{ rooms }` contendo todas as salas (inclusive inativas), ordenadas por `createdAt` desc
- **AND** cada sala inclui seus computadores com `inUse` e `maintenance`

#### Scenario: MEMBER lista apenas as próprias salas ativas

- **WHEN** um funcionário MEMBER autenticado chama `GET /rooms/get-all`
- **THEN** a API responde `200` com `{ rooms }` contendo apenas as salas ativas às quais ele está vinculado

#### Scenario: Sala desativada não aparece para o MEMBER

- **WHEN** uma sala vinculada ao funcionário MEMBER tem `inactive` preenchido
- **THEN** essa sala não é incluída na resposta

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
