## ADDED Requirements

### Requirement: Criação de computador restrita a ADMIN

A API SHALL expor `POST /computers/create` para cadastrar um computador. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`. O corpo MUST conter `macCode` (string não vazia), `number` (inteiro positivo), `description` (string não vazia) e `roomId` (cuid).

O `macCode` MUST ser normalizado pelo util `formattedCodeMac`, que remove separadores, força maiúsculas e reaplica o padrão `AA-BB-CC-DD-EE-FF`; quando o resultado não tiver 17 caracteres (12 hex), a API MUST rejeitar com `400`. O `macCode` MUST ser único globalmente: havendo um computador com o mesmo MAC normalizado, a API MUST rejeitar com `400`. A `description` MUST ser persistida em maiúsculas. Dentro de uma mesma sala (`roomId`), `number` e `description` MUST ser únicos. A `roomId` MUST referenciar uma sala existente. Em caso de sucesso, a API MUST responder `201` com `{ macCode }`.

#### Scenario: ADMIN cria um computador com sucesso

- **WHEN** um funcionário ADMIN autenticado envia `macCode`, `number`, `description` e `roomId` válidos
- **THEN** o computador é criado com o `macCode` normalizado (`AA-BB-CC-DD-EE-FF`) e a `description` em maiúsculas
- **AND** a API responde `201` com `{ macCode }`

#### Scenario: MAC fora do padrão é rejeitado

- **WHEN** o `macCode` normalizado não resulta em 12 caracteres hex (17 com separadores)
- **THEN** a API responde `400` com "Mac Code inválido. Padrão de 12 caracteres." e nenhum computador é criado

#### Scenario: MAC duplicado é rejeitado

- **WHEN** já existe um computador com o mesmo `macCode` normalizado
- **THEN** a API responde `400` e nenhum computador é criado

#### Scenario: Sala inexistente

- **WHEN** a `roomId` informada não corresponde a nenhuma sala
- **THEN** a API responde `404` com "Sala informada não existe." e nenhum computador é criado

#### Scenario: Número ou descrição duplicados na sala

- **WHEN** já existe na mesma sala um computador com o mesmo `number` ou a mesma `description`
- **THEN** a API responde `400` e nenhum computador é criado

#### Scenario: Corpo inválido

- **WHEN** `macCode` ou `description` estão vazios, `number` não é inteiro positivo, ou `roomId` não é um cuid válido
- **THEN** a API responde `400` e nenhum computador é criado

#### Scenario: Funcionário sem permissão

- **WHEN** a chamada é feita por um funcionário não-ADMIN
- **THEN** a API responde `401` e nenhum computador é criado

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
- **AND** nenhum computador é criado
