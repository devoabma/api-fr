## Why

`POST /employees/create-account` respondia `201` apenas com `{ message }`. O painel web precisa, no mesmo fluxo de tela, cadastrar o funcionário **e já vinculá-lo às salas escolhidas** — e `POST /employees/link-with-rooms` exige `employeeId` no body (`z.cuid2()`), não CPF nem e-mail.

Sem o id na resposta, o front teria três saídas, todas ruins:

- **Varrer `GET /employees/get-all`** logo após o cadastro para descobrir quem acabou de criar. É uma segunda requisição que traz a equipe inteira só para achar um registro, e a busca teria de ser feita por CPF/e-mail — chave de negócio, não de referência.
- **Pedir ao usuário que vincule depois**, numa segunda tela. Quebra o fluxo "cadastrar colaborador e dizer em que sala ele atua", que é uma operação única do ponto de vista de quem usa.
- **Deduzir o id**, impossível: `cuid` é gerado pelo banco.

O id do recurso criado é informação que a rota já tem em mãos no momento da resposta. Devolvê-la é o padrão de qualquer `201`.

## What Changes

- **`employeeId` no response `201` de `POST /employees/create-account`**: o `prisma.employees.create` passa a usar `select: { id: true }` e o handler devolve `{ message, employeeId }`.
- **`select` explícito no `create`**, em vez de deixar o Prisma retornar a linha inteira. Sem ele, o retorno traria `passwordHash` para dentro do handler — dado que não tem por que trafegar, mesmo sem chegar ao cliente (o schema Zod de resposta o descartaria).
- **`employeeId` validado como `z.cuid2()`** no schema de resposta, igual ao que `link-with-rooms` espera no body. Contrato simétrico entre quem produz e quem consome o id.
- Nada mais muda: segue ADMIN-only, a validação de unicidade de CPF/e-mail é a mesma, e o e-mail de boas-vindas continua **fora de transação e não-fatal** — a resposta `201` (agora com `employeeId`) é enviada mesmo quando o Resend falha.

## Capabilities

### Modified Capabilities
- `employee-account-creation`: a criação de funcionário passa a devolver o `employeeId` do registro criado no corpo do `201`.

## Impact

- Código: altera apenas `src/http/core/employees/create-account.ts`.
- Banco: nenhuma migração; nenhuma consulta adicional (o `id` vem do próprio `INSERT ... RETURNING`).
- Contrato HTTP: campo **adicionado** ao `201`, sem breaking change. Quem só lia `message` segue funcionando.
- Segurança: o `id` do funcionário já circula livremente nas rotas ADMIN (`get-all`, `update/:id`, `deactivate/:id`) e a criação é ADMIN-only — devolvê-lo não expõe nada novo a quem não podia vê-lo.
- Cliente: destrava o encadeamento cadastro → `link-with-rooms` numa única interação no painel web (`web-fr`). O desktop não consome esta rota.
