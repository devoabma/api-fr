# Design

## 1. `origin: '*'` e `credentials: true` são mutuamente exclusivos por especificação

Não é uma limitação do `@fastify/cors`, é regra do próprio CORS: quando a requisição carrega credenciais (cookie, `Authorization`, certificado de cliente), o navegador exige que `Access-Control-Allow-Origin` traga a origem **literal**. Receber `*` faz o navegador descartar a resposta.

O motivo é o coringa ser uma declaração pública — "qualquer um pode ler isto" — e credencial ser o oposto: a resposta é específica de uma sessão. Se o par fosse aceito, qualquer site aberto em outra aba leria dados da sessão de quem está logado. Por isso não existe caminho do meio: ou a API não usa cookie entre origens, ou ela nomeia a origem.

Como a autenticação da API **é** por cookie `httpOnly` (`authenticate.ts` grava o token; `@fastify/jwt` o lê pelo `cookieName`), a decisão já estava tomada em outro lugar do código. O `origin: '*'` era o resto de quando a API era consumida só pelo app desktop, que não passa por navegador nenhum.

## 2. Por que a origem vem do ambiente e não do código

O host do front muda entre desenvolvimento (`http://localhost:3000`) e produção, e não há nada no código que possa adivinhá-lo. `WEB_URL` já existia exatamente para isso — montar links de e-mail — e passou a governar também o CORS.

Reaproveitar a variável em vez de criar uma segunda (`CORS_ORIGIN`) foi deliberado: as duas descreveriam a mesma coisa, e duas variáveis para um fato só é convite a divergirem. O dia em que forem realmente diferentes — front servido de um host e e-mails apontando para outro — é o dia de separar.

## 3. O detalhe que quebra calado: a barra final

`WEB_URL` era `z.string()`. Para montar link de e-mail, `https://app.oabma.org.br/` funciona (gera `//sign-in`, que o navegador tolera). Para CORS, não:

| `WEB_URL` | `Origin` enviado pelo navegador | Casa? |
| --- | --- | --- |
| `https://app.oabma.org.br` | `https://app.oabma.org.br` | sim |
| `https://app.oabma.org.br/` | `https://app.oabma.org.br` | **não** |
| `app.oabma.org.br` | `https://app.oabma.org.br` | **não** |

O `@fastify/cors` compara strings. O header `Origin` é definido como esquema + host + porta — nunca tem caminho, nunca tem barra final. Então a barra digitada por engano no painel do Coolify produz o pior tipo de falha: **o front inteiro para, e o log da API fica limpo**, porque o navegador bloqueia antes de qualquer coisa chegar ao servidor. Quem investiga vai procurar no lugar errado por um bom tempo.

Daí o `webUrlSchema`:

```ts
const webUrlSchema = z
  .url()
  .default('http://localhost:3000')
  .transform(value => value.replace(/\/+$/, ''))
```

São duas defesas com naturezas diferentes:

- **`z.url()`** transforma o erro grosseiro (valor sem esquema) em **falha de boot**. A API já não sobe com variável de ambiente inválida; essa vira mais uma. Errar alto e cedo é melhor do que subir com CORS quebrado.
- **O `transform`** absorve o erro fino (barra final), que é sintaticamente uma URL válida e portanto passaria por qualquer validação. Aqui não dá para falhar — seria hostil derrubar o boot por uma barra —, então normaliza-se.

A regra por trás, que vale além deste caso: **quando um valor de configuração vira chave de comparação exata, validar o formato deixa de ser zelo e passa a ser parte do funcionamento.** Enquanto `WEB_URL` só concatenava strings, `z.string()` bastava.

## 4. Origem estranha recebe resposta, e é assim mesmo

Um detalhe que assusta na primeira leitura dos testes: o preflight vindo de `https://evil.example.com` responde `204` — com `Access-Control-Allow-Origin: https://app.oabma.org.br`.

Isso está correto. Com `origin` fixo em string, o `@fastify/cors` devolve sempre o mesmo header, sem olhar quem perguntou. Quem compara é o navegador: ele confronta o valor recebido com a própria origem, vê que não bate e **bloqueia a requisição real**, que nunca sai. A API não precisa (nem deveria) discriminar na resposta.

Efeito colateral bem-vindo: como a resposta não varia conforme o `Origin`, ela é cacheável sem `Vary: Origin`. Se um dia a origem virar array ou função, o header passa a ser calculado por requisição e o `Vary: Origin` passa a ser obrigatório — sem ele, um proxy compartilhado serve para a origem B o `Allow-Origin` que gerou para a origem A. Fica anotado para a hora em que a limitação nº 2 do `proposal.md` for endereçada.

## 5. Verificação

Feita com `app.inject()`, subindo a app com `WEB_URL='https://sala.oabma.org.br/'` — de propósito com a barra final, para provar a normalização:

| Cenário | Resultado |
| --- | --- |
| `env.WEB_URL` após o parse | `"https://sala.oabma.org.br"` (barra removida) |
| Preflight da origem correta | `204`, `allow-origin: https://sala.oabma.org.br`, `allow-credentials: true` |
| Preflight de `https://evil.example.com` | `204` com `allow-origin` da origem legítima → navegador bloqueia (ver §4) |
| `GET /health` sem header `Origin` | `200` — desktop, Insomnia e `curl` seguem funcionando |
| Boot com `WEB_URL="sala.oabma.org.br"` | erro de boot, API não sobe |

Somado a `npx tsc --noEmit` e `pnpm exec biome check src/`, ambos limpos.
