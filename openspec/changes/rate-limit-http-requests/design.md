# Design

## 1. Por que a chave do limite é o assunto principal

Escolher `max` e `timeWindow` é a parte fácil e a menos importante. O que decide se um limitador protege ou atrapalha é a **chave**: quem divide balde com quem.

Errar para o lado "amplo demais" transforma o limitador em auto-DoS — foi o que aconteceria com `TRUST_PROXY=false` em produção, onde todo mundo chega com o IP do Traefik e os 300/min viram 300/min para a API inteira. Errar para o lado "estreito demais" torna o limite decorativo, porque o atacante controla o que entra na chave e fabrica baldes à vontade.

As três chaves usadas aqui saem dessa leitura:

- **IP puro** — para rotas onde não existe identificador melhor antes da autenticação (`reset-password`, `close-computer`, teto global, 404).
- **IP + CPF** — no login. Só IP puniria um escritório inteiro atrás de NAT por causa de uma pessoa errando a senha; só CPF permitiria que qualquer um trancasse a conta de um colega de fora (bloqueio de conta como serviço). O par preserva as duas coisas: cada pessoa erra a própria senha 5 vezes sem afetar o vizinho, e ninguém tranca conta alheia.
- **IP + macCode** — nas rotas de terminal. O raciocínio é o mesmo do login e está detalhado abaixo, porque foi onde o desenho inicial errou.

## 2. O macCode sozinho era um DoS contra o terminal

A primeira versão de `macCodeKey` devolvia `mac:<macCode>`, sem IP. A intenção era boa: o limite é "por computador", e vários terminais atrás do mesmo NAT precisam de baldes separados.

O problema é que `macCode` chega do cliente, **sem autenticação**, na URL de `/printers/send-to-print/:macCode` e no corpo de `/lawyers/release-computer`. Quem soubesse o MAC de um terminal — algo que qualquer pessoa que já usou aquela máquina sabe — poderia, de qualquer lugar do mundo, gastar as 15 impressões da janela de 5 minutos e deixar o advogado sentado na frente do computador recebendo `429`. O atacante não precisava de conta, de sessão, nem de acertar nada: bastava repetir a chamada.

Verificado com `app.inject()` antes e depois da correção, com o atacante em `198.51.100.66` e o terminal em `203.0.113.99` usando o mesmo MAC:

| Chave | Atacante estoura o balde | Terminal legítimo em seguida |
| --- | --- | --- |
| `mac:<macCode>` | sim | **`429`** — advogado bloqueado |
| `<ip>:mac:<macCode>` | sim (no próprio balde) | `404` — segue o fluxo normal |

Prefixar com o IP é estritamente melhor: o NAT continua resolvido (terminais diferentes têm MAC diferente, então continuam em baldes distintos mesmo saindo pelo mesmo IP), e o atacante passa a gastar o próprio balde em vez do alheio. O custo é que um terminal que troque de IP (renovação de DHCP) ganha um balde novo — irrelevante, porque só afrouxa o limite para um cliente legítimo.

Vale registrar o padrão, porque ele volta: **chave de rate limit derivada só de entrada não autenticada é vetor de DoS contra a vítima cujo identificador foi usado.** O identificador do cliente sempre entra na chave; o do recurso apenas refina.

## 3. Por que o `429` passa pelo error handler

`@fastify/rate-limit` termina com `throw params.errorResponseBuilder(req, respCtx)`. O valor retornado pelo builder não é serializado pelo plugin — é lançado, e cai no `errorHandler` global da API.

Isso significa que devolver um objeto simples do builder faria o error handler não reconhecer nada, cair no `catch`-all e responder **`500`** para um caso que a API sabe tratar. Daí `TooManyRequestsError`: uma classe de domínio como as demais em `src/http/_errors/`, que o handler identifica com `instanceof` e traduz em `429`.

O `retryAfterInSeconds` vem de `context.ttl` (milissegundos restantes na janela), arredondado para cima — mesmo número que o plugin já pôs no header `retry-after`. Ele é repetido no corpo de propósito: o app desktop e o front leem JSON com schema tipado, e obrigar a leitura de header para montar uma contagem regressiva seria atrito sem ganho.

Os headers `x-ratelimit-*` e `retry-after` são gravados pelo plugin **antes** do `throw`, então sobrevivem ao caminho pelo error handler — confirmado no teste: `retry-after: 60` junto de `x-ratelimit-limit: 60`.

## 4. Hook: `onRequest` por padrão, `preValidation` quando a chave depende do corpo

O teto global roda em `onRequest`, o mais cedo possível no ciclo do Fastify: barra antes de ler o corpo do socket, antes de parsear JSON e antes de tocar em multipart. É onde o limite custa menos.

