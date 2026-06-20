## Why

O roadmap (seção 3 — Computadores) lista "Cadastrar computador" como pendente e a regra de negócio "Somente ADMIN cadastra/edita/exclui computadores" ainda não tinha implementação. O modelo `computers` já existe no banco (com `macCode`, `number`, `description`, `roomId` e a relação com `rooms`), mas não havia caso de uso para cadastrar uma máquina. Esta change entrega a criação de computadores restrita a ADMIN, abrindo a seção 3 do roadmap.

## What Changes

- **Novo caso de uso `create.ts`** (`POST /computers/create`): rota protegida que cria um computador. Recebe `macCode` (obrigatório), `number` (inteiro positivo, obrigatório), `description` (obrigatório) e `roomId` (cuid).
- **Somente ADMIN**: a rota chama `request.checkIfEmployeeIsAdmin()`; funcionário não-ADMIN ou sem JWT recebe `401`.
- **MAC normalizado**: o `macCode` é normalizado via novo util `formattedCodeMac` (remove separadores, força maiúsculas e reaplica o padrão `AA-BB-CC-DD-EE-FF`); MAC fora do padrão de 12 caracteres hex (resultado ≠ 17 chars) é rejeitado com `400`.
- **Descrição normalizada**: a `description` é gravada em maiúsculas (`toUpperCase()`).
- **Unicidade**: `macCode` é único globalmente (`@unique`) — colisão → `400`; `number` e `description` são únicos por sala (`roomId`) — colisão → `400`.
- **Sala existente**: a `roomId` informada MUST referenciar uma sala existente; caso contrário → `404`.
- **Novo util `formattedCodeMac`** em `src/utils/index.ts`.
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/computers`.

## Capabilities

### Added Capabilities
- `computer`: cadastro de computadores restrito a ADMIN, com MAC normalizado/único, número e descrição únicos por sala e vínculo a uma sala existente.

## Impact

- Código novo: `src/http/core/computers/create.ts`; novo util `formattedCodeMac` em `src/utils/index.ts`; alteração em `src/http/routes/index.ts`.
- Contrato HTTP: novo endpoint `POST /computers/create`, exigindo JWT de ADMIN; sucesso → `201` com `{ macCode }`; corpo/MAC inválido ou duplicidade → `400`; sala inexistente → `404`; sem JWT ou sem permissão → `401`.
- Banco: usa o modelo `computers` já existente; nenhuma migração.
- Documentação: `docs/ROADMAP.md` marca "Cadastrar computador" como concluído e a RN de ADMIN sobre computadores como parcial.
