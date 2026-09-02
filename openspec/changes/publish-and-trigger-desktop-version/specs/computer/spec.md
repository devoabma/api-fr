## ADDED Requirements

### Requirement: Mandar uma estação atualizar agora

A API SHALL expor `POST /computers/update-app/:id` para pedir que **uma** estação consulte o manifesto e atualize imediatamente, sem esperar o intervalo do próprio cliente.

A rota MUST registrar o plugin `auth` e MUST exigir papel `ADMIN` via `request.checkIfEmployeeIsAdmin()`.

O caminho MUST ser `/computers/update-app/:id` e MUST NOT ser `/computers/update/:id`: o segundo já é o `PATCH` que edita o cadastro do computador, e duas operações sem nada em comum na mesma URL, separadas apenas pelo verbo, fazem um `POST` distraído mandar uma estação baixar o pacote inteiro.

O parâmetro MUST ser o `id` (`cuid2`) do computador, como nas demais rotas do painel, e MUST NOT ser o `macCode`: MAC em URL admite formatos divergentes que a normalização não cobre.

A API MUST recusar com `404` quando o computador não existe.

A API MUST recusar com `400` quando `computer.inUse` for verdadeiro. Nenhuma atualização interrompe advogado(a) em atendimento, e a checagem MUST acontecer antes de gastar o canal.

A API MUST NOT bloquear por `computer.maintenance`: máquina em manutenção é o melhor momento possível para trocar o executável.

A API MUST recusar com `400` quando a estação estiver comprovadamente na versão publicada. Estação com situação `unknown` MUST ser aceita — é justamente a máquina sobre a qual não se sabe nada que mais precisa ser acionada.

A API MUST responder `409` quando a estação não estiver com o canal aberto, inclusive quando a conexão cair entre a checagem e o envio. A mensagem MUST informar que a máquina buscará a versão sozinha na próxima vez que for ligada, e o pedido MUST NOT ser enfileirado.

A rota MUST ter limite próprio, contado **por máquina** e não por funcionário, porque o que satura o link da unidade é a mesma sala baixando junto.

A resposta `200` MUST confirmar apenas **o envio do recado**, e MUST NOT afirmar que a estação foi atualizada. O resultado real chega no `register` seguinte, com a versão nova.

#### Scenario: Estação conectada e atrasada

- **WHEN** um ADMIN chama `POST /computers/update-app/:id` para uma máquina livre, conectada e atrás da versão publicada
- **THEN** a API envia `update_now` pelo canal e responde `200` com `message`, `macCode` e a `version` que esperava instalar

#### Scenario: Estação com sessão aberta

- **WHEN** um ADMIN chama a rota para uma máquina com `inUse = true`
- **THEN** a API responde `400` orientando a esperar o encerramento da sessão
- **AND** nenhuma mensagem é enviada pelo canal

#### Scenario: Estação em manutenção

- **WHEN** um ADMIN chama a rota para uma máquina em manutenção e livre
- **THEN** a API envia o pedido normalmente

#### Scenario: Estação desconectada

- **WHEN** a máquina não está no mapa de conexões, ou cai entre a checagem e o envio
- **THEN** a API responde `409` sem enfileirar o pedido

#### Scenario: Estação já na versão publicada

- **WHEN** a `appVersion` da máquina é igual ou superior à versão publicada
- **THEN** a API responde `400` informando que a estação já está na versão publicada

## MODIFIED Requirements

### Requirement: Listagem de computadores restrita a ADMIN

A API SHALL expor `GET /computers/get-all` para listar computadores. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`.

A rota MUST aceitar filtros opcionais na query string: `roomId` (cuid) filtra por sala via igualdade, e `description` (string) faz busca parcial case-insensitive (`contains` + `mode: 'insensitive'`). Quando um filtro não é informado, ele MUST ser ignorado; sem nenhum filtro, a API MUST retornar todos os computadores.

Os computadores MUST ser ordenados por `createdAt` em ordem decrescente. Em caso de sucesso, a API MUST responder `200` com `{ computers: [...], latestVersion }`, onde cada computador traz `id`, `macCode`, `number`, `description`, `inUse`, `maintenance`, `createdAt`, `appVersion`, `appVersionReportedAt`, `isOnline`, `updateStatus` e a `room` vinculada (`id`, `name`).

O campo `isOnline` MUST ser lido do mapa de conexões em memória do canal, com **uma** leitura servindo a lista inteira, e MUST NOT gerar consulta por linha. O MAC MUST ser normalizado nos dois lados da comparação, para que uma linha antiga fora do padrão não apareça offline estando conectada.

O campo `updateStatus` MUST ser calculado no servidor e MUST ter exatamente três valores: `outdated`, `up-to-date` e `unknown`. O cálculo MUST NOT ser deixado para o cliente — comparar versão por texto é um erro que só aparece na décima publicação (`'1.0.10' < '1.0.9'` em ordem alfabética) e não pode ser reescrito em cada tela.

`unknown` MUST cobrir três situações: a estação nunca informou a versão, informou algo que não é comparável, ou a API ainda não conhece a versão publicada. `unknown` MUST NOT ser reportado como `up-to-date`.

O campo `latestVersion` MUST trazer `version`, `notes` e `generatedAt` da versão publicada vigente, ou `null` quando a API ainda não conhece nenhuma.

#### Scenario: ADMIN lista computadores com a situação de versão

- **WHEN** um funcionário ADMIN autenticado chama `GET /computers/get-all`
- **THEN** cada computador devolvido inclui `isOnline` e `updateStatus`
- **AND** a resposta inclui `latestVersion` com a versão publicada vigente

#### Scenario: Estação com versão ilegível

- **GIVEN** que a máquina informou `"1.0.8-beta"` no registro
- **WHEN** o inventário é listado
- **THEN** o `updateStatus` dela é `unknown`
- **AND** NÃO é `up-to-date`

#### Scenario: API ainda sem versão publicada

- **WHEN** nenhuma versão chegou pelas duas fontes
- **THEN** `latestVersion` é `null`
- **AND** todos os computadores vêm com `updateStatus` igual a `unknown`
