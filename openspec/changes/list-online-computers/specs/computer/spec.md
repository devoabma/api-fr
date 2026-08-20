## ADDED Requirements

### Requirement: Listagem dos computadores conectados ao canal

A API SHALL expor `GET /computers/online/:roomId?` para listar os computadores atualmente conectados ao canal `/ws/computers`. A rota MUST registrar o plugin `auth` e MUST exigir funcionário autenticado, de qualquer papel.

A fonte da listagem MUST ser o registro em memória das conexões (`computerConnections`), não o banco. O banco MUST ser consultado apenas para traduzir os `macCode` conectados em computadores e aplicar o escopo do papel.

A resposta `200` MUST conter `{ computers: [...] }` com **somente** os computadores conectados, cada um trazendo `id`, `macCode`, `roomId` e `connectedAt`. Computador ausente da lista MUST significar não conectado.

O escopo MUST seguir o papel do funcionário: `ADMIN` enxerga qualquer sala e MAY filtrar por uma via `:roomId`; `MEMBER` MUST enxergar apenas as salas em que está vinculado. Quando o `roomId` informado for de uma sala fora do escopo do funcionário, a API MUST responder `200` com lista vazia, e não `401`.

Quando não houver nenhuma estação registrada, a API MUST responder `200` com `{ computers: [] }` sem consultar o banco.

#### Scenario: MEMBER lista as estações conectadas de uma sala vinculada

- **WHEN** um funcionário MEMBER autenticado chama `GET /computers/online/:roomId` de uma sala à qual está vinculado
- **THEN** a API responde `200` com os computadores daquela sala que estão no canal, cada um com `id`, `macCode`, `roomId` e `connectedAt`

#### Scenario: Computador desligado não aparece

- **WHEN** uma estação da sala não está registrada no canal (desligada, sem rede ou com o Desktop fechado)
- **THEN** ela MUST ficar de fora do array `computers` da resposta

#### Scenario: ADMIN sem filtro de sala

- **WHEN** um funcionário ADMIN autenticado chama `GET /computers/online` sem `roomId`
- **THEN** a API responde `200` com todas as estações conectadas, de qualquer sala

#### Scenario: MEMBER pedindo sala fora do seu vínculo

- **WHEN** um funcionário MEMBER chama a rota informando o `roomId` de uma sala à qual não está vinculado
- **THEN** a API responde `200` com `{ computers: [] }`

#### Scenario: Nenhuma estação conectada

- **WHEN** o registro de conexões está vazio (API recém-reiniciada ou sala fechada)
- **THEN** a API responde `200` com `{ computers: [] }`

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
