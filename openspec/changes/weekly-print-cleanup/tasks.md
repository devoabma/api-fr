## 1. Fuso horário por ambiente

- [x] 1.1 Adicionar `TIMEZONE` ao schema de `src/http/env.ts` com default `America/Fortaleza`
- [x] 1.2 Validar o fuso no boot via `Intl.DateTimeFormat` (identificador IANA inválido derruba a aplicação)
- [x] 1.3 Trocar o fuso fixo de `src/lib/dayjs.ts` por `env.TIMEZONE`
- [x] 1.4 Registrar `TIMEZONE` em `.env.example` e na lista de variáveis do `docs/DEPLOY.md`

## 2. Expurgo semanal de impressões

- [x] 2.1 Adicionar a dependência `node-cron`
- [x] 2.2 Criar `src/http/jobs/delete-weekly-prints.cron.ts` com `startDeleteWeeklyPrintsJob()` e `deleteWeeklyPrints()` exportadas
- [x] 2.3 Agendar `59 59 23 * * 5` com `timezone: env.TIMEZONE`, `noOverlap: true` e `name: 'delete-weekly-prints'`
- [x] 2.4 Selecionar as impressões por `createdAt <= cutoff` (instante do início da execução)
- [x] 2.5 Extrair o caminho do bucket a partir de `file_url` e remover os objetos do bucket `prints` em lotes de 100
- [x] 2.6 Apagar as linhas de `printers` só após remoção bem-sucedida no Storage; manter o lote em caso de falha
- [x] 2.7 Apagar apenas a linha (com aviso no log) quando a `file_url` não casar com o padrão do bucket
- [x] 2.8 Registrar o job no boot (`src/http/server.ts`) e anunciar o agendamento no log de inicialização

## 3. Verificação

- [x] 3.1 `npx tsc --noEmit` sem erros
- [x] 3.2 `npx biome check src/` sem issues
- [x] 3.3 Boot real da API confirmando o registro do job no log de inicialização
- [x] 3.4 Conferir o próximo disparo calculado pelo `node-cron` (07/08/2026 23:59:59 −03, sexta-feira)
- [x] 3.5 Confirmar que `TIMEZONE` inválido falha no boot com mensagem de fuso inválido

## 4. Documentação

- [x] 4.1 Atualizar `docs/ROADMAP.md` (seção 5) para a regra semanal
- [x] 4.2 Atualizar `docs/DOC.md` (fluxo de impressão e checklist) para a regra semanal
- [x] 4.3 Documentar `TIMEZONE` no `docs/DEPLOY.md`
