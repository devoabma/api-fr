## Why

O front web (`web-fr`) agrupou as telas de autenticação sob o segmento `/auth`: o login mora em `/auth/sign-in` e a redefinição de senha em `/auth/reset-password`. A API não soube da mudança e continuou montando os links dos e-mails com os caminhos antigos — `${WEB_URL}/sign-in` e `${WEB_URL}/employees/reset-password?code=...`.

O sintoma é o pior tipo: **falha silenciosa do lado de fora**. A API responde `201`/`200`, o log não registra nada, o Resend entrega o e-mail sem erro. Só o destinatário descobre, ao clicar no botão e cair num 404 do front. E o clique é justamente o único caminho que a pessoa tem naquele momento — quem acabou de ser cadastrado não tem senha para tentar de novo, e quem pediu recuperação tem um código com **5 minutos de validade** que expira enquanto ela tenta entender o que aconteceu.

O caminho de recuperação, além disso, carrega o `code` na query string. Um link quebrado ali não é só um destino errado: é o código chegando numa rota que não existe e ninguém para lê-lo.

## What Changes

- **`create-account.ts`**: o link do e-mail de boas-vindas passa de `${WEB_URL}/sign-in` para `${WEB_URL}/auth/sign-in`.
- **`request-password-recovery.ts`**: o link do e-mail de recuperação passa de `${WEB_URL}/employees/reset-password?code=...` para `${WEB_URL}/auth/reset-password?code=...`. O `code` na query string permanece igual — o que muda é só o caminho.
- **`prisma/seed.ts`**: o e-mail do administrador semeado usa o mesmo template de cadastro e apontava para `${WEB_URL}/sign-in`. Corrigido junto — era o único ponto fora de `src/` e o mais fácil de esquecer, porque só dispara em `db:deploy`, uma vez por ambiente.
- **`env.ts`**: o comentário que explica por que `WEB_URL` não pode terminar em barra usava `${WEB_URL}/sign-in` como exemplo. Atualizado para o caminho real, para não virar a próxima pista falsa.
- **Nada muda no `change-password.ts` e no `reset-password.ts`**, que mandam `link: env.WEB_URL` — a raiz, sem caminho. O botão ali é "Acessar Plataforma", e a raiz continua sendo o destino certo: o front decide entre painel e login conforme a sessão.

## Capabilities

### Modified Capabilities
- `runtime-configuration`: os caminhos que a API concatena a `WEB_URL` deixam de ser detalhe de implementação e passam a ser contrato escrito — a API monta links para rotas que só existem no front, e essa dependência não estava registrada em lugar nenhum.
- `employee-password-recovery`: o link de redefinição, antes fixado no spec como `${WEB_URL}/employees/reset-password?code=...`, passa a ser `${WEB_URL}/auth/reset-password?code=...`.

## Impact

- Alterados: `src/http/core/employees/create-account.ts`, `src/http/core/employees/request-password-recovery.ts`, `src/http/env.ts` (comentário), `prisma/seed.ts`.
- Banco: nenhuma migração.
- Configuração: nenhuma variável de ambiente nova. `WEB_URL` continua sendo a origem do front, sem caminho e sem barra final.
- Clientes: o app desktop não é afetado — ele usa o **código** digitado, não o link. Só o front web recebe o clique.
- Documentação: `docs/DOC.md` (nota dos e-mails no fluxo de recuperação).

## Behavior Change

O botão dos e-mails de cadastro e de recuperação passa a abrir a tela certa do front. Antes disso, os dois caíam em 404.

Não há efeito retroativo: e-mails já enviados continuam com o link antigo. Para quem pediu recuperação e ficou com um link quebrado, o caminho é pedir de novo — o código antigo já terá expirado de qualquer forma.

## Known Limitations

1. **O acoplamento continua implícito.** A API sabe caminhos de outro repositório sem nenhum mecanismo que a avise quando eles mudarem — só um comentário e este spec. Uma renomeação de rota no `web-fr` volta a quebrar os e-mails do mesmo jeito, sem erro em lugar nenhum. Centralizar os caminhos num único módulo (`webRoutes.signIn`, `webRoutes.resetPassword`) tornaria a lista visível num arquivo só; não resolveria o desencontro entre repositórios, mas encurtaria a busca.

2. **Nada verifica o destino.** Não existe teste, nem checagem de boot, que confirme que `${WEB_URL}/auth/sign-in` responde. Uma requisição no boot atrasaria a subida da API por uma dependência que pode estar fora do ar por motivo alheio — a troca não compensa, mas o resultado é que a falha continua só aparecendo no clique de quem recebeu.

3. **`change-password` e `reset-password` apontam para a raiz.** Funciona porque o front redireciona, mas depende de esse redirecionamento existir. Se um dia a raiz do `web-fr` deixar de tratar visitante sem sessão, esses dois e-mails quebram sem que nada aqui mude.
