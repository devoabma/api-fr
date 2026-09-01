## Why

O painel (`web-fr`) vai ganhar a tela `/metrics`, que mostra liberações por ano, por mês, por sala e por advogado, mais quatro indicadores de topo. Hoje a API não tem **nenhuma** agregação: não existe `groupBy`, `aggregate` nem `_count` em `src/`, e a única rota de leitura de sessões é `GET /lawyers/get-all-releases/:roomId?`, que devolve a lista bruta **sem paginação**.

Montar a tela sobre essa rota obrigaria o navegador a baixar o histórico inteiro para desenhar o gráfico "por ano". Num volume realista (~28 mil sessões) isso é da ordem de 11 MB de JSON por visita, parseados e agregados no cliente — e a `computer_sessions` só tem a chave primária, então nem no banco a varredura é barata.

## What Changes

- **Novo caso de uso `get-releases-metrics.ts`** (`GET /lawyers/releases-metrics/:roomId?`): rota autenticada (JWT de funcionário via `auth`), que devolve os números **já agregados** no Postgres.
  - `roomId` (param opcional, cuid2): recorta os indicadores, `byYear` e `byMonth` para uma sala.
  - `year` (querystring opcional, inteiro): ano de referência. Sem ele, o ano corrente no fuso da Seccional.
  - Visibilidade por papel via `getCurrentEmployee()`: ADMIN vê todas as salas; MEMBER só as salas em que está vinculado — mesmo recorte de `get-all-releases`. **Sem** `checkIfEmployeeIsAdmin()`: a tela fica na seção "Operação" do painel, visível para MEMBER.
  - `byRoom` **deliberadamente ignora** o `roomId`: é um ranking entre salas, e comparar uma sala com ela mesma não informa nada. Sempre lista todas as salas visíveis ao funcionário, inclusive as que não tiveram liberação (com `total: 0`).
  - `byLawyer` vem completo e ordenado por total decrescente: o painel fatia o top 10 e usa o resto no ranking completo, sem uma segunda chamada.
- **Agregação por ano/mês no fuso da Seccional**: `started_at` é `TIMESTAMP(3)` **sem** timezone e o Prisma grava em UTC, então o agrupamento usa a dupla conversão `AT TIME ZONE 'UTC' AT TIME ZONE <env.TIMEZONE>`. Sem isso, uma liberação das 23h de 31/12 apareceria em janeiro do ano seguinte.
- **Tempo médio de sessão só conta sessões encerradas** (`ended_at IS NOT NULL`) e descarta durações não-positivas ou acima de 24 h. O `auto-close-sessions.cron` fecha sessões expiradas a cada minuto, mas se ficar fora do ar ele as fecha depois com `endedAt = now` — gravando durações infladas que ficam no banco para sempre e envenenariam a média.
- **`get-all-releases.ts`**: passa a devolver `lawyer.oab` (mudança aditiva). O ranking de advogados do painel identifica cada pessoa pela inscrição, e hoje a rota só devolve `{ id, name }`.
- **Índices em `computer_sessions`**: a tabela só tinha a PK. Adiciona índice em `started_at`, `computer_id` e `lawyer_id`.
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/lawyers`.

## Capabilities

### Added Capabilities
- `lawyer`: agregação das liberações por ano, mês, sala e advogado, com indicadores de topo e comparação contra o mesmo período do ano anterior.

### Modified Capabilities
- `lawyer`: a listagem de sessões passa a expor a inscrição (`oab`) do advogado.

## Impact

- Código novo: `src/http/core/lawyers/get-releases-metrics.ts`.
- Alterado: `src/http/routes/index.ts` (registro da rota), `src/http/core/lawyers/get-all-releases.ts` (campo `oab` no `select` e no schema de resposta).
- Banco: **migração** que adiciona três índices em `computer_sessions`. Nenhuma coluna nova, nenhum dado alterado.
- Contrato HTTP: `GET /lawyers/releases-metrics/:roomId?year=` → `200` com `{ metrics: { year, kpis, byYear, byMonth, byRoom, byLawyer } }`.
- Autorização: **decisão** de não restringir a ADMIN — o recorte por sala do MEMBER já limita o que ele enxerga, coerente com `get-all-releases` e `rooms/get-all`.
- Documentação: `docs/ROADMAP.md` — "Uso por sala e computador" e "Tempo médio por sessão" saem de ⛔ bloqueado.
