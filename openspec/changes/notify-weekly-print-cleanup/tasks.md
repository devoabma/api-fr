## 1. Template do relatório

- [x] 1.1 Criar `src/utils/emails/weeklyPrintsCleanupEmail.tsx` no padrão dos e-mails existentes (React Email + Tailwind, header/resumo/alerta/CTA/footer)
- [x] 1.2 Exportar o tipo `WeeklyPrintsCleanupStatus` com os quatro estados (`success`, `partial`, `failed`, `pending`)
- [x] 1.3 Trocar cor de destaque, selo e texto de resumo conforme o estado
- [x] 1.4 Exibir as contagens (na fila / removidas / não removidas) e o instante da verificação
- [x] 1.5 Exibir o bloco de erro apenas quando houver mensagens, e o bloco "o que fazer" apenas fora do estado de sucesso
- [x] 1.6 Definir `PreviewProps` para o `pnpm email`

## 2. Relatório na execução agendada

- [x] 2.1 Fazer `deleteBatch()` devolver `{ deleted, error }` no lugar do `0` mudo em falha de Storage
- [x] 2.2 Fazer `deleteWeeklyPrints()` devolver o resumo (`totalFound`, `deletedCount`, `failedCount`, `errors`)
- [x] 2.3 Prefixar cada erro com o número do lote e limitar as mensagens exibidas no e-mail
- [x] 2.4 Criar `sendCleanupReport()` com envio não-fatal (`try/catch` + tratamento do `{ error }` do Resend)
- [x] 2.5 Enviar como `success` ou `partial` conforme `failedCount`, e como `failed` no `catch` da execução
- [x] 2.6 Direcionar para `env.EMAIL_ADMIN` em produção e para o endereço de desenvolvimento fora dela

## 3. Alerta de janela perdida

- [x] 3.1 Implementar `lastScheduledRun()` devolvendo a última sexta 23:59:59 já vencida no fuso da instância
- [x] 3.2 Tratar o caso de domingo a quinta, em que `dayjs().day(5)` aponta para uma sexta ainda no futuro
- [x] 3.3 Implementar `reportMissedWeeklyCleanup()` contando impressões anteriores à janela e enviando o estado `pending`
- [x] 3.4 Disparar a verificação no boot sem bloquear o `startDeleteWeeklyPrintsJob()`, com `try/catch` próprio

## 4. Verificação

- [x] 4.1 `npx tsc --noEmit` sem erros
- [x] 4.2 `npx biome check src/` sem issues
- [x] 4.3 Conferir `lastScheduledRun()` nos casos de borda (sexta antes/depois das 23:59, sábado, domingo, segunda, quarta)
- [ ] 4.4 Boot real da API confirmando que a checagem de janela perdida não atrasa a inicialização
- [ ] 4.5 Disparo real do relatório em produção na primeira sexta-feira após o deploy

## 5. Documentação

- [x] 5.1 Atualizar `docs/ROADMAP.md` (seção 5) com o relatório e o alerta
- [x] 5.2 Atualizar `docs/DOC.md` (fluxo de impressão e checklist) com o relatório e o alerta
