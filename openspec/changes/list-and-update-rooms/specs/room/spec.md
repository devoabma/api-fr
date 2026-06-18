## ADDED Requirements

### Requirement: Listagem de todas as salas restrita a ADMIN

A API SHALL expor `GET /rooms/get-all` para recuperar todas as salas cadastradas. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`. As salas MUST ser retornadas ordenadas por `createdAt` em ordem decrescente, e cada sala MUST incluir a lista de `computers` vinculados (`id`, `macCode`, `number`, `description`). Em caso de sucesso, a API MUST responder `200` com `{ rooms }`.

#### Scenario: ADMIN lista todas as salas

- **WHEN** um funcionário ADMIN autenticado chama `GET /rooms/get-all`
- **THEN** a API responde `200` com `{ rooms }` ordenadas por `createdAt` desc
- **AND** cada sala inclui seus computadores vinculados

#### Scenario: Funcionário sem permissão

- **WHEN** a chamada é feita por um funcionário não-ADMIN
- **THEN** a API responde `401`

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`

### Requirement: Edição parcial de sala restrita a ADMIN

A API SHALL expor `PATCH /rooms/update/:id` para editar uma sala por `id`. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`. O `id` (params) MUST ser um `cuid2`. O corpo é parcial: MAY conter `name` (string), `standardTime` (inteiro positivo) e `description` (string); apenas os campos enviados MUST ser atualizados.

Se a sala não existir, a API MUST responder `404`. Quando `name` for enviado e diferente do nome atual (comparação em maiúsculas), o `name` MUST ser persistido em maiúsculas e o `slug` MUST ser regerado via `slugify` (`lower: true`, `strict: true`); a checagem de duplicidade MUST ignorar a própria sala (`id: { not: id }`) e, havendo outra sala com o mesmo slug, a API MUST rejeitar com `400`. Quando o nome não muda, o `slug` MUST permanecer inalterado. Em caso de sucesso, a API MUST responder `200` com `{ message }`.

#### Scenario: ADMIN edita campos parciais

- **WHEN** um ADMIN envia apenas `standardTime` e/ou `description`
- **THEN** somente os campos enviados são atualizados e o slug permanece inalterado
- **AND** a API responde `200` com `{ message }`

#### Scenario: ADMIN altera o nome para um nome único

- **WHEN** um ADMIN envia um `name` diferente do atual cujo slug não colide com outra sala
- **THEN** o `name` é gravado em maiúsculas e o `slug` é regerado
- **AND** a API responde `200` com `{ message }`

#### Scenario: Nome que gera slug duplicado é rejeitado

- **WHEN** o novo `name` gera um slug já usado por outra sala (`id` diferente)
- **THEN** a API responde `400` com a mensagem "Sala com esse nome já cadastrada." e nada é atualizado

#### Scenario: Sala inexistente

- **WHEN** o `id` informado não corresponde a nenhuma sala
- **THEN** a API responde `404` com a mensagem "Sala não encontrada."

#### Scenario: Funcionário sem permissão ou sem autorização

- **WHEN** a chamada é feita por um não-ADMIN, sem JWT ou com token inválido/expirado
- **THEN** a API responde `401` e nada é atualizado
