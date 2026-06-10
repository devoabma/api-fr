## MODIFIED Requirements

### Requirement: Autorização ADMIN para criação de funcionário

A criação de funcionário SHALL ser restrita a funcionários autenticados com papel `ADMIN`. A rota `POST /employees/create-account` MUST registrar o plugin `auth` e executar `request.checkIfEmployeeIsAdmin()` como primeira etapa do handler, antes de qualquer validação de unicidade ou persistência. Quando o JWT estiver ausente/inválido ou o funcionário não for `ADMIN`, a operação MUST ser interrompida com `UnauthorizedError` (`401`), sem consultar ou criar registros.

#### Scenario: Requisição sem autenticação

- **WHEN** uma requisição de criação chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
- **AND** nenhuma validação de CPF/e-mail é executada e nenhum funcionário é criado

#### Scenario: Funcionário autenticado sem papel ADMIN

- **WHEN** um funcionário autenticado com `role` diferente de `ADMIN` tenta criar uma conta
- **THEN** a API responde `401` com mensagem de acesso negado
- **AND** nenhum funcionário é criado e nenhum e-mail é enviado

#### Scenario: Funcionário ADMIN autenticado

- **WHEN** um funcionário autenticado com `role: 'ADMIN'` envia uma requisição válida de criação
- **THEN** o fluxo de criação prossegue (validação de unicidade, persistência e e-mail de boas-vindas)
- **AND** a API responde `201` com mensagem de sucesso
