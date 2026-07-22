## ADDED Requirements

### Requirement: Listagem de sessões de liberação

A API SHALL expor `GET /lawyers/get-all-releases/:roomId?` para listar o histórico de sessões de uso (liberações). A rota MUST exigir autenticação de funcionário (JWT).

O `roomId` (param opcional, cuid2) MUST filtrar por uma sala específica. A querystring MAY conter `lawyer` (nome do advogado(a), busca parcial case-insensitive), `startDate` e `endDate` (intervalo aplicado sobre `startedAt`).

A visibilidade MUST respeitar o papel do funcionário autenticado: ADMIN MUST ver sessões de qualquer sala; MEMBER MUST ver apenas sessões de salas em que está vinculado (`employeesRooms`). Se um MEMBER informar `roomId` de uma sala à qual não está vinculado, a resposta MUST ser uma lista vazia (não um erro).

Cada sessão retornada MUST incluir o `computer` usado (`id` e `description` — o modelo `Computers` não possui campo `name`, `description` é o identificador legível).

Para cada sessão a API MUST calcular `usedMinutes` (diferença em minutos entre `startedAt` e `endedAt`, ou o momento atual quando a sessão ainda está em andamento), `remainingMinutes` (`standardTime` da sala menos `usedMinutes`, MUST NUNCA ser negativo) e `usedAllTime` (`true` quando `usedMinutes >= standardTime`).

#### Scenario: ADMIN lista todas as sessões

- **WHEN** um funcionário ADMIN chama `GET /lawyers/get-all-releases` sem `roomId`
- **THEN** a API responde `200` com as sessões de todas as salas, mais recentes primeiro

#### Scenario: MEMBER só vê sessões das suas salas

- **WHEN** um funcionário MEMBER chama `GET /lawyers/get-all-releases` sem `roomId`
- **THEN** a API responde `200` apenas com sessões de salas em que o funcionário está vinculado

#### Scenario: MEMBER filtra por sala à qual não pertence

- **WHEN** um funcionário MEMBER informa `roomId` de uma sala à qual não está vinculado
- **THEN** a API responde `200` com uma lista vazia

#### Scenario: Sessão em andamento

- **WHEN** uma sessão retornada ainda não possui `endedAt`
- **THEN** `usedMinutes` é calculado usando o momento atual como referência, e `remainingMinutes` reflete o saldo restante da sala
