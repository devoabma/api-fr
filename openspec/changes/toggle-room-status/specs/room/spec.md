## MODIFIED Requirements

### Requirement: Listagem de todas as salas restrita a ADMIN

A API SHALL expor `GET /rooms/get-all` para recuperar todas as salas cadastradas. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`. As salas MUST ser retornadas ordenadas por `createdAt` em ordem decrescente, e cada sala MUST incluir o campo `inactive` (timestamp anulável; `null` = ativa) e a lista de `computers` vinculados (`id`, `macCode`, `number`, `description`). Em caso de sucesso, a API MUST responder `200` com `{ rooms }`.

#### Scenario: ADMIN lista todas as salas

- **WHEN** um funcionário ADMIN autenticado chama `GET /rooms/get-all`
- **THEN** a API responde `200` com `{ rooms }` ordenadas por `createdAt` desc
- **AND** cada sala inclui o campo `inactive` e seus computadores vinculados

#### Scenario: Funcionário sem permissão

- **WHEN** a chamada é feita por um funcionário não-ADMIN
- **THEN** a API responde `401`

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`

## ADDED Requirements

### Requirement: Inativação de sala por ADMIN

A API SHALL expor `PATCH /rooms/deactivate/:id` para inativar uma sala. A rota MUST exigir um funcionário autenticado com papel `ADMIN` (`checkIfEmployeeIsAdmin()` como primeira etapa). O `id` (params) MUST ser um `cuid2`. A inativação MUST gravar a coluna `inactive` com a data/hora atual. A operação MUST ser interrompida quando a sala não existe (`404`) ou quando já está inativa (`400`).

#### Scenario: ADMIN inativa uma sala ativa

- **WHEN** um ADMIN chama `PATCH /rooms/deactivate/:id` para uma sala ativa
- **THEN** a coluna `inactive` recebe a data/hora atual
- **AND** a API responde `200` com mensagem de sucesso

#### Scenario: Sala inexistente

- **WHEN** o `:id` informado não corresponde a nenhuma sala
- **THEN** a API responde `404` e nada é alterado

#### Scenario: Sala já inativa

- **WHEN** a sala-alvo já possui `inactive` preenchido
- **THEN** a API responde `400` e nada é alterado

### Requirement: Ativação de sala por ADMIN

A API SHALL expor `PATCH /rooms/activate/:id` para reativar uma sala. A rota MUST exigir um funcionário autenticado com papel `ADMIN`. O `id` (params) MUST ser um `cuid2`. A ativação MUST zerar a coluna `inactive` (`null`). A operação MUST ser interrompida quando a sala não existe (`404`) ou quando já está ativa (`400`).

#### Scenario: ADMIN ativa uma sala inativa

- **WHEN** um ADMIN chama `PATCH /rooms/activate/:id` para uma sala com `inactive` preenchido
- **THEN** a coluna `inactive` passa a `null`
- **AND** a API responde `200` com mensagem de sucesso

#### Scenario: Sala inexistente

- **WHEN** o `:id` informado não corresponde a nenhuma sala
- **THEN** a API responde `404` e nada é alterado

#### Scenario: Sala já ativa

- **WHEN** a sala-alvo já está com `inactive` em `null`
- **THEN** a API responde `400` e nada é alterado
