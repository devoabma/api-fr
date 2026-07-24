## ADDED Requirements

### Requirement: Listagem de impressões enviadas

A API SHALL expor `GET /printers/get-all/:roomId?` para listar as impressões enviadas pelos advogados. A rota MUST exigir autenticação de funcionário (JWT). A resposta MUST ser um objeto `{ printers: [...] }` (não um array na raiz).

O `roomId` (param opcional, cuid2) MUST filtrar por uma sala específica. A querystring MAY conter `lawyer` (nome do advogado(a), busca parcial case-insensitive), `startDate` e `endDate` (intervalo aplicado sobre `createdAt`).

A visibilidade MUST respeitar o papel do funcionário autenticado: ADMIN MUST ver impressões de qualquer sala; MEMBER MUST ver apenas impressões de salas em que está vinculado (`employeesRooms`). Se um MEMBER informar `roomId` de uma sala à qual não está vinculado, a resposta MUST ser uma lista vazia (não um erro).

Cada impressão retornada MUST incluir `lawyer` (`id`, `name`), `room` (`id`, `name`) e `computer` (`id`, `description`) resolvidos a partir do registro em `Printers`.

#### Scenario: ADMIN lista todas as impressões

- **WHEN** um funcionário ADMIN chama `GET /printers/get-all` sem `roomId`
- **THEN** a API responde `200` com as impressões de todas as salas, mais recentes primeiro

#### Scenario: MEMBER só vê impressões das suas salas

- **WHEN** um funcionário MEMBER chama `GET /printers/get-all` sem `roomId`
- **THEN** a API responde `200` apenas com impressões de salas em que o funcionário está vinculado

#### Scenario: MEMBER filtra por sala à qual não pertence

- **WHEN** um funcionário MEMBER informa `roomId` de uma sala à qual não está vinculado
- **THEN** a API responde `200` com uma lista vazia

#### Scenario: Filtro por advogado e intervalo de datas

- **WHEN** a querystring informa `lawyer` e/ou `startDate`/`endDate`
- **THEN** a API retorna apenas as impressões cujo advogado corresponde parcialmente (case-insensitive) e cujo `createdAt` está no intervalo informado
