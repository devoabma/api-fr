## Why

O roadmap (seção 4 — Advogados e Sessões) e o `docs/DOC.md` descrevem o fluxo central do produto: o advogado(a) se autentica com CPF/OAB/data de nascimento em um computador da sala, o sistema consulta a API do Protheus para validar adimplência e situação, cria/atualiza o registro em `lawyers` e abre uma sessão de uso com cota diária. Nenhuma dessas rotas existia — este change entrega as duas pontas do ciclo de vida da sessão: abrir (`release-computer`) e encerrar (`close-session`).

## What Changes

- **Novo caso de uso `release-computer.ts`** (`POST /lawyers/release-computer`): rota pública (sem JWT de funcionário — o advogado se autentica com CPF/OAB/nascimento). Recebe `cpf`, `oab`, `birth` e `macCode`.
  - Normaliza e valida o `macCode` (17 caracteres via `formattedCodeMac`).
  - Consulta a API do Protheus (`API_PROTHEUS_DATA`, novo client axios) por CPF; resposta fora do formato esperado ou API indisponível → `404` (via `AxiosError` já tratado globalmente em `errorHandler`).
  - Rejeita advogado(a) com `situacao` fora de `SITUACOES_LIBERADAS` ou inadimplente.
  - Confere CPF/OAB/data de nascimento informados contra os dados retornados pela API.
  - Valida o computador: deve existir, pertencer a sala ativa, não estar em manutenção.
  - Cria ou atualiza o registro em `lawyers` a partir dos dados consultados (nunca edita CPF/OAB/nascimento diretamente — sempre reflete a API).
  - Calcula a cota diária global (novo helper `getDailyQuota`) e decide entre: recusar (sessão ativa em outro computador), encerrar por tempo esgotado (mesmo computador), recusar por sessão ainda ativa com saldo, recusar por cota diária zerada, ou abrir nova sessão (`computerSessions` + `computers.inUse/currentLawyerId` + `lawyers.remainingTime/lastAccess`).
- **Novo caso de uso `close-session.ts`** (`POST /lawyers/close-computer/:sessionId`): encerra uma sessão ativa, recalcula o saldo diário (mesma cota global) e libera o computador (`inUse: false`, `currentLawyerId: null`).
- **Novo helper `getDailyQuota`** (`src/http/core/lawyers/helpers/daily-quota.ts`): cota diária GLOBAL por advogado(a) — definida pela sala da primeira sessão finalizada do dia, consumida em qualquer sala.
- **Novo schema `lawyerApiSchema`** (`src/http/core/lawyers/schema/lawyer.ts`): valida o payload da API do Protheus e define as situações que liberam uso.
- **Novo client `API_PROTHEUS_DATA`** (`src/lib/axios.ts`) e **`dayjs`** configurado com timezone `America/Sao_Paulo` (`src/lib/dayjs.ts`), usados para calcular janelas de dia e diferenças de minutos.
- **Nova env `API_PROTHEUS_DATA_URL`** em `src/http/env.ts` e `.env.example`.
- **`routes/index.ts`**: registra as duas rotas sob o prefixo `/lawyers`.
- **`server.ts`**: adiciona `.catch()` ao `app.listen(...)` para não deixar uma falha de bind engolida silenciosamente (`process.exit(1)` + log do erro).

## Capabilities

### Added Capabilities
- `lawyer`: ciclo de vida da sessão de uso do advogado(a) — liberação de computador (com consulta à API do Protheus, cadastro/atualização em `lawyers` e cota diária global) e encerramento de sessão com recálculo do saldo restante do dia.

## Impact

- Código novo: `src/http/core/lawyers/release-computer.ts`, `close-session.ts`, `helpers/daily-quota.ts`, `schema/lawyer.ts`; `src/lib/axios.ts`, `src/lib/dayjs.ts`.
- Alterado: `src/http/env.ts` (nova env), `src/http/routes/index.ts` (registro das rotas), `src/http/server.ts` (`.catch` no listen), `package.json` (`packageManager`), `.env.example`.
- Contrato HTTP: `POST /lawyers/release-computer` → `200` com `{ message, sessionId }`; `400`/`404` nos casos de recusa. `POST /lawyers/close-computer/:sessionId` → `200` com `{ message, remainingTime }`; `400` se sessão inexistente ou já encerrada.
- Banco: usa `lawyers`, `computers` e `computer_sessions` já existentes; nenhuma migração.
- Documentação: `docs/ROADMAP.md` marca como concluídos os itens de abertura/encerramento de sessão e as RNs de validação já cobertas pelo fluxo.
