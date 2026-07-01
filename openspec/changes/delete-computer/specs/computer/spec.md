## ADDED Requirements

### Requirement: Deletar computador do inventário

A API SHALL expor `DELETE /computers/delete/:id` para remover um computador do inventário. A rota MUST registrar o plugin `auth`. O `id` MUST ser um cuid no path.

A permissão é **restrita a ADMIN**, refletindo que remover do inventário é gestão e não operação: a rota MUST validar o papel via `request.checkIfEmployeeIsAdmin()`. Uma requisição de funcionário comum MUST responder `403`; sem JWT ou com token inválido/expirado MUST responder `401`.

Quando o `id` não referencia um computador existente, a API MUST responder `404`. Se o computador estiver em uso (`inUse` verdadeiro), a API MUST responder `400` em vez de derrubar a sessão do advogado silenciosamente — a sessão MUST ser encerrada antes.

Em caso de sucesso, a API MUST remover o computador e responder `200` com `{ message }`. O histórico de sessões (`ComputerSessions`) e as impressões (`Printers`) vinculadas MUST ser removidos em cascata (`onDelete: Cascade`), garantindo que a remoção não falhe por violação de foreign key.

#### Scenario: ADMIN deleta computador livre

- **WHEN** um funcionário ADMIN autenticado envia o `id` de um computador que não está em uso
- **THEN** o computador e seu histórico dependente (sessões e impressões) são removidos
- **AND** a API responde `200` com `{ message }`

#### Scenario: Computador em uso

- **WHEN** o `id` referencia um computador com `inUse` verdadeiro
- **THEN** a API responde `400` e nada é removido

#### Scenario: Computador inexistente

- **WHEN** o `id` não corresponde a nenhum computador
- **THEN** a API responde `404` e nada é removido

#### Scenario: Funcionário comum tenta deletar

- **WHEN** um funcionário sem papel ADMIN envia a requisição
- **THEN** a API responde `403` e nada é removido

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
- **AND** nada é removido
