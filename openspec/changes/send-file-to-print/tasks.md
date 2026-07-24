## 1. Caso de uso de envio para impressão

- [x] 1.1 Criar `send-to-print.ts` com rota `POST /printers/send-to-print/:macCode` (sem `auth`)
- [x] 1.2 Resolver o computador pelo `macCode` (`formattedCodeMac`) e validar existência (`404`)
- [x] 1.3 Validar que o computador possui `currentLawyerId` (sessão ativa) — sem sessão → `400`
- [x] 1.4 Validar presença do arquivo (`400`) e tipo via allowlist — PDF, Word, Excel, PowerPoint, imagens (`400`)
- [x] 1.5 Limitar o tamanho do arquivo a 20MB via `request.file({ limits: { fileSize } })`
- [x] 1.6 Upload para `prints/uploads/<uuid>.<ext>` com `contentType: file.mimetype`
- [x] 1.7 Criar registro em `Printers` com `fileUrl`, `computerId` e `lawyerId`
- [x] 1.8 Responder `200` com `{ message, printId, fileUrl }`
- [x] 1.9 Declarar `consumes: multipart/form-data` + `body` com `file` (`format: binary`) via `z.any().meta()`
- [x] 1.10 Declarar schemas de resposta `200`/`400`/`404`/`413`

## 2. Tratamento de erro e registro

- [x] 2.1 Ajustar mensagem do `FST_REQ_FILE_TOO_LARGE` (413) para não fixar "5MB", já que o limite agora varia por rota
- [x] 2.2 Registrar a rota em `routes/index.ts` sob o prefixo `/printers`
- [x] 2.3 `npx tsc --noEmit` e `npx biome check` sem erros

## 3. Infra Supabase (manual)

- [ ] 3.1 Criar bucket `prints` como PUBLIC no Supabase Storage
- [ ] 3.2 Remover as policies de RLS do bucket (desnecessárias com `service_role`)
- [ ] 3.3 Validar manualmente o envio de cada tipo de arquivo e os fluxos `400`/`404`/`413`
