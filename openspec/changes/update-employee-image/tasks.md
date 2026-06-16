## 1. Infra e configuração

- [x] 1.1 Adicionar dependências `@supabase/supabase-js` e `@fastify/multipart`
- [x] 1.2 Registrar `@fastify/multipart` em `app.ts` com `limits.fileSize = 5MB`
- [x] 1.3 Adicionar `PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em `env.ts`
- [x] 1.4 Criar client em `supabase.ts` usando a secret key (`service_role`)

## 2. Caso de uso de upload

- [x] 2.1 Criar `update-image.ts` com rota `PATCH /employees/update-image` protegida por `auth`
- [x] 2.2 Resolver o funcionário via `getIdCurrentEmployee()`
- [x] 2.3 Validar presença do arquivo (`400`) e tipo via allowlist (`400`)
- [x] 2.4 Confiar no funcionário autenticado resolvido por `getIdCurrentEmployee()` (sem `404`)
- [x] 2.5 Upload para `profiles/uploads/<uuid>.<ext>` com `contentType: file.mimetype`
- [x] 2.6 Gravar o cadastro e então remover a imagem antiga do bucket quando há `imagePublicId` (não-fatal)
- [x] 2.7 Gravar `imageUrl` + `imagePublicId` e responder `200` com `{ imageUrl }`
- [x] 2.8 Declarar `security` e schemas de resposta `200`/`400`/`413`
- [x] 2.9 Declarar `consumes: multipart/form-data` + `body` com `file` (`format: binary`) via `z.any().meta()` para o Scalar/Swagger exibir o upload

## 3. Tratamento de erro e registro

- [x] 3.1 Tratar `FST_REQ_FILE_TOO_LARGE` → `413` no error handler
- [x] 3.2 Registrar a rota em `routes/index.ts` sob o prefixo `/employees`
- [x] 3.3 `npx tsc --noEmit` sem erros

## 4. Infra Supabase (manual)

- [x] 4.1 Bucket `profiles` criado como PUBLIC
- [x] 4.2 Remover as policies de RLS do bucket (desnecessárias com `service_role`)
- [x] 4.3 Validar manualmente upload, substituição da imagem antiga e os fluxos `400`/`413`/`401`
