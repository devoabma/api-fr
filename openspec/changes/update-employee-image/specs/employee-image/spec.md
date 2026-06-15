## ADDED Requirements

### Requirement: Upload da foto de perfil do funcionário autenticado

A API SHALL expor `PATCH /employees/update-image` para o funcionário autenticado enviar a própria foto de perfil. A rota MUST registrar o plugin `auth` e resolver o alvo via `request.getIdCurrentEmployee()`. O corpo MUST ser `multipart/form-data` contendo um único arquivo, cujo tipo MUST estar na allowlist (`image/jpeg`, `image/jpg`, `image/png`, `image/webp`) e cujo tamanho MUST respeitar o limite de 5MB. O arquivo MUST ser armazenado no bucket `profiles` do Supabase Storage em `uploads/<uuid>.<ext>`, e a URL pública e o caminho do arquivo MUST ser gravados em `imageUrl` e `imagePublicId` do funcionário. Quando o funcionário já possui `imagePublicId`, a imagem anterior MUST ser removida do bucket após o cadastro ser atualizado para a nova; essa remoção é não-fatal (uma falha apenas é registrada e não impede a atualização nem altera a resposta `200`).

#### Scenario: Funcionário troca a própria foto com sucesso

- **WHEN** um funcionário autenticado envia um arquivo de imagem válido
- **THEN** o arquivo é armazenado no bucket `profiles`
- **AND** `imageUrl` e `imagePublicId` são atualizados
- **AND** a API responde `200` com `{ imageUrl }`

#### Scenario: Substituição da imagem anterior

- **WHEN** o funcionário já possuía uma imagem (`imagePublicId` presente) e envia uma nova
- **THEN** a nova imagem é enviada ao bucket e o cadastro é atualizado
- **AND** o arquivo anterior é removido do bucket
- **AND** uma falha nessa remoção não impede a atualização do cadastro nem altera a resposta `200`

#### Scenario: Nenhum arquivo enviado

- **WHEN** a requisição chega sem arquivo
- **THEN** a API responde `400` e nada é alterado

#### Scenario: Tipo de arquivo inválido

- **WHEN** o arquivo enviado não é JPG, PNG ou WEBP
- **THEN** a API responde `400` e nada é enviado ao bucket

#### Scenario: Arquivo acima do limite de tamanho

- **WHEN** o arquivo enviado excede 5MB
- **THEN** a API responde `413` com mensagem de arquivo muito grande

#### Scenario: Funcionário inexistente

- **WHEN** o `id` do funcionário autenticado não corresponde a nenhum registro
- **THEN** a API responde `404` e nada é alterado

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
- **AND** nenhum dado é alterado
