## MODIFIED Requirements

### Requirement: Listagem de funcionários restrita a ADMIN

A API SHALL expor `GET /employees/get-all` para retornar todos os funcionários cadastrados. A rota MUST registrar o plugin `auth` e executar `request.checkIfEmployeeIsAdmin()` como primeira etapa do handler. Apenas campos públicos SHALL ser retornados por funcionário: `id`, `name`, `cpf`, `email`, `imageUrl`, `role`, `inactive`, `createdAt` (a data de cadastro, para que o cliente possa exibi-la e reordenar localmente) e `employeesRooms` (as salas em que o funcionário atua). O hash de senha e demais campos sensíveis MUST NOT ser expostos.

Os funcionários MUST ser ordenados por `createdAt` em ordem decrescente, para que a lista seja estável entre chamadas (sem `orderBy` o banco não garante ordem alguma).

Cada item de `employeesRooms` SHALL seguir o formato aninhado pela tabela de junção — `{ rooms: { id, name, uf, inactive } }` — simétrico ao que `GET /rooms/get-all` devolve na direção oposta. Os vínculos MUST ser ordenados por `rooms.name` em ordem ascendente.

Vínculos apontando para salas **inativas** MUST ser devolvidos junto dos demais, distinguidos pelo campo `inactive` da sala. Desativar uma sala não desfaz o vínculo no banco, e omiti-lo aqui levaria o cliente a propor um vínculo já existente — que `POST /employees/link-with-rooms` recusa com `400`, invalidando o lote inteiro. Cabe ao cliente decidir como sinalizar a sala inativa na tela.

#### Scenario: ADMIN lista os funcionários

- **WHEN** um funcionário autenticado com `role: 'ADMIN'` chama `GET /employees/get-all`
- **THEN** a API responde `200` com `{ employees: [...] }` contendo os campos públicos de cada funcionário
- **AND** a lista vem ordenada por `createdAt` desc

#### Scenario: Data de cadastro do funcionário no response

- **WHEN** um funcionário ADMIN autenticado chama `GET /employees/get-all`
- **THEN** cada funcionário devolvido inclui `createdAt` com a data/hora do cadastro
- **AND** a sequência de `createdAt` acompanha a ordenação decrescente da lista

#### Scenario: Salas vinculadas ao funcionário no response

- **WHEN** um funcionário ADMIN autenticado chama `GET /employees/get-all`
- **THEN** cada funcionário devolvido inclui `employeesRooms` com uma entrada por sala vinculada
- **AND** cada entrada traz `rooms` com `id`, `name`, `uf` e `inactive`
- **AND** as entradas vêm ordenadas por `rooms.name` asc

#### Scenario: Funcionário sem nenhuma sala vinculada

- **WHEN** um funcionário sem vínculo algum aparece na listagem
- **THEN** seu `employeesRooms` é um array vazio
- **AND** a ausência de vínculo não o remove da lista

#### Scenario: Vínculo com sala inativa

- **GIVEN** um funcionário vinculado a uma sala que foi desativada
- **WHEN** um funcionário ADMIN autenticado chama `GET /employees/get-all`
- **THEN** a sala continua presente em `employeesRooms` do funcionário
- **AND** o `inactive` dessa sala traz a data da desativação, permitindo ao cliente distingui-la das ativas

#### Scenario: Funcionário desativado mantém seus vínculos visíveis

- **GIVEN** um funcionário desativado (`inactive` preenchido) que possui salas vinculadas
- **WHEN** um funcionário ADMIN autenticado chama `GET /employees/get-all`
- **THEN** ele aparece na lista com seu `employeesRooms` preenchido
- **AND** os vínculos NÃO são omitidos por conta da desativação — ao contrário de `GET /rooms/get-all`, que oculta funcionários inativos da equipe de cada sala

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT, com token inválido/expirado ou de um funcionário não-ADMIN
- **THEN** a API responde `401`
- **AND** nenhum dado de funcionário é retornado
