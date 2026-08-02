## Why

O roadmap (seção 5) previa "Cron job: apagar impressões do servidor 1 dia após o envio". A regra foi **redefinida**: o expurgo passa a ser **semanal, toda sexta-feira às 23:59:59**. A fila física é atendida ao longo da semana pelos funcionários (`GET /printers/get-all`), e o descarte acontece no fechamento do expediente da semana — assim um arquivo enviado numa sexta à tarde não desaparece antes de ser impresso na segunda.

Sem o expurgo, o bucket `prints` do Supabase cresce indefinidamente: cada envio guarda o documento do advogado(a) por tempo indeterminado, o que é custo de storage e também exposição desnecessária de documento pessoal.

Na mesma entrega, o fuso horário deixa de ser constante no código. A API será distribuída para outras seccionais da OAB, e tanto o cálculo de tempo das sessões quanto o horário do novo job dependem do fuso local — hardcode obrigaria a alterar código para cada seccional.

## What Changes

- **Novo job `src/http/jobs/delete-weekly-prints.cron.ts`** (`node-cron`), registrado no boot em `server.ts` junto de `startAutoCloseSessionsJob()`:
  - Expressão `59 59 23 * * 5` (6 campos, com segundos) com `timezone: env.TIMEZONE` — horário de parede da seccional, não do servidor.
  - Remove os arquivos do bucket `prints` no Supabase Storage e só então apaga os registros da tabela `printers`.
  - Corte por `cutoff` capturado no início da execução: impressões criadas durante a limpeza ficam para a semana seguinte.
  - Lotes de 100 chaves por chamada ao Storage; falha em um lote mantém aquele lote no banco para nova tentativa na semana seguinte.
  - `noOverlap: true`: se uma execução se arrastar até o disparo seguinte, o disparo é ignorado em vez de empilhar.
  - `deleteWeeklyPrints()` é exportada, permitindo um gatilho manual (rota ADMIN) numa entrega futura sem duplicar a lógica.
- **Nova variável de ambiente `TIMEZONE`** (`src/http/env.ts`), default `America/Fortaleza`, validada no boot contra a base IANA do Node (`Intl.DateTimeFormat`): fuso inválido derruba a aplicação em vez de errar horário silenciosamente.
- **`src/lib/dayjs.ts`**: `dayjs.tz.setDefault(env.TIMEZONE)` no lugar do fuso fixo — propaga para todos os casos de uso que já usam `dayjs().tz()` (`release-computer`, `close-session`, `auto-close-sessions`, `daily-quota`).
- **Dependência nova**: `node-cron@^4.6.0`.

## Capabilities

### Added Capabilities
- `printer`: expurgo semanal automático dos arquivos enviados para impressão (Storage + banco), toda sexta-feira às 23:59:59 no fuso configurado.
- `runtime-configuration`: fuso horário da instância definido por variável de ambiente, validado no boot.

## Impact

- Código novo: `src/http/jobs/delete-weekly-prints.cron.ts`.
- Alterado: `src/http/server.ts` (registro do job), `src/http/env.ts` (`TIMEZONE`), `src/lib/dayjs.ts` (fuso via env), `package.json`/`pnpm-lock.yaml` (`node-cron`).
- Configuração: `.env.example` e `docs/DEPLOY.md` passam a listar `TIMEZONE`. Deploys existentes continuam funcionando sem alteração (default `America/Fortaleza`).
- Banco: apenas `DELETE` em `printers`; nenhuma migração.
- Storage: remoção definitiva de objetos no bucket `prints` — operação destrutiva e não reversível por design.
- Contrato HTTP: nenhum endpoint novo ou alterado.
- Documentação: `docs/ROADMAP.md` e `docs/DOC.md` passam a registrar a regra semanal no lugar de "1 dia após o envio".

## Known Limitation

O job roda in-process, como `auto-close-sessions`. Com mais de uma réplica da API, todas executariam a limpeza no mesmo instante e disputariam os mesmos lotes (a segunda instância encontraria registros já apagados pela primeira). O deploy atual no Coolify usa instância única, então isso não se manifesta hoje. Ao escalar horizontalmente, será necessário um lock (ex.: `updateMany` condicional numa tabela de controle ou advisory lock do Postgres) antes de habilitar réplicas.
