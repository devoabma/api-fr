## ADDED Requirements

### Requirement: Solicitação de redefinição de senha

A API SHALL expor a rota pública `POST /employees/password-recovery` que recebe `cpf` e `email` e, para um funcionário existente, gera um código de recuperação temporário e o envia por e-mail. A rota MUST NOT exigir autenticação. O funcionário MUST ser identificado pela combinação `cpf` + `email` no mesmo registro.

#### Scenario: Solicitação válida

- **WHEN** uma requisição informa `cpf` e `email` que correspondem ao mesmo funcionário
- **THEN** a API cria um token `PASSWORD_RECOVER` vinculado ao funcionário, com expiração de 5 minutos
- **AND** envia um e-mail contendo o código e o link de redefinição
- **AND** responde `200` com mensagem de confirmação

#### Scenario: Credenciais não correspondem

- **WHEN** o par `cpf`/`email` não corresponde a nenhum funcionário
- **THEN** a API responde `400` com mensagem genérica de "Credenciais inválidas"
- **AND** nenhum token é criado e nenhum e-mail é enviado

### Requirement: Atomicidade de token e e-mail

A criação do token e o envio do e-mail SHALL ocorrer dentro de uma transação. Se o envio do e-mail falhar, a operação MUST ser interrompida com `400` e o token MUST sofrer rollback, não deixando token órfão.

#### Scenario: Falha no envio do e-mail

- **WHEN** o provedor de e-mail retorna erro durante a solicitação
- **THEN** a API responde `400` informando a falha de envio
- **AND** o token de recuperação não é persistido (rollback da transação)

### Requirement: Geração de código de recuperação

O sistema SHALL gerar o código de recuperação por meio de `generateRecoveryCode(length = 6)`, produzindo uma sequência alfanumérica (A–Z, 0–9) de tamanho configurável (padrão 6). O código MUST compor tanto o conteúdo do e-mail quanto o link de redefinição (`${WEB_URL}/employees/reset-password?code=...`).

#### Scenario: Código padrão de 6 caracteres

- **WHEN** `generateRecoveryCode()` é chamada sem argumentos
- **THEN** retorna uma string de 6 caracteres do conjunto `A–Z0–9`
