## ADDED Requirements

### Requirement: Caminhos do front usados nos links de e-mail

A API SHALL montar os links dos e-mails transacionais concatenando `WEB_URL` com os caminhos que o front web expõe. Os caminhos MUST ser exatamente:

| E-mail | Origem | Link |
| --- | --- | --- |
| Cadastro de funcionário | `create-account.ts`, `prisma/seed.ts` | `${WEB_URL}/auth/sign-in` |
| Recuperação de senha | `request-password-recovery.ts` | `${WEB_URL}/auth/reset-password?code=<code>` |
| Confirmação de troca de senha | `change-password.ts`, `reset-password.ts` | `${WEB_URL}` (raiz, sem caminho) |

O link de recuperação MUST carregar o código na query string `code`, para que o front preencha o campo sem digitação. O app desktop MUST continuar aceitando o código digitado, sem depender do link.

Um caminho que não exista no front MUST ser tratado como defeito, ainda que a API responda com sucesso: o envio do e-mail é não-fatal e nada no log da API denuncia o destino quebrado — a falha só aparece para quem clica.

#### Scenario: Link do e-mail de cadastro

- **WHEN** um funcionário é cadastrado e o e-mail de boas-vindas é montado
- **THEN** o link MUST ser `${WEB_URL}/auth/sign-in`

#### Scenario: Link do e-mail de recuperação

- **WHEN** um funcionário pede recuperação de senha e o e-mail é montado
- **THEN** o link MUST ser `${WEB_URL}/auth/reset-password?code=<code>`, com o código gerado na query

#### Scenario: Link do e-mail de confirmação de troca de senha

- **WHEN** a senha é trocada pela conta autenticada ou redefinida pelo código
- **THEN** o link do e-mail de confirmação MUST ser a raiz `${WEB_URL}`, sem caminho, cabendo ao front decidir entre painel e login conforme a sessão

#### Scenario: `WEB_URL` com barra final

- **WHEN** a API sobe com `WEB_URL="https://app.exemplo.com/"`
- **THEN** a normalização do `webUrlSchema` MUST cortar a barra e o link montado MUST ser `https://app.exemplo.com/auth/sign-in`, sem barra dupla
