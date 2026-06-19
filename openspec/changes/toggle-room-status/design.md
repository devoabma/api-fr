## Contexto

A coluna `inactive` (timestamp anulável) já existe no modelo `rooms` e é a fonte de verdade do status: `null` = ativa, data preenchida = inativa (desde quando). Faltavam os casos de uso administrativos para popular/limpar essa coluna e a exposição do campo na listagem. O padrão segue o já entregue para funcionários em `list-and-toggle-employee-status`.

## Decisões

### Status modelado por timestamp, não booleano

Inativar grava `inactive: dayjs().toDate()` e ativar grava `inactive: null`. Mantém o registro de *quando* a sala foi desativada sem coluna extra; o teste de status é simplesmente `room.inactive === null`.

### Guardas de idempotência explícitas

- `deactivate`: se `inactive` já preenchido → `BadRequestError('Sala já está inativa.')`.
- `activate`: se `inactive` já é `null` → `BadRequestError('Sala já está ativa.')`.

Evita updates redundantes e devolve erro claro em vez de um `200` silencioso que mascara intenção equivocada do cliente.

### Sem guarda de auto-inativação

Diferente de funcionários (onde o ADMIN não pode inativar o próprio cadastro), salas não têm vínculo com o solicitante, então não há proteção análoga a aplicar.

### Autorização por rota

As duas rotas seguem o padrão já adotado nas demais rotas de sala (`create.ts`, `update.ts`): `.register(auth)` na cadeia de construção e `checkIfEmployeeIsAdmin()` como primeira linha do handler, antes de qualquer consulta ao banco.

### Exposição de `inactive` na listagem

`get-all` passa a incluir `inactive: z.date().nullable()` no schema de resposta e `inactive: true` no `select`, permitindo ao cliente diferenciar salas ativas de inativas sem uma consulta adicional.

## Ordem de execução (activate/deactivate)

1. `preHandler` do plugin `auth` decora `request`.
2. `checkIfEmployeeIsAdmin()` → `401` se não-admin/sem token.
3. `findUnique` pelo `:id` (`select: { inactive: true }`) → `404` se não existir.
4. Guarda de idempotência → `400` se já no status alvo.
5. `update` da coluna `inactive` → `200` com mensagem de sucesso.
