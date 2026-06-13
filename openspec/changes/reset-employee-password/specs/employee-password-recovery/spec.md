## ADDED Requirements

### Requirement: Redefinição de senha a partir do código

A API SHALL expor a rota pública `POST /employees/reset-password` que recebe `code`, `password` e `confirmPassword` e, para um código de recuperação válido e não expirado, grava a nova senha do funcionário e invalida o código. A rota MUST NOT exigir autenticação. As senhas `password` e `confirmPassword` MUST ser iguais e ter no mínimo 8 caracteres.

#### Scenario: Redefinição válida

- **WHEN** uma requisição informa um `code` válido e não expirado, com `password` igual a `confirmPassword`
- **THEN** a API grava o novo `passwordHash` do funcionário e apaga o token de recuperação na mesma transação
- **AND** envia um e-mail de confirmação de alteração de senha
- **AND** responde `200` com mensagem de confirmação

#### Scenario: Código inexistente ou expirado

- **WHEN** o `code` não corresponde a um token `PASSWORD_RECOVER`, ou o token já passou de `expiresAt`
- **THEN** a API responde `400` orientando solicitar nova redefinição
- **AND** nenhuma senha é alterada

#### Scenario: Senha nova igual à anterior

- **WHEN** a nova senha informada é igual à senha atual do funcionário
- **THEN** a API responde `400` exigindo uma senha ainda não utilizada
- **AND** o token de recuperação não é consumido

#### Scenario: Confirmação de senha divergente

- **WHEN** `password` e `confirmPassword` não coincidem
- **THEN** a API responde `400` com erro de validação em `confirmPassword`
- **AND** nenhum acesso ao banco é realizado

### Requirement: Confirmação de alteração de senha por e-mail

Após uma redefinição bem-sucedida, o sistema SHALL enviar ao funcionário um e-mail de confirmação informando que a senha foi alterada, incluindo aviso de segurança caso ele não reconheça a ação. O envio MUST ocorrer fora da transação e ser não-fatal: uma falha no provedor MUST apenas ser registrada em log, sem reverter a troca já efetivada nem retornar erro ao cliente.

#### Scenario: Falha no e-mail de confirmação

- **WHEN** o provedor de e-mail retorna erro ao enviar a confirmação de alteração
- **THEN** a senha permanece alterada e a API responde `200`
- **AND** a falha é registrada em log

## MODIFIED Requirements

### Requirement: Atomicidade de token e e-mail

Na solicitação de redefinição, o envio do e-mail SHALL ocorrer antes da persistência do token: se o envio falhar, a operação MUST ser interrompida com `400` e nenhum token MUST ser criado. A criação do token SHALL ocorrer dentro de uma transação que primeiro apaga tokens `PASSWORD_RECOVER` anteriores do funcionário, garantindo um único código de recuperação ativo por vez.

#### Scenario: Falha no envio do e-mail

- **WHEN** o provedor de e-mail retorna erro durante a solicitação
- **THEN** a API responde `400` informando a falha de envio
- **AND** nenhum token de recuperação é persistido

#### Scenario: Solicitação repetida invalida o código anterior

- **WHEN** um funcionário com um token `PASSWORD_RECOVER` ativo solicita nova redefinição
- **THEN** os tokens `PASSWORD_RECOVER` anteriores são apagados na transação
- **AND** apenas o novo código permanece válido
