## ADDED Requirements

### Requirement: Colocar computador em manutenção

A API SHALL expor `PATCH /computers/maintenance/:id` para colocar um computador em manutenção. A rota MUST registrar o plugin `auth` e MUST identificar o funcionário autenticado via `request.getIdCurrentEmployee()`. O `id` MUST ser um cuid no path.

O computador MUST ser carregado no **escopo do departamento** — somente quando pertence a uma sala vinculada ao funcionário autenticado (`room.employeesRooms` contém o `employeeId`); caso contrário a API MUST responder `404`. Se o computador já estiver em manutenção (campo `maintenance` não-nulo), a API MUST responder `400`. Se o computador estiver em uso (`inUse`), a API MUST responder `400` e MUST NOT encerrar a sessão do advogado — a sessão deve ser encerrada antes.

Em caso de sucesso, a atualização MUST gravar `maintenance` com o instante atual e MUST deixar o estado consistente, definindo `inUse = false` e `currentLawyerId = null`. A API MUST responder `200` com `{ message }`.

#### Scenario: Funcionário coloca um computador do seu departamento em manutenção

- **WHEN** um funcionário autenticado envia o `id` de um computador livre de uma sala vinculada a ele
- **THEN** o campo `maintenance` recebe o instante atual, `inUse` vira `false` e `currentLawyerId` vira `null`
- **AND** a API responde `200` com `{ message }`

#### Scenario: Computador inexistente ou fora do departamento

- **WHEN** o `id` não corresponde a nenhum computador de uma sala vinculada ao funcionário
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
