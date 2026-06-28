## ADDED Requirements

### Requirement: Retirar computador da manutenção

A API SHALL expor `PATCH /computers/maintenance/:id/remove` para retirar um computador da manutenção. A rota MUST registrar o plugin `auth` e MUST identificar o funcionário autenticado via `request.getIdCurrentEmployee()`. O `id` MUST ser um cuid no path.

A permissão é **híbrida**, refletindo que manutenção é uma operação e não gestão de inventário: um funcionário com papel `ADMIN` MUST poder retirar qualquer computador da manutenção; um funcionário comum MUST poder retirar da manutenção apenas computadores pertencentes a salas vinculadas a ele (`room.employeesRooms` contém o seu `employeeId`). Quando o `id` não referencia um computador existente — ou, para funcionário comum, está fora do seu escopo de salas — a API MUST responder `404`. Se o computador não estiver em manutenção (campo `maintenance` nulo), a API MUST responder `400`.

Em caso de sucesso, a atualização MUST gravar `maintenance = null`, tornando a máquina novamente disponível. A API MUST responder `200` com `{ message }`.

#### Scenario: ADMIN retira qualquer computador da manutenção

- **WHEN** um funcionário ADMIN autenticado envia o `id` de um computador em manutenção, independentemente de vínculo com a sala
- **THEN** o campo `maintenance` vira `null`
- **AND** a API responde `200` com `{ message }`

#### Scenario: Funcionário comum retira computador de sala vinculada da manutenção

- **WHEN** um funcionário comum autenticado envia o `id` de um computador em manutenção de uma sala vinculada a ele
- **THEN** o campo `maintenance` vira `null`
- **AND** a API responde `200` com `{ message }`

#### Scenario: Funcionário comum tenta computador fora das suas salas

- **WHEN** um funcionário comum envia o `id` de um computador que não pertence a nenhuma sala vinculada a ele
- **THEN** a API responde `404` e nada é atualizado

#### Scenario: Computador inexistente

- **WHEN** o `id` não corresponde a nenhum computador
- **THEN** a API responde `404` e nada é atualizado

#### Scenario: Computador não estava em manutenção

- **WHEN** o computador informado possui `maintenance` nulo
- **THEN** a API responde `400` e nada é atualizado

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
- **AND** nada é atualizado
