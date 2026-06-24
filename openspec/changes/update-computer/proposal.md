## Why

O roadmap (seção 3 — Computadores) já entregou "Cadastrar" e "Listar", mas "Editar computador" continuava pendente e a regra de negócio "Somente ADMIN cadastra/edita/exclui computadores" estava marcada como parcial (só o cadastro estava protegido). Esta change entrega a edição de computadores restrita a ADMIN, reaproveitando as mesmas regras de unicidade do cadastro (MAC global; `number`/`description` por sala) agora no escopo de uma atualização parcial.

## What Changes

- **Novo caso de uso `update.ts`** (`PATCH /computers/update/:id`): rota protegida que atualiza parcialmente um computador. `id` vem no path (cuid); o corpo aceita `macCode`, `number`, `description` e `roomId`, todos opcionais.
- **Somente ADMIN**: a rota chama `request.checkIfEmployeeIsAdmin()`; funcionário não-ADMIN ou sem JWT recebe `401`.
- **Computador existente**: o `id` MUST referenciar um computador existente; caso contrário → `404`.
- **MAC normalizado/único**: quando enviado, o `macCode` é normalizado via `formattedCodeMac`; resultado ≠ 17 chars → `400`; colisão com outro computador (excluindo o próprio) → `400`.
- **Sala efetiva**: as revalidações de unicidade usam a sala efetiva (`roomId` enviado, senão a sala atual), de modo que mover o computador de sala re-checa número e descrição no destino.
- **Número/descrição únicos por sala**: revalidados quando `number`/`description` ou a `roomId` mudam, sempre excluindo o próprio computador; colisão → `400`. A `description` é persistida em maiúsculas.
- **Sala existente**: quando `roomId` é enviado, MUST referenciar uma sala existente; caso contrário → `404`.
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/computers`.

### Ajustes de apoio (mesmo lote)

- **`computers/create.ts`**: move `const uppercaseDescription` para junto do uso (revalidação de descrição), alinhando com o padrão do `update.ts`. Sem mudança de comportamento.
- **`computers/get-all.ts`**: simplifica o filtro `roomId` (de `{ equals }` para shorthand) e ajusta o `summary` para "por sala e/ou descrição".

## Capabilities

### Modified Capabilities
- `computer`: além de cadastrar e listar, agora permite **editar** um computador (restrito a ADMIN), com atualização parcial, MAC normalizado/único e número/descrição únicos por sala efetiva.

## Impact

- Código novo: `src/http/core/computers/update.ts`; alteração em `src/http/routes/index.ts`; refactors menores em `create.ts` e `get-all.ts`.
- Contrato HTTP: novo endpoint `PATCH /computers/update/:id`, exigindo JWT de ADMIN; sucesso → `200` com `{ message }`; corpo/MAC inválido ou duplicidade → `400`; computador ou sala inexistente → `404`; sem JWT ou sem permissão → `401`.
- Banco: usa o modelo `computers` já existente; nenhuma migração.
- Documentação: `docs/ROADMAP.md` marca "Editar computador" como concluído e a RN de ADMIN sobre computadores como concluída (cadastro + edição protegidos; exclusão ainda pendente).
