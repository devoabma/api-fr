## MODIFIED Requirements

### Requirement: Listagem de salas por papel

A API SHALL expor `GET /rooms/get-all` para listar salas de acordo com o papel do funcionário autenticado. A rota MUST registrar o plugin `auth` e obter `{ id, role }` via `request.getCurrentEmployee()` (sem exigir ADMIN). O escopo MUST depender do papel:

- `ADMIN`: MUST retornar todas as salas cadastradas, inclusive inativas (`where: {}`).
- `MEMBER`: MUST retornar apenas as salas ativas (`inactive: null`) às quais o funcionário está vinculado, filtrando por `employeesRooms: { some: { employeeId } }`.

As salas MUST ser ordenadas por `createdAt` em ordem decrescente, e cada sala MUST incluir seus funcionários vinculados e seus `computers` (`id`, `macCode`, `number`, `description`, `inUse`, `maintenance`).

Como desligar um funcionário é **soft delete** (preenche `employees.inactive` e mantém o registro em `employees_rooms`), o array `employeesRooms` MUST conter apenas os vínculos cujo funcionário está ativo — a consulta MUST aplicar `where: { employees: { inactive: null } }` ao `select` de `employeesRooms`, para os dois papéis. Em caso de sucesso, a API MUST responder `200` com `{ rooms }`.

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

#### Scenario: Funcionário desligado não aparece na equipe da sala

- **WHEN** uma sala tem vínculo com um funcionário cujo `inactive` está preenchido
- **THEN** esse vínculo não é incluído em `employeesRooms` na resposta
- **AND** os demais funcionários ativos da mesma sala continuam listados

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
