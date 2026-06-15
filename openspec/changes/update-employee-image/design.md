## Contexto

A tabela `employees` já possui `image_url` e `image_public_id`, mas faltava o caso de uso de upload. O middleware `auth` expõe `request.getIdCurrentEmployee()`, usado para agir sobre o próprio autenticado (como em `change-password`). O armazenamento dos arquivos é o Supabase Storage, no bucket público `profiles`.

## Decisões

### Rota sobre o autenticado (não por `:id`)

`PATCH /employees/update-image` registra o plugin `auth` e usa `getIdCurrentEmployee()` para resolver o alvo. Cada funcionário troca a **própria** foto; não é operação administrativa. Verbo `PATCH` por ser atualização parcial de um recurso existente.

### Upload via `@fastify/multipart` com limite de 5MB

O plugin é registrado em `app.ts` com `limits.fileSize = 5 * 1024 * 1024`. O arquivo chega por `request.file()`; o tipo é validado contra uma allowlist (`image/jpeg`, `image/jpg`, `image/png`, `image/webp`). O `contentType` enviado ao Supabase usa `file.mimetype` (não `file.type`, que não existe no objeto do `@fastify/multipart` e causava `415 Invalid Content-Type`).

### Secret key (`service_role`) no backend, sem RLS

O client em `supabase.ts` usa a `SUPABASE_SERVICE_ROLE_KEY` (chave secreta), que **ignora o RLS** do Storage. Isso evita o acoplamento frágil com as policies do bucket: operações de upload/remove pela chave publishable exigiam policies de `INSERT` + `SELECT` + `DELETE` e falhavam em silêncio quando uma policy era removida (o `.remove()` bloqueado por RLS retorna `{ data: [], error: null }`). Com a `service_role`, o bucket pode ficar **sem nenhuma policy**, apenas com a flag **PUBLIC** ligada para servir as URLs. A chave secreta é de uso exclusivo do backend e nunca vai para o front/app.

### Nome e caminho do arquivo

Gera-se `uploads/<uuid>.<ext>` com `crypto.randomUUID()`, evitando colisão e vazamento do nome original. O **`imagePublicId` armazenado é exatamente esse `filePath`** — no Supabase Storage não existe "public_id" (como no Cloudinary); a remoção é feita pelo path via `.remove([path])`.

### Substituição não-fatal da imagem antiga

A ordem é: sobe a nova imagem → se havia `imagePublicId`, remove a antiga do bucket → grava `imageUrl` + `imagePublicId`. Subir antes de remover garante que uma falha no upload não deixe o funcionário sem foto. A remoção da antiga é **não-fatal**: se falhar, apenas loga (`console.error`) e segue — no pior caso fica um arquivo órfão, tolerável.

## Fluxo

1. `auth` valida o JWT; `getIdCurrentEmployee()` resolve o funcionário (senão `401`).
2. `request.file()` lê o arquivo; ausente → `400`. Tipo fora da allowlist → `400`. Acima de 5MB → `413` (via error handler, código `FST_REQ_FILE_TOO_LARGE`).
3. `findUnique` busca o funcionário; não achou → `404`.
4. Upload do buffer para `profiles/uploads/<uuid>.<ext>` com `contentType: file.mimetype`.
5. Se já existia `imagePublicId`, remove o arquivo antigo do bucket (não-fatal).
6. `getPublicUrl` monta a URL pública; `update` grava `imageUrl` + `imagePublicId`.
7. Responde `200` com `{ imageUrl }`.

## Notas

- **`getPublicUrl` não faz request** — apenas monta a string da URL —, então não depende de RLS nem da chave usada.
- **413 no error handler**: `error.code` é acessado via narrowing seguro (`(error as { code?: string }).code`) porque o tipo do erro no handler do Fastify é genérico e não expõe `code`.
