## Context

A rota `POST /create-account` (`src/http/core/employees/create-account.ts`) faz, em sequência: validação de unicidade (CPF/e-mail), hash da senha, criação do funcionário via Prisma e, por fim, envio do e-mail de boas-vindas via Resend. Como o envio ocorria **após** o commit da criação, qualquer falha no Resend (indisponibilidade, domínio rejeitado, rate limit) deixava o funcionário persistido sem ter recebido suas credenciais. O requisito de negócio é claro: sem e-mail enviado, não há cadastro.

## Goals / Non-Goals

**Goals:**
- Garantir atomicidade entre a persistência do funcionário e o envio do e-mail de boas-vindas.
- Retornar `400` com mensagem clara quando o e-mail não puder ser enviado, sem deixar resíduo no banco.

**Non-Goals:**
- Implementar fila/retry assíncrono de e-mails (out of scope).
- Alterar o template do e-mail ou o provedor (Resend permanece).
- Reprocessamento ou reenvio posterior de e-mails que falharam.

## Decisions

**Decisão: Envolver criação + envio em `prisma.$transaction`.**
O `create` é executado via cliente transacional `tx`, e o `resend.emails.send` é chamado dentro do callback da transação. Se o Resend retornar `{ error }` ou lançar, fazemos `throw`, o que aborta a transação e reverte o `create`. O `try/catch` externo captura e responde `400`.
- *Alternativa considerada*: criar fora da transação e, em caso de falha no e-mail, executar um `delete` compensatório. Rejeitada por ser mais frágil (o delete pode falhar, deixando o registro órfão) e por exigir lógica de compensação manual.
- *Alternativa considerada*: enviar o e-mail primeiro e só então criar. Rejeitada porque um e-mail enviado para um cadastro que depois falha (ex.: violação de unicidade em corrida) gera credenciais válidas para um usuário inexistente.

## Risks / Trade-offs

- **A conexão do banco permanece aberta durante a chamada HTTP ao Resend** (centenas de ms), reduzindo a vazão sob alto volume. → Mitigação: volume de cadastro de funcionários é baixo; reavaliar com fila assíncrona se a rota escalar.
- **O `catch` atual engole a causa raiz do erro**, dificultando diagnóstico. → Mitigação: adicionar `request.log.error` antes do `return` (melhoria futura, não bloqueante).
- **Transações longas podem estourar o timeout padrão do Prisma** se o Resend demorar. → Mitigação: aceitável no fluxo atual; ajustar `timeout`/`maxWait` do `$transaction` se necessário.
