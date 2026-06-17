## Why

O roadmap (seção 2 — Salas) lista "Criar sala" como pendente e a regra de negócio "Somente ADMIN cria/edita/inativa/ativa salas" ainda não tinha implementação. O modelo `rooms` já existe no banco (com `name`, `slug`, `standardTime`, `description`), mas não havia caso de uso para cadastrar uma sala. Esta change entrega a criação de salas restrita a ADMIN, abrindo a seção 2 do roadmap.

## What Changes

- **Novo caso de uso `create.ts`** (`POST /rooms/create`): rota protegida que cria uma sala. Recebe `name` (obrigatório), `standardTime` (inteiro positivo, opcional — assume o `@default(180)` do schema quando ausente) e `description` (opcional).
- **Somente ADMIN**: a rota chama `request.checkIfEmployeeIsAdmin()`; funcionário não-ADMIN ou sem JWT recebe `401`.
- **Nome normalizado**: o `name` é gravado em maiúsculas (`toUpperCase()`).
- **Slug automático e único**: o `slug` é derivado do `name` via `slugify` (`lower: true`, `strict: true`); havendo colisão de prefixo, recebe um sufixo numérico (`-N`) para respeitar a constraint `@unique`.
- **Dependência `slugify`**: adicionada ao projeto.
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/rooms`.

### Mudanças incidentais

- **`_errors/unauthorized.ts`**: mensagem padrão refinada para "Token expirado ou inválido. Por favor, faça login novamente." (mais clara para o cliente quando o JWT falha).
- **`employees/update-image.ts`**: remoção de uma linha em branco no schema (cosmético).

## Capabilities

### Added Capabilities
- `room`: cadastro de salas restrito a ADMIN, com nome normalizado e slug único derivado do nome.

## Impact

- Código novo: `src/http/core/rooms/create.ts`; alteração em `src/http/routes/index.ts`.
- Dependências: `slugify`.
- Contrato HTTP: novo endpoint `POST /rooms/create`, exigindo JWT de ADMIN; sucesso → `201` com `{ roomId }`; corpo inválido → `400`; sem JWT ou sem permissão → `401`.
- Banco: usa o modelo `rooms` já existente; nenhuma migração.
- Documentação: `docs/ROADMAP.md` marca "Criar sala" como concluído e a RN de ADMIN sobre salas como parcial.
