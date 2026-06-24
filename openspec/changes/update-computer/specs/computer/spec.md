## MODIFIED Requirements

### Requirement: Edição de computador restrita a ADMIN

A API SHALL expor `PATCH /computers/update/:id` para atualizar parcialmente um computador. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`. O `id` MUST ser um cuid no path; o corpo aceita `macCode`, `number` (inteiro positivo), `description` e `roomId` (cuid), todos opcionais.

O `id` MUST referenciar um computador existente; caso contrário a API MUST responder `404`. Quando `macCode` é enviado, MUST ser normalizado pelo util `formattedCodeMac`; resultado com tamanho diferente de 17 caracteres → `400`; havendo outro computador (excluindo o próprio) com o mesmo MAC normalizado → `400`. Quando `roomId` é enviado, MUST referenciar uma sala existente; caso contrário → `404`.

As revalidações de unicidade MUST usar a **sala efetiva** — o `roomId` enviado quando presente, senão a sala atual do computador. O `number` MUST ser único na sala efetiva e é revalidado quando `number` ou `roomId` mudam (excluindo o próprio computador); colisão → `400`. A `description` MUST ser persistida em maiúsculas e MUST ser única na sala efetiva, revalidada quando `description` ou `roomId` mudam (excluindo o próprio); colisão → `400`. A atualização MUST persistir somente os campos enviados. Em caso de sucesso, a API MUST responder `200` com `{ message }`.

#### Scenario: ADMIN edita um computador com sucesso

- **WHEN** um funcionário ADMIN autenticado envia um subconjunto válido de `macCode`/`number`/`description`/`roomId` para um computador existente
- **THEN** somente os campos enviados são atualizados (MAC normalizado, `description` em maiúsculas)
- **AND** a API responde `200` com `{ message }`

#### Scenario: Computador inexistente

- **WHEN** o `id` informado não corresponde a nenhum computador
- **THEN** a API responde `404` com "Computador não encontrado." e nada é atualizado

#### Scenario: MAC fora do padrão é rejeitado

- **WHEN** o `macCode` enviado normaliza para algo diferente de 17 caracteres
- **THEN** a API responde `400` e nada é atualizado

#### Scenario: MAC duplicado é rejeitado

- **WHEN** já existe outro computador (diferente do que está sendo editado) com o mesmo `macCode` normalizado
- **THEN** a API responde `400` e nada é atualizado

#### Scenario: Sala inexistente

- **WHEN** a `roomId` enviada não corresponde a nenhuma sala
- **THEN** a API responde `404` com "Sala informada não existe." e nada é atualizado

#### Scenario: Número ou descrição duplicados na sala efetiva

- **WHEN** o `number` ou a `description` resultantes colidem com outro computador na sala efetiva (sala enviada, senão a atual)
- **THEN** a API responde `400` e nada é atualizado

#### Scenario: Mover de sala revalida no destino

- **WHEN** somente `roomId` é enviado e o `number`/`description` atuais do computador já existem na sala de destino
- **THEN** a API responde `400` e o computador não é movido

#### Scenario: Funcionário sem permissão

- **WHEN** a chamada é feita por um funcionário não-ADMIN
- **THEN** a API responde `401` e nada é atualizado

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
- **AND** nada é atualizado