Duas rotas não podem ficar aí, porque a chave precisa de um campo do corpo (`cpf` no login, `macCode` na liberação) e em `onRequest` o corpo ainda não foi parseado. Elas usam `preValidation`, o primeiro ponto em que `request.body` existe. A troca é consciente e está registrada como limitação: requisição com corpo malformado morre no parser e não é contabilizada.

`/printers/send-to-print/:macCode` fica em `onRequest` mesmo lendo `macCode`, porque ali o dado vem de `request.params`, que o roteamento já preencheu antes do `onRequest`. Foi o que permitiu manter a rota de upload — a mais cara do conjunto — barrada antes de qualquer byte de arquivo ser lido.

## 5. A rota inexistente precisava de limitador explícito

O plugin instala o hook via `onRoute`, ou seja, **por rota registrada**. Uma URL que não casa com nenhuma rota nunca aciona esse hook, então `/qualquer-coisa` não passava por limitador nenhum, nem pelo global. Varredura de diretório e fuzzing de endpoint ficariam ilimitados.

A correção é dar ao `setNotFoundHandler` um `preHandler` com limitador próprio (`app.rateLimit({ max: 60, timeWindow: '1 minute' })`, herdando `keyGenerator`, `allowList` e `errorResponseBuilder` do global). O teto é menor que o global de propósito: requisição para rota inexistente é ruído, e 60/min é folgado para erro honesto de cliente.

Efeito colateral útil: por ser barata, essa é a rota ideal para validar `TRUST_PROXY` em produção — é o teste sugerido em `docs/DEPLOY.md`.

## 6. Ordem de registro em `app.ts` não é detalhe de estilo

Como o hook é instalado por rota registrada **depois** do plugin, `app.register(fastifyRateLimit, ...)` precisa vir antes de `appRoutes`. Registrar depois faria o plugin subir sem erro, sem log, e simplesmente não limitar nada — falha silenciosa da pior espécie.

O `setNotFoundHandler` vai dentro de `.after()` porque depende do decorator `app.rateLimit`, que só existe depois do plugin carregar. `app.register()` no Fastify é diferido: sem o `.after()`, a chamada aconteceria antes do decorator existir.

## 7. `skipOnError: true` — o limitador não pode derrubar a API

Se o store falhar, a escolha é entre recusar a requisição e atendê-la. Aqui o limitador é defesa contra abuso, não regra de negócio: nenhuma decisão de domínio depende dele. Falhar aberto significa, no pior caso, ficar temporariamente sem proteção; falhar fechado significa indisponibilidade total por causa de um componente acessório. Para uma API que atende balcão de atendimento presencial, a segunda opção é claramente pior.

## 8. `TRUST_PROXY` é a variável que decide se tudo isso funciona

Todo o desenho acima depende de `request.ip` ser o IP do cliente. Atrás do Cloudflare Tunnel + Traefik, quem abre a conexão TCP é sempre o Traefik, no IP interno do Docker — o IP real só existe no header `x-forwarded-for`.

O valor `loopback,uniquelocal` faz o Fastify ler a lista da direita para a esquerda, descartando faixas privadas, e parar no primeiro IP público. Isso é melhor que `true` (que pega o item mais à esquerda, justamente a parte que o cliente escreve, e é forjável) e melhor que contar hops com `2` (que quebra calado quando entra ou sai um proxy do caminho). A tabela completa com os quatro valores e o resultado de cada um está em `docs/DEPLOY.md`.

O schema em `env.ts` aceita `"true"`, `"false"`, número de hops ou lista de CIDRs, convertendo para o tipo que o Fastify espera. O padrão é `false` porque é o valor correto em desenvolvimento — e porque um padrão permissivo herdado por engano seria pior que um restritivo.

Essa é a única variável do projeto cujo valor errado **não** quebra o boot nem gera log: a API sobe normal e o limitador simplesmente conta todo mundo junto. Por isso ganhou seção própria no runbook e uma linha na tabela de troubleshooting.

## 9. `Math.random()` na recuperação de senha deixou de servir

`generateRecoveryCode` sorteia 6 caracteres de um alfabeto de 36 — 36⁶ ≈ 2,2 bilhões de combinações. Enquanto a rota de reset era ilimitada, esse número era o que segurava a adivinhação, e o gerador quase não importava.

Com teto de 10 tentativas por 10 minutos, o gargalo do atacante deixa de ser o espaço de busca e passa a ser a previsibilidade do gerador. `Math.random()` usa um PRNG rápido e não criptográfico: observar saídas suficientes permite reconstruir o estado interno e prever os próximos códigos. Como o atacante consegue observar saídas à vontade (basta pedir recuperação para contas que ele controla), essa é uma via prática.

`crypto.randomInt(max)` resolve com CSPRNG e, de quebra, sem o viés de módulo que `Math.floor(Math.random() * n)` introduz. A mudança é de uma linha, não altera o formato do código nem o contrato da rota, e faz o limite de tentativas ser a proteção que ele promete ser.
