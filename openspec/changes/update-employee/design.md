## Contexto

A tabela `employees` já guarda `name`, `email` e `role`; o middleware `auth` já expõe `request.checkIfEmployeeIsAdmin()`. As rotas de status (`activate`/`deactivate`) editam apenas a coluna `inactive`; faltava editar os dados cadastrais propriamente ditos. Esta change entrega a edição administrativa por ID.

## Decisões

### Rota protegida e restrita a ADMIN

`PATCH /employees/update/:id` registra o plugin `auth` e executa `checkIfEmployeeIsAdmin()` como primeira etapa do handler. Editar o cadastro de qualquer funcionário é operação administrativa; o alvo vem do `:id` na URL, não do JWT (diferente de `change-password`, que age sobre o próprio autenticado).

### Body totalmente opcional (atualização parcial)

`name`, `email` e `role` são opcionais. Monta-se `dataToUpdate` por spread condicional (`...(name && { name })`), gravando só os campos informados. Um body vazio é aceito e resulta em `update` sem mudanças — simplicidade em vez de rejeitar requisições "no-op".

### Checagem de unicidade de e-mail

O e-mail só é verificado quando informado **e** diferente do atual: `findUnique({ where: { email } })`; se já pertencer a outro funcionário → `400 BadRequestError`. Evita violar a constraint única do banco e devolve erro de domínio legível em vez de erro de Prisma.

### Funcionário inexistente

`findUnique` pelo `:id` antes de qualquer escrita; não achou → `404 NotFoundError`.

## Fluxo

1. `auth` valida o JWT; `checkIfEmployeeIsAdmin()` garante papel ADMIN (senão `401`).
2. Recebe `:id` (cuid2) e o body opcional (`name`, `email`, `role`), validados por Zod.
3. `findUnique` busca o funcionário; não achou → `404`.
4. Se `email` foi informado e difere do atual, checa unicidade; em uso → `400`.
5. Monta `dataToUpdate` apenas com os campos presentes e executa `update`.
6. Responde `200` com mensagem de sucesso.

## Notas

- **Verbo `PATCH`**: como o body é parcial (todos os campos opcionais), `PATCH` é o verbo semanticamente correto, alinhado a `activate`/`deactivate`.
