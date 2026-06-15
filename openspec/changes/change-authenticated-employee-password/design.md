## Contexto

Existem dois caminhos para um funcionário trocar a senha: (1) **esqueceu a senha** — recupera via código por e-mail (`reset-password.ts`, rota pública); (2) **conhece a senha atual** e quer substituí-la enquanto está logado. Esta change entrega (2). A tabela `employees` já guarda `passwordHash`; o middleware `auth` já expõe `request.getIdCurrentEmployee()`.

## Decisões

### Rota protegida por `auth`

`PATCH /employees/change-password` registra o plugin `auth`. A operação só faz sentido para quem está autenticado, e a identidade vem do JWT (`getIdCurrentEmployee`) — o cliente não envia o id do funcionário, evitando que alguém troque a senha de outro.

### Verbo `PATCH`

A operação altera parcialmente o recurso funcionário (apenas a senha), por isso `PATCH`, alinhado a `activate`/`deactivate`.

### Senha atual como credencial da troca

Antes de gravar, compara-se (`bcrypt.compare`) a `currentPassword` com o `passwordHash` atual; divergente → `400`. Mesmo autenticado, o funcionário precisa provar que conhece a senha vigente — protege contra troca por sessão sequestrada.

### Nova senha não pode ser igual à atual

Se `newPassword === currentPassword` → `400`. Atende à RN do roadmap "Não trocar a senha se a nova for igual à antiga", mesma regra do fluxo de reset.

### Confirmação no body

O Zod valida `currentPassword`, `newPassword` e `confirmNewPassword` (mín. 8) e um `.refine` garante `newPassword === confirmNewPassword`, devolvendo erro em `confirmNewPassword` quando divergem — validação antes de qualquer acesso ao banco.

### E-mail de confirmação não-fatal e fora da transação

Após a troca, envia-se o e-mail `sendConfirmationChangedPassword`. O envio é **não-fatal**: falha apenas loga `console.error`, sem reverter a troca nem retornar erro — a senha já mudou; o e-mail é só aviso de segurança. Mesmo princípio de [[email-fora-da-transacao]].

### Schema de erro `400` reutilizável

O error handler global ([[error-handler-zod-v6]]) já responde `400` de duas formas: validação Zod (`message` + `errors[]` de `{ field, message }`) e regra de negócio via `BadRequestError` (somente `message`). Até aqui cada rota declarava esse contrato como `z.object({ message: z.string() })` inline, perdendo o campo `errors` no OpenAPI e repetindo código. `badRequestSchema` centraliza o contrato (com `errors` opcional) e passa a ser referenciado pelas rotas, deixando o Swagger fiel ao que o handler realmente devolve.

## Fluxo (troca de senha)

1. `auth` valida o JWT; `getIdCurrentEmployee()` devolve o id.
2. Recebe `currentPassword`, `newPassword`, `confirmNewPassword` (validados por Zod; nova = confirmação).
3. `findUnique` busca o funcionário; não achou → `400`.
4. `bcrypt.compare(currentPassword, passwordHash)` falso → `400`.
5. `newPassword === currentPassword` → `400`.
6. `update` grava o novo `passwordHash` (`bcrypt.hash`).
7. Envia e-mail de confirmação (não-fatal) e responde `200`.
