## ADDED Requirements

### Requirement: Colocar computador em manutenção

A API SHALL expor `PATCH /computers/maintenance/:id` para colocar um computador em manutenção. A rota MUST registrar o plugin `auth` e MUST identificar o funcionário autenticado via `request.getIdCurrentEmployee()`. O `id` MUST ser um cuid no path.

A permissão é **híbrida**, refletindo que manutenção é uma operação e não gestão de inventário: um funcionário com papel `ADMIN` MUST poder colocar qualquer computador em manutenção; um funcionário comum MUST poder colocar em manutenção apenas computadores pertencentes a salas vinculadas a ele (`room.employeesRooms` contém o seu `employeeId`). Quando o `id` não referencia um computador existente — ou, para funcionário comum, está fora do seu escopo de salas — a API MUST responder `404`. Se o computador já estiver em manutenção (campo `maintenance` não-nulo), a API MUST responder `400`. Se o computador estiver em uso (`inUse`), a API MUST responder `400` e MUST NOT encerrar a sessão do advogado — a sessão deve ser encerrada antes.

Em caso de sucesso, a atualização MUST gravar `maintenance` com o instante atual e MUST deixar o estado consistente, definindo `inUse = false` e `currentLawyerId = null`. A API MUST responder `200` com `{ message }`.

#### Scenario: ADMIN coloca qualquer computador em manutenção

- **WHEN** um funcionário ADMIN autenticado envia o `id` de um computador livre, independentemente de vínculo com a sala
- **THEN** o campo `maintenance` recebe o instante atual, `inUse` vira `false` e `currentLawyerId` vira `null`
- **AND** a API responde `200` com `{ message }`

#### Scenario: Funcionário comum coloca computador de sala vinculada em manutenção

- **WHEN** um funcionário comum autenticado envia o `id` de um computador livre de uma sala vinculada a ele
- **THEN** o campo `maintenance` recebe o instante atual, `inUse` vira `false` e `currentLawyerId` vira `null`
- **AND** a API responde `200` com `{ message }`

#### Scenario: Funcionário comum tenta computador fora das suas salas

- **WHEN** um funcionário comum envia o `id` de um computador que não pertence a nenhuma sala vinculada a ele
- **THEN** a API responde `404` e nada é atualizado

#### Scenario: Computador inexistente

- **WHEN** o `id` não corresponde a nenhum computador
- **THEN** a API responde `404` e nada é atualizado

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
