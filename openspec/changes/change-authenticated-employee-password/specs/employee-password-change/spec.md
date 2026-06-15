## ADDED Requirements

### Requirement: Troca de senha do funcionário autenticado

A API SHALL expor a rota protegida `PATCH /employees/change-password` que recebe `currentPassword`, `newPassword` e `confirmNewPassword` e, para o funcionário autenticado que comprovar a senha atual, grava a nova senha. A rota MUST exigir autenticação (JWT) e identificar o funcionário pelo token, nunca por id no corpo. As senhas MUST ter no mínimo 8 caracteres, e `newPassword` MUST ser igual a `confirmNewPassword`.

#### Scenario: Troca válida

- **WHEN** um funcionário autenticado informa a `currentPassword` correta e uma `newPassword` válida, diferente da atual e igual a `confirmNewPassword`
- **THEN** a API grava o novo `passwordHash` do funcionário
- **AND** envia um e-mail de confirmação de alteração de senha
- **AND** responde `200` com mensagem de confirmação

#### Scenario: Requisição sem autenticação

- **WHEN** a rota é chamada sem um JWT válido
- **THEN** a API responde `401`
- **AND** nenhuma senha é alterada

#### Scenario: Senha atual incorreta

- **WHEN** a `currentPassword` informada não corresponde ao `passwordHash` do funcionário
- **THEN** a API responde `400` informando que a senha atual está incorreta
- **AND** nenhuma senha é alterada

#### Scenario: Nova senha igual à atual

- **WHEN** a `newPassword` é igual à senha atual do funcionário
- **THEN** a API responde `400` exigindo uma senha diferente da atual
- **AND** nenhuma senha é alterada

#### Scenario: Confirmação de senha divergente

- **WHEN** `newPassword` e `confirmNewPassword` não coincidem
- **THEN** a API responde `400` com erro de validação em `confirmNewPassword`
- **AND** nenhum acesso ao banco é realizado

### Requirement: Confirmação de troca de senha por e-mail

Após uma troca bem-sucedida, o sistema SHALL enviar ao funcionário um e-mail de confirmação informando que a senha foi alterada. O envio MUST ser não-fatal: uma falha no provedor MUST apenas ser registrada em log, sem reverter a troca já efetivada nem retornar erro ao cliente.

#### Scenario: Falha no e-mail de confirmação

- **WHEN** o provedor de e-mail retorna erro ao enviar a confirmação de alteração
- **THEN** a senha permanece alterada e a API responde `200`
- **AND** a falha é registrada em log
