## MODIFIED Requirements

### Requirement: Autenticação de funcionário por CPF e senha

O sistema SHALL autenticar um funcionário a partir de `cpf` e `password` no endpoint `POST /employees/session/auth`. A entrada MUST ser validada (CPF válido pelo `cpfSchema` e senha com no mínimo 8 caracteres) antes de qualquer consulta ao banco. Quando as credenciais forem válidas e o funcionário estiver ativo, o sistema SHALL emitir um token JWT contendo `sub` (id do funcionário) e `role`, com expiração de 1 dia. Falhas de credenciais MUST ser sinalizadas via `UnauthorizedError` (resposta `401`) tratado pelo error handler global, e não mais por `reply.status(400)` inline.

#### Scenario: Credenciais válidas

- **WHEN** um funcionário ativo envia CPF e senha corretos
- **THEN** o sistema gera um JWT com `sub` e `role` válido por 1 dia
- **AND** a API responde `200` com o token no corpo
- **AND** define um cookie httpOnly com o mesmo token

#### Scenario: Senha incorreta

- **WHEN** o CPF existe mas a senha não confere com o `passwordHash` armazenado
- **THEN** a API responde `401` com mensagem genérica de credenciais inválidas
- **AND** nenhum token é emitido

#### Scenario: CPF não cadastrado

- **WHEN** não existe funcionário com o CPF informado
- **THEN** a API responde `401` com a mesma mensagem genérica de credenciais inválidas, sem revelar se o CPF existe
- **AND** nenhum token é emitido

#### Scenario: Entrada inválida

- **WHEN** o CPF é inválido ou a senha tem menos de 8 caracteres
- **THEN** a API rejeita a requisição na validação do schema, antes de consultar o banco

### Requirement: Bloqueio de funcionário inativo

O sistema SHALL impedir a autenticação de funcionários inativos. Um funcionário é considerado inativo quando o campo `inactive` está preenchido (data não nula). O bloqueio MUST ser sinalizado via `UnauthorizedError` (resposta `401`).

#### Scenario: Funcionário inativo

- **WHEN** o CPF e a senha corresponderiam a um funcionário, mas o funcionário está inativo
- **THEN** a API responde `401` informando que o funcionário está inativo e que deve contatar o administrador
- **AND** nenhum token é emitido
