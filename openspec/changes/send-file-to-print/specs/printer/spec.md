## ADDED Requirements

### Requirement: Envio de arquivo para impressão pelo advogado com sessão ativa

A API SHALL expor `POST /printers/send-to-print/:macCode` para o app Desktop enviar um documento para impressão em nome do advogado com sessão ativa no computador. A rota MUST ser pública (sem JWT), no mesmo estilo de `release-computer`/`close-session`: o `macCode` identifica o computador, e o advogado da sessão é resolvido via `Computers.currentLawyerId`. Se o computador não existir, a API MUST responder `404`. Se o computador existir mas não possuir `currentLawyerId` (sem sessão ativa), a API MUST responder `400`.

O corpo MUST ser `multipart/form-data` contendo um único arquivo. O tipo MUST estar na allowlist (PDF, Word `.doc`/`.docx`, Excel `.xls`/`.xlsx`, PowerPoint `.ppt`/`.pptx`, imagens JPG/PNG/WEBP); fora da allowlist ou arquivo ausente MUST responder `400`. O tamanho MUST respeitar um limite de 20MB, aplicado via `request.file({ limits: { fileSize } })` — independente do limite global de 5MB usado por outras rotas de upload.

O arquivo MUST ser armazenado no bucket `prints` do Supabase Storage. A URL pública, o `computerId` e o `lawyerId` (o `currentLawyerId` do computador) MUST ser gravados em um novo registro de `Printers`. A resposta `200` MUST conter `{ message, printId, fileUrl }`.

#### Scenario: Advogado com sessão ativa envia um PDF válido

- **WHEN** o app Desktop envia um PDF para o `macCode` de um computador com `currentLawyerId` definido
- **THEN** o arquivo é armazenado no bucket `prints`
- **AND** um registro é criado em `Printers` com `fileUrl`, `computerId` e `lawyerId`
- **AND** a API responde `200` com `{ message, printId, fileUrl }`

#### Scenario: Computador sem sessão ativa

- **WHEN** o `macCode` corresponde a um computador sem `currentLawyerId`
- **THEN** a API responde `400` e nada é enviado ao bucket

#### Scenario: Computador não encontrado

- **WHEN** o `macCode` não corresponde a nenhum computador cadastrado
- **THEN** a API responde `404`

#### Scenario: Nenhum arquivo enviado

- **WHEN** a requisição chega sem arquivo
- **THEN** a API responde `400` e nada é alterado

#### Scenario: Tipo de arquivo inválido

- **WHEN** o arquivo enviado não está na allowlist (PDF, Word, Excel, PowerPoint, imagem)
- **THEN** a API responde `400` e nada é enviado ao bucket

#### Scenario: Arquivo acima do limite de tamanho

- **WHEN** o arquivo enviado excede 20MB
- **THEN** a API responde `413` com mensagem de arquivo muito grande

#### Scenario: Campo de upload documentado no Scalar/Swagger

- **WHEN** o spec OpenAPI da rota é gerado
- **THEN** o `requestBody` expõe `multipart/form-data` com o campo `file` (`format: binary`)
- **AND** o Scalar/Swagger renderiza o seletor de arquivo para anexar o documento
