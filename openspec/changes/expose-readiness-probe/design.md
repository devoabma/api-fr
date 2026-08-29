# Design

## 1. A pergunta importante não é "o banco respondeu", é "quem lê a resposta"

Uma sonda de saúde não vale pelo que ela mede, e sim pelo que o consumidor **faz** com o resultado. Os dois consumidores desta API querem coisas opostas:

| Consumidor | Pergunta | O que faz com um "não" |
| --- | --- | --- |
| `HEALTHCHECK` do Dockerfile / Coolify | o processo está atendendo? | **reinicia o contêiner** |
| Selo do painel web | dá para atender de verdade? | **avisa a pessoa** e para de tentar |

Daí a separação. Se `/health` passasse a consultar o banco, o orquestrador reagiria a uma queda de banco com a única ferramenta que ele tem — reinício — e o resultado seria estritamente pior do que não medir nada: os WebSockets de todos os Desktops caem, cada estação reconecta, e se a queda durar o contêiner entra em laço de reinício. Com o Neon em scale-to-zero, um cold start de 20s já bastaria.

O inverso também não serve: se o painel perguntar em `/health`, ele vai mostrar verde enquanto o funcionário na sala toma `500` em toda ação. O selo estaria mentindo com sinceridade.

Então: `/health` **de propósito** não toca em nada e continua sendo do contêiner. `/ready` toca no banco e é do painel.

## 2. O teto de 3s existe porque a espera do adapter foi calibrada para outra coisa

`src/lib/prisma.ts` define `connectionTimeoutMillis: 15_000`, dimensionado para o cold start do Neon. É a escolha certa **para rota de dado**: melhor esperar 15s e entregar a listagem do que falhar porque o banco estava acordando.

Numa sonda, esse mesmo número inverte de sinal. A sonda existe justamente para responder rápido quando as coisas vão mal — e é exatamente aí que ela demoraria mais. Uma sonda que trava 15s com o banco fora perde para o timeout do cliente que perguntou: o painel cancela a chamada e recebe um erro de rede genérico, indistinguível de "a API caiu". O `503` legível, que era o produto inteiro desta entrega, nunca chega.

Por isso o `Promise.race`: **estourar o tempo é a resposta**, não um erro a propagar. Três segundos é curto o bastante para o painel não desistir antes e longo o bastante para não confundir latência normal com queda.

Duas escolhas pequenas dentro do helper, ambas deliberadas:

- **Nenhuma das duas pontas rejeita.** A sonda usa `.then(() => true, () => false)` em vez de `.catch()` depois do `race` — assim a promise perdedora da corrida **resolve** em vez de ficar pendurada rejeitando sozinha depois. Sem isso, cada `503` deixaria uma rejeição não tratada para trás, e no Node moderno isso derruba o processo. Verificado com um listener de `unhandledRejection`: nenhuma disparou.
- **`unref()` no timer.** Um timer de 3s ainda pendente não deve segurar o processo no encerramento. (Vale registrar: medido, quem realmente segura o encerramento durante uma queda é a tentativa de conexão abandonada do pool — 12.1s a mais depois do `app.close()`, o resto dos 15s. O `unref()` continua certo; ele só não é o gargalo.)

## 3. Onde a rota mora não é estilo — foi medido

Esta é a parte que engana. `/health` está declarada em nível de raiz, direto no `app.ts`. Copiar esse padrão para `/ready` teria produzido uma rota **sem teto de requisição nenhum**, e nada no código apontaria isso.

O motivo é a mecânica do `@fastify/rate-limit`: ele não instala um hook global de uma vez, ele escuta `onRoute` e instala o limitador **rota a rota**, conforme cada uma é registrada. Hook `onRoute` só enxerga rotas registradas **depois** dele. E toda chamada `app.get(...)` escrita em nível de raiz roda de forma síncrona, no primeiro tick — antes de qualquer `app.register(...)`, que é adiado para a sequência de boot do avvio.

Consequência: **rota de raiz nunca é vista pelo plugin de rate limit**, por mais abaixo que ela esteja no arquivo.

Em `/health` isso é indiferente: ele já está na `allowList` de `UNLIMITED_ROUTES` e não toca em nada — o efeito prático é zero (e é observável: a resposta de `/health` não traz nenhum header `x-ratelimit-*`, porque o limitador nem roda ali). Em `/ready` seria um buraco: rota pública, sem autenticação, que manda a API abrir conexão com o banco. Sem teto, é um jeito barato de um estranho consumir o pool.

Por isso `/ready` é declarada **dentro do `.after()`** do registro do plugin — o mesmo bloco onde já mora o `setNotFoundHandler`, e pelo mesmo tipo de razão.

Medição que fecha o argumento: 65 chamadas seguidas a `/ready`, primeiro `429` na 61ª. O teto está valendo.

> Mesma mecânica, outro plugin: o `@fastify/swagger` também descobre rotas por `onRoute`. Como ele é registrado depois, nem `/health` nem `/ready` aparecem no `/docs` — confirmado em `app.swagger().paths`. Está registrado como limitação conhecida na proposta.

## 4. `config.rateLimit`, e não `preHandler`

O `setHandler` de 404 logo acima usa `preHandler: app.rateLimit({...})`. Seria natural copiar isso — e estaria errado por um detalhe de encapsulamento.

Aquele padrão funciona **porque o 404 não é uma rota registrada**: ele escapa do mecanismo de `onRoute` e precisa de um limitador anexado à mão. Em rota de verdade, o caminho suportado é `config.rateLimit`, que é o que o hook `onRoute` do plugin lê para decidir os parâmetros daquela rota.

O teto de 60/min por IP é folga larga de propósito: o painel pergunta ~2 vezes por minuto por aba aberta. O número existe para conter abuso, não para racionar o uso legítimo.

## 5. O que a sonda deliberadamente não faz

- **Não mede latência.** Banco lento a ponto de inutilizar as rotas de dado, mas que responde `SELECT 1` dentro dos 3s, sai como `up`. A sonda afirma alcançabilidade, não saúde. Transformá-la em medidor de latência exigiria escolher um limiar — e um limiar errado é pior que nenhum, porque produz alarme falso em cold start.
- **Não checa Supabase, Resend nem Protheus.** Dependências externas caem sozinhas e não impedem a API de atender a maior parte do trabalho. Colocá-las na sonda faria o selo do painel ficar vermelho por causa de um provedor de e-mail — e ninguém saberia mais o que o vermelho significa. Cada uma dessas já falha de forma legível na rota que a usa.
- **Não escreve nada.** `SELECT 1` não abre transação, não toca em tabela e não pode ser confundido com carga. Uma sonda que escreve vira um problema próprio quando o painel de 15 abas abertas a chama em laço.
