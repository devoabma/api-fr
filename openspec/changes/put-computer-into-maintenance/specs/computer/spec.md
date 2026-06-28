## ADDED Requirements

### Requirement: Colocar computador em manutenção

A API SHALL expor `PATCH /computers/maintenance/:id` para colocar um computador em manutenção. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`. O `id` MUST ser um cuid no path.

O `id` MUST referenciar um computador existente; caso contrário a API MUST responder `404`. Um ADMIN pode colocar qualquer computador em manutenção, independentemente de vínculo com a sala. Se o computador já estiver em manutenção (campo `maintenance` não-nulo), a API MUST responder `400`. Se o computador estiver em uso (`inUse`), a API MUST responder `400` e MUST NOT encerrar a sessão do advogado — a sessão deve ser encerrada antes.

Em caso de sucesso, a atualização MUST gravar `maintenance` com o instante atual e MUST deixar o estado consistente, definindo `inUse = false` e `currentLawyerId = null`. A API MUST responder `200` com `{ message }`.

#### Scenario: ADMIN coloca um computador em manutenção

- **WHEN** um funcionário ADMIN autenticado envia o `id` de um computador livre
- **THEN** o campo `maintenance` recebe o instante atual, `inUse` vira `false` e `currentLawyerId` vira `null`
- **AND** a API responde `200` com `{ message }`

#### Scenario: Computador inexistente

- **WHEN** o `id` não corresponde a nenhum computador
- **THEN** a API responde `404` e nada é atualizado

#### Scenario: Funcionário sem permissão

- **WHEN** a chamada é feita por um funcionário não-ADMIN
- **THEN** a API responde `401` e nada é atualizado

#### Scenario: Computador já em manutenção

- **WHEN** o computador informado já possui `maintenance` não-nulo
- **THEN** a API responde `400` e nada é atualizado

#### Scenario: Computador em uso

- **WHEN** o computador informado está em uso (`inUse`)
- **THEN** a API responde `400`, a sessão do advogado é preservada e nada é atualizado

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
- **AND** nada é atualizado
