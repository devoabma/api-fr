## ADDED Requirements

### Requirement: Autenticação de funcionário por CPF e senha

O sistema SHALL autenticar um funcionário a partir de `cpf` e `password` no endpoint `POST /employees/session/auth`. A entrada MUST ser validada (CPF válido pelo `cpfSchema` e senha com no mínimo 8 caracteres) antes de qualquer consulta ao banco. Quando as credenciais forem válidas e o funcionário estiver ativo, o sistema SHALL emitir um token JWT contendo `sub` (id do funcionário) e `role`, com expiração de 1 dia.

#### Scenario: Credenciais válidas

- **WHEN** um funcionário ativo envia CPF e senha corretos
- **THEN** o sistema gera um JWT com `sub` e `role` válido por 1 dia
- **AND** a API responde `200` com o token no corpo
- **AND** define um cookie httpOnly com o mesmo token

#### Scenario: Senha incorreta

- **WHEN** o CPF existe mas a senha não confere com o `passwordHash` armazenado
- **THEN** a API responde `400` com mensagem genérica de credenciais inválidas
- **AND** nenhum token é emitido

#### Scenario: CPF não cadastrado

- **WHEN** não existe funcionário com o CPF informado
- **THEN** a API responde `400` com a mesma mensagem genérica de credenciais inválidas, sem revelar se o CPF existe
- **AND** nenhum token é emitido

#### Scenario: Entrada inválida

- **WHEN** o CPF é inválido ou a senha tem menos de 8 caracteres
- **THEN** a API rejeita a requisição na validação do schema, antes de consultar o banco

### Requirement: Bloqueio de funcionário inativo

O sistema SHALL impedir a autenticação de funcionários inativos. Um funcionário é considerado inativo quando o campo `inactive` está preenchido (data não nula).

#### Scenario: Funcionário inativo

- **WHEN** o CPF e a senha corresponderiam a um funcionário, mas o funcionário está inativo
- **THEN** a API responde `400` informando que o funcionário está inativo e que deve contatar o administrador
- **AND** nenhum token é emitido

### Requirement: Entrega do token via corpo e cookie

O sistema SHALL entregar o token tanto no corpo da resposta quanto em um cookie httpOnly nomeado por `TOKEN_COOKIE_NAME`, atendendo o app desktop (corpo) e o front web (cookie). As flags do cookie MUST se ajustar ao ambiente: em produção `secure: true` e `sameSite: 'none'`; fora de produção `secure: false` e `sameSite: 'lax'`. O cookie MUST ter `path: '/'`, `domain` igual a `DOMAIN_URL` e `maxAge` de 1 dia, coerente com a expiração do JWT.

#### Scenario: Cookie em produção

- **WHEN** o token é emitido com `NODE_ENV=production`
- **THEN** o cookie é definido com `httpOnly: true`, `secure: true` e `sameSite: 'none'`

#### Scenario: Cookie em desenvolvimento

- **WHEN** o token é emitido com `NODE_ENV=dev`
- **THEN** o cookie é definido com `httpOnly: true`, `secure: false` e `sameSite: 'lax'`
