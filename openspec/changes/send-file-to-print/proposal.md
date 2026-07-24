## Why

O roadmap (seção 5) lista "Registrar arquivo enviado para impressão (cria registro em `printers`)" como pendente. O schema já possui o modelo `Printers` (`fileUrl`, `computerId`, `lawyerId`), mas não havia caso de uso para enviar o arquivo. Esta change entrega o envio do documento pelo app Desktop, para o advogado com sessão ativa no computador.

## What Changes

- **Novo caso de uso `send-to-print.ts`** (`POST /printers/send-to-print/:macCode`): rota pública (sem JWT), no mesmo estilo de `release-computer`/`close-session` — o app Desktop roda na máquina do advogado e identifica a sessão pelo `macCode` do próprio computador, não por login.
- **Identificação da sessão ativa via `Computers.currentLawyerId`**: mesma fonte da verdade usada em `release-computer`. Computador não encontrado → `404`; computador sem advogado em sessão ativa → `400`.
- **Allowlist de tipos de arquivo**: PDF, Word (`.doc`/`.docx`), Excel (`.xls`/`.xlsx`), PowerPoint (`.ppt`/`.pptx`) e imagens (JPG/PNG/WEBP). Arquivo ausente ou tipo fora da lista → `400`.
- **Limite de tamanho próprio da rota (20MB)**: documentos tendem a ser maiores que fotos de perfil, então o limite é passado diretamente em `request.file({ limits: { fileSize } })`, sem alterar o limite global de 5MB (`@fastify/multipart` em `app.ts`, usado pelo upload de imagem de funcionário).
- **Novo bucket `prints`** no Supabase Storage (bucket público, criado manualmente, mesmo padrão do bucket `profiles`).
- **Registro em `Printers`**: `fileUrl` (URL pública do Supabase), `computerId` e `lawyerId` (o `currentLawyerId` do computador). Resposta `200` com `{ message, printId, fileUrl }`.
- **Error handler**: a mensagem de `FST_REQ_FILE_TOO_LARGE` (413) deixa de referenciar "5MB" fixo, já que agora existem rotas com limites diferentes.
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/printers`.
- **Fora do escopo desta change** (ficam para próximas entregas do roadmap): listagem de impressões pendentes por sala/funcionário, download do arquivo, marcação de `downloaded_at`/`printed_at` e o cron de expurgo dos arquivos após 1 dia.

## Capabilities

### Added Capabilities
- `printer`: envio de um documento para impressão pelo advogado com sessão ativa em um computador, criando o registro correspondente em `Printers`.

## Impact

- Código novo: `src/http/core/printers/send-to-print.ts`; alterações em `src/http/routes/index.ts` e `src/http/_errors/index.ts`.
- Contrato HTTP: novo endpoint `POST /printers/send-to-print/:macCode` (`multipart/form-data`), sem JWT; computador inexistente → `404`; sem sessão ativa, sem arquivo ou tipo inválido → `400`; arquivo acima de 20MB → `413`.
- Infra Supabase: novo bucket `prints`, público, sem policy de RLS (a API usa a `service_role`).
- Banco: usa o modelo `Printers` já existente; nenhuma migração.
- Documentação: `docs/ROADMAP.md` marca "Registrar arquivo enviado para impressão" como concluído.
