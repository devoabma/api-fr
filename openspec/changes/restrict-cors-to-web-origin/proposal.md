## Why

O front web autentica por **cookie `httpOnly`**: `POST /employees/session/auth` grava o token com `setCookie`, e o navegador reenvia esse cookie nas chamadas seguintes. Para isso funcionar entre origens diferentes (`app` num host, API em `api-fr.oabma.org.br`), o navegador exige **duas** coisas do lado da API:

1. `Access-Control-Allow-Credentials: true`;
2. `Access-Control-Allow-Origin` com **a origem explícita** — a especificação de CORS proíbe o coringa `*` em resposta a requisição com credenciais, e o navegador descarta a resposta em vez de aceitá-la.

A API estava com `origin: '*'` e sem `credentials`. A consequência é que o cookie de sessão nunca completava o ciclo no front web: ou não era gravado, ou não era reenviado, e o painel caía em erro de autenticação sem nenhum registro no log da API — porque a decisão acontece no navegador, antes de a requisição chegar ao servidor.

## What Changes

- **`src/http/app.ts`**: o registro do `@fastify/cors` passa de `{ origin: '*' }` para `{ origin: env.WEB_URL, credentials: true }`.
- **`src/http/env.ts`**: `WEB_URL` deixa de ser `z.string()` e passa por `webUrlSchema` — `z.url()` com corte das barras finais (`value.replace(/\/+$/, '')`).

  Isso não é enfeite: o header `Origin` que o navegador envia **nunca** tem barra no fim nem caminho, e o `@fastify/cors` compara a string byte a byte. Um `WEB_URL="https://app.oabma.org.br/"` no painel do Coolify — erro trivial de digitação — derrubaria o front inteiro com erro de CORS, sem uma linha no log da API. A mesma normalização conserta, de quebra, os links de e-mail (`${WEB_URL}/sign-in` viraria `//sign-in`).

  E `z.url()` faz um valor sem esquema (`"app.oabma.org.br"`) **derrubar o boot** em vez de subir a API com CORS quebrado — a API já trata variável inválida como falha de inicialização, e essa passa a ser uma delas.

## Capabilities

### Added Capabilities
- `http-cors-policy`: a API passa a declarar uma política de CORS explícita, com origem única vinda do ambiente e credenciais habilitadas, sustentando a autenticação por cookie do front web.

### Modified Capabilities
- `runtime-configuration`: `WEB_URL` passa a ser validada como URL e normalizada sem barra final, porque agora governa também a política de CORS, onde um valor malformado falha em silêncio.

## Impact

- Alterados: `src/http/app.ts` (registro do CORS), `src/http/env.ts` (`webUrlSchema`).
- Contrato HTTP: nenhuma rota nova ou alterada. Muda apenas o par de headers `Access-Control-Allow-Origin` / `Access-Control-Allow-Credentials` nas respostas e no preflight.
- Banco: nenhuma migração.
- Configuração: `WEB_URL` deixa de ser opcional na prática — em produção precisa ser exatamente a origem do front (esquema + host + porta, sem caminho e sem barra final).

## Behavior Change

**Front web**: as chamadas precisam sair com `credentials: 'include'` (fetch) ou `withCredentials: true` (axios). Sem isso o navegador não anexa o cookie e a API responde `401`, mesmo com o login tendo dado certo — é o sintoma mais provável logo depois deste deploy.

**Qualquer outra origem de navegador** deixa de conseguir ler respostas da API. Na prática isso atinge páginas de teste servidas de `localhost` em porta diferente da configurada e ferramentas web de terceiros; o consumo legítimo passa a ser exclusividade do front configurado.

**App desktop, Insomnia, `curl` e o canal WebSocket não são afetados.** CORS é uma regra aplicada pelo navegador, não pelo servidor: cliente que não manda `Origin` não é avaliado, e o `@fastify/cors` não bloqueia essas requisições. Confirmado por `app.inject()` sem header `Origin` (`GET /health` → `200`).

## Known Limitations

1. **CORS não é controle de acesso.** Ele decide o que o **navegador** entrega a uma página, não o que a API atende. `curl` e qualquer script fora do navegador continuam alcançando todas as rotas exatamente como antes. Quem protege a API é a autenticação, o rate limit e a autorização por papel — CORS só protege a sessão da pessoa que está logada de ser usada por um site malicioso aberto em outra aba.

2. **Uma única origem.** `origin` recebe uma string, então existe exatamente um front autorizado. Ambiente de homologação com host próprio, ou um segundo painel, exigirá trocar para lista/array (o `@fastify/cors` aceita `string[]`) e uma variável que carregue mais de um valor. Não foi feito agora porque hoje existe um front só, e lista de origens costuma virar porta destrancada quando ninguém revisa o conteúdo dela.

3. **`sameSite: 'none'` em produção continua mais permissivo do que precisa.** O cookie é gravado com `sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax'`, ou seja, o navegador o envia em requisições vindas de qualquer site. As rotas que mudam estado usam JSON, o que obriga o preflight — e o preflight agora barra origem estranha, então o pedido nem chega. Mas se front e API ficarem sob o mesmo domínio registrável (`*.oabma.org.br`), `lax` passa a ser suficiente e fecha a exposição na origem em vez de depender do preflight. Registrado para decisão, fora do escopo desta mudança por alterar o comportamento do login.
