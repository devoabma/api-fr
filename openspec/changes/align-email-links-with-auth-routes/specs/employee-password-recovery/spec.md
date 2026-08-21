## MODIFIED Requirements

### Requirement: Geração do código de recuperação

O sistema SHALL gerar o código de recuperação por meio de `generateRecoveryCode(length = 6)`, produzindo uma sequência alfanumérica (A–Z, 0–9) de tamanho configurável (padrão 6). O código MUST compor tanto o conteúdo do e-mail quanto o link de redefinição, que MUST ser `${WEB_URL}/auth/reset-password?code=...` — o caminho que o front web expõe para a tela de redefinição.

O caminho anterior (`${WEB_URL}/employees/reset-password?code=...`) MUST NOT ser usado: espelhava a rota da API, não a do front, e levava a um 404 com o código a tiracolo.

#### Scenario: Link do e-mail de recuperação

- **WHEN** o e-mail de recuperação é montado com o código gerado
- **THEN** o link MUST ser `${WEB_URL}/auth/reset-password?code=<code>`

#### Scenario: Recuperação pelo app desktop

- **WHEN** o funcionário usa o app desktop, que não abre o link
- **THEN** o código do corpo do e-mail MUST continuar bastando para a redefinição, sem dependência do caminho do front
