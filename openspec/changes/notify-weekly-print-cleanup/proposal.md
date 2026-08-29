## Why

O expurgo semanal (`weekly-print-cleanup`) roda em silêncio: o único sinal de que aconteceu — ou de que falhou — é uma linha no log do container. Ninguém acompanha esse log toda sexta-feira às 23:59.

Isso importa porque **as duas falhas possíveis são invisíveis por semanas**:

- O Storage recusar a remoção de um lote. O job trata isso corretamente (mantém o lote no banco para nova tentativa), mas o efeito é uma fila que só cresce, com documento pessoal de advogado(a) retido no bucket muito além do previsto.
- A API estar fora do ar às 23:59:59 de sexta. O `node-cron` não recupera disparos perdidos — a limpeza simplesmente não acontece e a semana seguinte carrega o dobro de arquivos.

Em ambos os casos o problema só apareceria pela conta do Supabase ou por alguém estranhar o volume da listagem, meses depois.

## What Changes

- **Novo template `src/utils/emails/weeklyPrintsCleanupEmail.tsx`** (React Email + Tailwind, no mesmo padrão dos e-mails existentes), com quatro estados que trocam cor, selo e texto do relatório:
  - `success` — fila esvaziada (inclusive quando não havia nada a limpar).
  - `partial` — o job rodou, mas um ou mais lotes ficaram para trás.
  - `failed` — a execução foi interrompida por um erro.
  - `pending` — a janela agendada passou sem limpeza.
- **`deleteBatch()` passa a devolver `{ deleted, error }`** em vez de sinalizar falha do Storage com um `0` mudo. A mensagem do erro identifica o lote e chega ao e-mail.
- **`deleteWeeklyPrints()` passa a devolver um resumo** (`totalFound`, `deletedCount`, `failedCount`, `errors`) no lugar do número de removidos. Não havia outro consumidor além do próprio job.
- **`runWeeklyCleanupWithReport()`** envolve a execução agendada: manda o relatório no caminho feliz (`success`/`partial` conforme o resumo) e também no `catch` (`failed`).
- **`reportMissedWeeklyCleanup()`**, disparada no boot: se ainda existem impressões anteriores à última sexta 23:59:59 que já passou, a limpeza daquela janela não aconteceu (ou não terminou) e sai o alerta `pending`.
- **Envio não-fatal**: o `resend.emails.send()` fica dentro de `try/catch` e uma falha de e-mail apenas loga. O relatório é diagnóstico; derrubar o job por causa dele trocaria um problema por outro.
- **Destinatário**: `env.EMAIL_ADMIN` em produção, e-mail de desenvolvimento fora dela — mesmo ternário já usado em `prisma/seed.ts` e nos e-mails de `employees`.

## Capabilities

### Added Capabilities
- `printer`: relatório por e-mail de cada execução da limpeza semanal, e alerta quando a janela agendada passa sem limpeza.

## Impact

- Código novo: `src/utils/emails/weeklyPrintsCleanupEmail.tsx`.
- Alterado: `src/http/jobs/delete-weekly-prints.cron.ts` (assinaturas de `deleteBatch`/`deleteWeeklyPrints`, envio do relatório, checagem de janela perdida no boot).
- Configuração: nenhuma variável nova. Reaproveita `RESEND_API_KEY`, `EMAIL_ADMIN`, `WEB_URL` e `NODE_ENV`, já obrigatórias no boot.
- Banco: nenhuma migração. A checagem de janela perdida é um `count()` em `printers` com filtro por `created_at`.
- Contrato HTTP: nenhum endpoint novo ou alterado.
- Comportamento do expurgo: **inalterado**. A ordem Storage → banco, o corte por `cutoff`, os lotes de 100 e o `noOverlap` continuam exatamente como estavam.
- Documentação: `docs/ROADMAP.md` (seção 5) e `docs/DOC.md` (fluxo de impressão e checklist) passam a registrar o relatório.

## Known Limitations

1. **O alerta de janela perdida chega quando a API volta, não quando ela cai.** Com o processo fora do ar não existe de onde enviar o aviso no momento do incidente. Monitoramento externo batendo em `GET /ready` é o que avisa em tempo real; esta checagem é a rede de segurança de dentro da aplicação.

2. **Reinícios sucessivos com a fila suja geram um e-mail por processo.** A checagem infere o estado pela própria fila, sem registro de execução, então cada boot com pendências repete o alerta. Resolver de verdade exige persistir a data da última execução (uma tabela `job_runs` ou equivalente) — migração que não se justifica antes de o ruído aparecer.

3. **`failed` reporta zeros nas contagens.** Quando a execução estoura, o resumo não existe: o e-mail traz a mensagem do erro, mas não quanto da fila havia sido processado até ali.
