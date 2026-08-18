## Why

O login grava o token num cookie `httpOnly` (`authenticate.ts`). `httpOnly` significa que **o JavaScript do front não enxerga nem apaga esse cookie** — é justamente a proteção que se quer contra XSS. A consequência prática é que sair da conta deixa de ser uma decisão local do navegador: só quem gravou o cookie pode apagá-lo, e quem gravou foi a API.

Sem uma rota de logout, o "sair" do painel conseguia no máximo limpar o estado da tela. O cookie continuava no navegador, válido pelo `maxAge` de 1 dia, e bastava recarregar a página para a sessão voltar — em máquina compartilhada de sala de fórum, isso é a sessão de um funcionário sobrevivendo ao próximo que senta na cadeira.

Ao implementar a rota, apareceu um segundo problema, mais amplo que o logout: **`axios` e `fetch` mandam `Content-Type: application/json` mesmo em requisição sem corpo**. O parser JSON padrão do Fastify trata isso como erro (`FST_ERR_CTP_EMPTY_JSON_BODY`), e o error handler classificava esse erro como desconhecido — respondendo `500 Erro interno do servidor` a uma requisição perfeitamente válida.

## What Changes

- **Nova rota `POST /employees/session/logout`** (`src/http/core/employees/logout.ts`): limpa o cookie de sessão com exatamente os mesmos atributos usados na gravação e responde `200 { message }`.
- **Parser de `application/json` próprio** (`src/http/app.ts`): corpo vazio vira `{}` e segue o fluxo normal; JSON malformado vira `BadRequestError` com mensagem em pt-BR.
- **Rede de segurança para 4xx do framework** (`src/http/_errors/index.ts`): erro que já traz `statusCode` entre 400 e 499 responde com esse status e mensagem traduzida, em vez de cair no `500`.

## Capabilities

### Added Capabilities
- `employee-authentication`: encerramento explícito de sessão, contrapartida obrigatória do login por cookie `httpOnly`.
- `http-error-handling`: parsing tolerante de corpo vazio em `application/json` e tradução dos erros 4xx nascidos no próprio Fastify.

## Impact

- Novos: `src/http/core/employees/logout.ts`.
- Alterados: `src/http/app.ts` (content type parser), `src/http/routes/index.ts` (registro da rota), `src/http/_errors/index.ts` (fallback 4xx).
- Banco: nenhuma migração. O token é stateless (JWT) e não há tabela de sessão de funcionário para invalidar.
- Configuração: nenhuma variável nova.

## Behavior Change

**Corpo vazio deixa de ser erro em toda a API.** Antes, `POST` com `Content-Type: application/json` e sem corpo respondia `500`; agora o corpo chega como `{}` e cada rota decide pelo seu próprio schema. Em rota que exige corpo, o Zod passa a rodar e devolver a lista de campos faltando — antes o front recebia um erro genérico do framework e não tinha como saber o que enviar.

**URL errada volta a responder `404`.** O corpo é parseado **antes** do roteamento, então qualquer chamada a rota inexistente com `Content-Type: application/json` e sem corpo respondia o erro de corpo vazio. Quem procurasse o bug ia parar no lugar errado.

**Erros 4xx do Fastify param de virar `500`.** Corpo maior que o limite, por exemplo, respondia `500 Erro interno do servidor` — que aponta o dedo para a API quando o problema é do cliente — e ainda ia parar no `console.error` como se fosse defeito.

## Known Limitations

1. **O logout não invalida o token, só o cookie.** O JWT é stateless: quem tiver copiado o token antes da saída continua conseguindo usá-lo até o `expiresIn` de 1 dia. Fechar essa janela exige lista de revogação (tabela ou Redis) consultada a cada requisição autenticada — custo que só se paga quando houver roubo de token no modelo de ameaça. Hoje o token vive em cookie `httpOnly`, fora do alcance do JavaScript, e a superfície para copiá-lo é pequena.

2. **A rota não exige autenticação.** Logout é idempotente e não expõe nada: sem cookie válido, o efeito é apagar um cookie que já não valia. Exigir sessão criaria o caso absurdo de "não consigo sair porque minha sessão expirou" — o front receberia `401` e o cookie inválido ficaria no navegador. O custo é que um site de terceiros pode forçar o logout de quem está logado (CSRF de logout); o dano é ter que fazer login de novo.

3. **`clearCookie` depende de os atributos baterem.** O navegador só remove o cookie se `path` e `domain` forem idênticos aos da gravação. Hoje os dois pontos repetem os mesmos valores lado a lado em `authenticate.ts` e `logout.ts`; se um dia `DOMAIN_URL` ou `path` mudar em um só, o logout falha em silêncio — responde `200` e o cookie permanece. Extrair as opções para um módulo compartilhado resolve, e fica registrado para quando surgir o terceiro ponto que grava o cookie.

4. **O parser aceita `{}` onde antes o framework barrava.** Rota sem schema de corpo que dependesse implicitamente do erro de corpo vazio passa a receber `{}`. Nenhuma rota da API dependia disso — a validação sempre foi do Zod —, mas a mudança é global e vale registrar.
