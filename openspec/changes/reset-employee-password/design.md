## Contexto

O fluxo de "esqueci minha senha" tem duas etapas: (1) **solicitar** — validar o funcionário e enviar um código por e-mail; (2) **redefinir** — validar o código e gravar a nova senha. A change anterior entregou (1); esta entrega (2) e revisa decisões de (1). A tabela `tokens` já suporta `type: 'PASSWORD_RECOVER'`, `employeeId`, `code` e `expiresAt`.

## Decisões

### Rota de redefinição pública (sem `auth`)

Assim como a solicitação, `POST /employees/reset-password` **não** registra o plugin `auth`: quem está redefinindo a senha não consegue autenticar. A credencial é a posse do `code` recebido por e-mail.

### Validação do código

O código é buscado por `findUnique` (`code` + `type: 'PASSWORD_RECOVER'`). Código inexistente → `400`. Código com `expiresAt` no passado (comparado via `dayjs().isAfter(token.expiresAt)`) → `400` orientando solicitar nova redefinição.

### Nova senha não pode ser igual à anterior

Antes de gravar, compara-se (`bcrypt.compare`) a nova senha com o `passwordHash` atual; se iguais → `400`. Atende a RN do roadmap "Não trocar a senha se a nova for igual à antiga".

### Confirmação de senha no body

O Zod valida `password` e `confirmPassword` (mín. 8 caracteres) e um `.refine` garante igualdade, devolvendo erro em `confirmPassword` quando divergem — a validação ocorre antes de qualquer acesso ao banco.

### Troca de senha + invalidação do token em transação

`prisma.$transaction([delete token, update employee])` garante que a senha só muda se o token for consumido, e vice-versa — sem janela para reuso do código.

### E-mail de confirmação não-fatal e fora da transação

Após a troca, envia-se um e-mail de confirmação (`sendConfirmationChangedPassword.tsx`). O envio fica **fora** da transação e é **não-fatal**: falha apenas loga `console.error`, sem reverter a troca já efetivada nem retornar erro ao cliente — a senha já mudou; o e-mail é só aviso. Mesmo princípio de [[email-fora-da-transacao]].

### Revisão da atomicidade na solicitação

A change anterior mantinha token + e-mail dentro de uma transação com rollback. Revisado: o e-mail é enviado **antes** da transação; se o Resend falhar, lança-se `400` e nenhum token é criado (mesmo efeito prático de não deixar token órfão, sem manter a chamada de rede dentro da transação do banco). Além disso, a transação agora roda `deleteMany` dos tokens `PASSWORD_RECOVER` anteriores do funcionário antes de criar o novo — assim só existe **um código ativo por vez**, e solicitações repetidas invalidam as anteriores.

## Fluxo (redefinição)

1. Recebe `code`, `password`, `confirmPassword` (validados por Zod; senhas iguais).
2. `findUnique` busca o token (`code` + tipo). Não achou → `400`.
3. `expiresAt` no passado → `400` (expirado).
4. Busca o funcionário do token; não achou → `400`.
5. Nova senha igual à atual → `400`.
6. `$transaction`: apaga o token e grava o novo `passwordHash`.
7. Envia e-mail de confirmação (não-fatal) e responde `200`.
