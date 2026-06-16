## Why

O roadmap (seção 1) lista "Trocar a foto de perfil do funcionário logado" como pendente. A tabela `employees` já possui as colunas `image_url` e `image_public_id`, mas não havia caso de uso para enviar a imagem. Esta change entrega o upload da foto de perfil do próprio funcionário autenticado, com armazenamento no Supabase Storage e substituição da imagem anterior.

## What Changes

- **Novo caso de uso `update-image.ts`** (`PATCH /employees/update-image`): rota protegida que recebe um arquivo `multipart/form-data`, valida o tipo, envia ao bucket `profiles` do Supabase Storage e grava `imageUrl` + `imagePublicId` no funcionário **autenticado** (via `getIdCurrentEmployee()`, não por `:id`).
- **Substituição da imagem antiga**: se o funcionário já possui `imagePublicId`, o arquivo anterior é removido do bucket após o upload do novo (operação não-fatal).
- **`@fastify/multipart`**: registrado em `app.ts` com limite de `fileSize` de 5MB.
- **`supabase.ts`**: client do Supabase usando a **secret key** (`service_role`), que ignora o RLS — uso exclusivo no backend.
- **`env.ts`**: novas variáveis `PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- **Error handler**: trata `FST_REQ_FILE_TOO_LARGE` → `413` com mensagem amigável.
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/employees`.
- **Documentação do upload no OpenAPI**: o schema declara `consumes: multipart/form-data` e um `body` com o campo `file` (`format: binary`) injetado via `z.any().meta()`, para que o Scalar/Swagger exiba o seletor de arquivo. A validação do body fica permissiva porque o arquivo é lido por `request.file()`, não pelo body parseado.
- **Sem `404`**: o funcionário é o próprio usuário autenticado (resolvido por `getIdCurrentEmployee()`), então não há cenário de "funcionário inexistente".

## Capabilities

### Added Capabilities
- `employee-image`: upload e substituição da foto de perfil do funcionário autenticado, com persistência da URL pública e do caminho do arquivo no bucket.

## Impact

- Código novo: `src/http/core/employees/update-image.ts`, `src/lib/supabase.ts`; alterações em `src/http/app.ts`, `src/http/env.ts`, `src/http/routes/index.ts`, `src/http/_errors/index.ts`.
- Dependências: `@supabase/supabase-js` e `@fastify/multipart`.
- Contrato HTTP: novo endpoint `PATCH /employees/update-image` (`multipart/form-data`), exigindo JWT; arquivo ausente ou tipo inválido → `400`; arquivo acima de 5MB → `413`; sem JWT → `401`. O campo de upload (`file`, `format: binary`) é documentado no Scalar/Swagger.
- Infra Supabase: bucket `profiles` **público** (URLs servidas direto); como a API usa a `service_role`, **nenhuma policy de RLS** é necessária no bucket.
- Banco: usa colunas `image_url` e `image_public_id` já existentes em `employees`; nenhuma migração.
- Documentação: `docs/DOC.md` e `docs/ROADMAP.md` marcam "Trocar a foto de perfil do funcionário logado" como concluído.
