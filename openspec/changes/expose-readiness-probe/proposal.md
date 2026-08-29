## Why

A API tinha uma única rota de saúde, `GET /health`, e ela responde `200` sem tocar em nada: confirma que o processo Node/Fastify está de pé, mais nada. Isso atendia bem quem a consome — o `HEALTHCHECK` do Dockerfile —, mas deixava duas perguntas diferentes sendo respondidas pela mesma resposta.

- **O painel não tem como mostrar um selo honesto.** Com o banco fora do ar (Neon em cold start demorado, credencial trocada, rede caída), `/health` continua `200` e o selo do painel continua verde, enquanto toda rota de dado responde `500`. Quem olha o painel vê "API no ar" e o funcionário na sala vê erro — e a suspeita cai no front.
- **Misturar as duas perguntas numa rota só é pior do que não ter a segunda.** Se `/health` passasse a consultar o banco, o `HEALTHCHECK` do contêiner herdaria isso, e para o orquestrador "não saudável" significa uma coisa só: **reinicie o contêiner**. Reiniciar a API não conserta banco fora do ar — só derruba os WebSockets dos Desktops de todas as salas e, se a queda durar, vira laço de reinício. Com o Neon em scale-to-zero, um cold start já bastaria para disparar isso.

A separação clássica resolve: **vivacidade** (o processo está atendendo?) e **prontidão** (dá para atender de verdade?) são perguntas de consumidores diferentes e merecem rotas diferentes.

## What Changes

- **`GET /ready` (rota nova)**: sonda o banco com `SELECT 1` e responde `200 { status: 'ok', database: 'up' }` ou `503 { status: 'error', database: 'down' }`. Sem autenticação — é o que o selo do painel lê.
- **Teto de 3s na sondagem** (`DATABASE_PROBE_TIMEOUT_IN_MS`): o adapter espera até 15s por conexão nova (`connectionTimeoutMillis`, dimensionado para o cold start do Neon). Numa rota de dado essa espera protege a leitura; numa sonda, atrapalha — quem perguntou desiste antes por timeout do cliente e recebe erro de rede genérico em vez de um `503` legível. Estourar o tempo **é** a resposta.
- **`GET /health` permanece exatamente como estava** — sem tocar no banco, sem teto, isento do rate limit. Só ganhou um comentário dizendo de quem ele é e por que não deve crescer.
- **`/ready` entra com teto próprio de 60/min por IP**, declarado em `config.rateLimit` e registrado **dentro** do `.after()` do plugin de rate limit — ver *Design*, é a parte não óbvia.

## Capabilities

### Added Capabilities
- `health-probes`: a API passa a distinguir vivacidade (`/health`) de prontidão (`/ready`), respondendo `503` quando o processo está de pé mas o banco não responde.

### Modified Capabilities
- `rate-limiting`: a lista de rotas de infraestrutura isentas continua sendo só `/health` e `/docs`. `/ready` é explicitamente **não isenta** e recebe teto próprio, por ser rota pública que encosta no banco.

## Impact

- Alterados: `src/http/app.ts` (import do `prisma`, helper `isDatabaseReachable`, rota `/ready` dentro do `.after()`, docstrings em `/health` e `/ready`). Nenhum outro arquivo de código.
- Contrato HTTP: uma rota nova, pública. Nenhuma rota existente mudou de comportamento.
- Banco: nenhuma migração. A sonda é `SELECT 1`, sem escrita.
- Infraestrutura: o `HEALTHCHECK` do Dockerfile **não muda** — continua em `/health`, deliberadamente.
- Documentação: `docs/DEPLOY.md` (seção Health check reescrita para as duas rotas), `docs/DOC.md` (RNF novo + `/ready` na tabela de tetos), `docs/ROADMAP.md`.

## Behavior Change

Nenhuma para quem já consome a API hoje. `/health` responde igual, o healthcheck do contêiner se comporta igual, nenhuma rota de dado foi tocada.

O que muda é para quem for **escrever** o selo do painel: ele deve perguntar em `/ready`, não em `/health`, e tratar `503` como "API no ar, banco fora" — não como "API fora". São diagnósticos diferentes e levam a ações diferentes.

## Verificação

Medido com `app.inject()` contra a instância real, antes de fechar a entrega:

| O quê | Resultado |
| --- | --- |
| `GET /ready` com banco no ar | `200 {"status":"ok","database":"up"}`, com `x-ratelimit-limit: 60` |
| 65 chamadas seguidas a `/ready` | primeiro `429` exatamente na 61ª — o teto próprio está valendo |
| `GET /health` | `200`, **sem nenhum header `x-ratelimit-*`** — segue isento |
| `GET /ready` com `DATABASE_URL` apontando para IP inalcançável | `503 {"status":"error","database":"down"}` em **3.04s** (sem o teto, seriam 15s) |
| Rejeição não tratada após o timeout | nenhuma — a sonda perdedora da corrida **resolve** `false`, não rejeita |
| CORS a partir de `WEB_URL` | `GET` traz `access-control-allow-origin` + `credentials: true`; preflight `OPTIONS` responde `204` — o painel consegue ler |
| Rota inexistente | segue `404` com teto próprio de 60/min, intacta |

## Known Limitations

1. **`/ready` não aparece no `/docs`.** O `@fastify/swagger` também descobre rotas por hook `onRoute`, que só enxerga rotas registradas depois dele — e o plugin é registrado adiante no `app.ts`. `/health` já era invisível pelo mesmo motivo (confirmado: `app.swagger().paths` não contém nenhuma das duas). Rota de infraestrutura documentada em prosa é aceitável, mas `/ready` é contrato público que o painel vai consumir, e o lugar natural dele é o Scalar. Fechar isso exige mover as duas rotas para dentro de um `register` posterior ao Swagger — mexida com risco desproporcional ao ganho agora, fica registrada.

2. **Durante uma queda do banco, a sonda abandonada segura o encerramento.** Estourado o teto de 3s, o `$queryRaw` continua correndo até o `connectionTimeoutMillis` de 15s do pool. O `unref()` do timer garante que o **timer** não segure o processo, mas a tentativa de conexão pendente segura: medido, o processo levou mais 12.1s para sair sozinho depois do `app.close()`. Só importa em janela de indisponibilidade **e** durante um `docker stop` (cujo prazo padrão é 10s, seguido de `SIGKILL`) — o efeito é um encerramento menos gracioso, não perda de dado.

3. **A sonda responde por conexão, não por latência.** Banco que responde, mas lento a ponto de inutilizar as rotas de dado, continua devolvendo `database: 'up'` enquanto o `SELECT 1` couber nos 3s. A sonda diz "alcançável", não "saudável".

4. **`/ready` é rota pública que encosta no banco.** É por isso que ela tem teto e não entra na lista de isentas. Os 60/min por IP são folga larga para o painel (2 perguntas por minuto por aba aberta), mas o custo por chamada não é zero: cada `503` de banco fora prende um slot do pool por até 15s (ver limitação 2).
