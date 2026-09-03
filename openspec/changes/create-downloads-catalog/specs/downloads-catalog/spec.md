## ADDED Requirements

### Requirement: Cadastro de arquivo para download restrito a ADMIN

A API SHALL expor `POST /downloads/create` para cadastrar um arquivo. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`. O corpo MUST conter `kind` (`INSTALLER` ou `UNINSTALLER`), `name` (até 80 caracteres) e `url`; `description` e `version` são opcionais.

#### Scenario: ADMIN cadastra o instalador

- **WHEN** um funcionário ADMIN autenticado envia `kind`, `name` e `url` válidos
- **THEN** o arquivo é cadastrado como ativo (`inactive` nulo)
- **AND** a API responde `201` com `{ downloadId }`

#### Scenario: Funcionário sem permissão

- **WHEN** a chamada é feita por um funcionário não-ADMIN
- **THEN** a API responde `401` e nenhum registro é criado

#### Scenario: Chamada sem token

- **WHEN** a chamada chega sem `Authorization`
- **THEN** a API responde `401`

### Requirement: No máximo um download ativo por tipo

A API MUST recusar a operação que resultaria em dois registros ativos do mesmo `kind`. A verificação MUST acontecer **antes** da gravação, e MUST valer tanto no cadastro quanto na reativação. A checagem MUST viver num único módulo compartilhado pelas duas rotas.

#### Scenario: Segundo ativo do mesmo tipo

- **GIVEN** já existe um `INSTALLER` ativo
- **WHEN** um ADMIN tenta cadastrar outro `INSTALLER`
- **THEN** a API responde `400` nomeando o registro ativo que está no caminho
- **AND** nenhum registro é criado

#### Scenario: Tipo diferente não conflita

- **GIVEN** já existe um `INSTALLER` ativo
- **WHEN** um ADMIN cadastra um `UNINSTALLER`
- **THEN** a API responde `201`

#### Scenario: Cadastro liberado após inativar o anterior

- **GIVEN** o único `INSTALLER` ativo foi inativado
- **WHEN** um ADMIN cadastra um novo `INSTALLER`
- **THEN** a API responde `201`

#### Scenario: Reativação bloqueada por um ativo do mesmo tipo

- **GIVEN** um `INSTALLER` inativo e outro `INSTALLER` ativo
- **WHEN** um ADMIN tenta reativar o inativo
- **THEN** a API responde `400` e o registro permanece inativo

### Requirement: URL restrita aos protocolos http e https

A API MUST recusar `url` cujo protocolo não seja `http` ou `https`, porque o valor é renderizado como destino de link no painel. A validação MUST acontecer no cadastro e na edição.

#### Scenario: Esquema javascript recusado

- **WHEN** um ADMIN envia `url` igual a `javascript:alert(1)`
- **THEN** a API responde `400` de validação e nenhum registro é criado ou alterado

#### Scenario: Endereço sem protocolo recusado

- **WHEN** um ADMIN envia `url` igual a `salalivre.app/arquivo.exe`
- **THEN** a API responde `400` de validação

### Requirement: Listagem com recorte por papel

A API SHALL expor `GET /downloads/get-all` para qualquer funcionário autenticado. A resposta MUST variar pelo papel: `ADMIN` recebe todos os registros, inclusive os inativos; qualquer outro papel MUST receber somente os ativos. A ordenação MUST ser por `kind` e, dentro do tipo, do mais recente para o mais antigo.

#### Scenario: ADMIN enxerga o histórico

- **GIVEN** existem registros ativos e ao menos um inativo
- **WHEN** um ADMIN autenticado lista os downloads
- **THEN** a API responde `200` com todos, cada um trazendo seu `inactive` (nulo ou com carimbo)

#### Scenario: MEMBER enxerga só o que dá para baixar

- **GIVEN** existem registros ativos e ao menos um inativo
- **WHEN** um MEMBER autenticado lista os downloads
- **THEN** a API responde `200` apenas com os ativos

### Requirement: Edição sem troca de tipo

A API SHALL expor `PATCH /downloads/update/:id` restrito a ADMIN, aceitando `name`, `url`, `description` e `version`. O campo `kind` MUST NOT ser editável. Campos ausentes MUST manter o valor atual; `description` e `version` enviados como `null` MUST limpar o valor.

#### Scenario: ADMIN corrige o link

- **WHEN** um ADMIN envia uma `url` válida para um registro existente
- **THEN** a API responde `200` e o registro passa a apontar para o novo endereço

#### Scenario: Limpar a versão

- **WHEN** um ADMIN envia `version` como `null`
- **THEN** o campo é apagado, e não mantido

#### Scenario: Registro inexistente

- **WHEN** o `:id` não corresponde a nenhum registro
- **THEN** a API responde `404`

### Requirement: Inativação e reativação em vez de exclusão

A API SHALL expor `PATCH /downloads/deactivate/:id` e `PATCH /downloads/activate/:id`, ambos restritos a ADMIN. A API MUST NOT oferecer exclusão física: o registro inativo permanece no banco como histórico do endereço anterior. Cada rota MUST recusar a operação quando o registro já está no estado pedido.

#### Scenario: Inativar um download ativo

- **WHEN** um ADMIN inativa um registro ativo
- **THEN** a API responde `200` e `inactive` recebe o carimbo do momento

#### Scenario: Inativar o que já está inativo

- **WHEN** um ADMIN inativa um registro já inativo
- **THEN** a API responde `400`

#### Scenario: Reativar o que já está ativo

- **WHEN** um ADMIN reativa um registro já ativo
- **THEN** a API responde `400`

### Requirement: Resposta de erro de validação preserva os campos

As rotas que declaram resposta `400` MUST usar o schema compartilhado que inclui o array opcional `errors`. Um `400` declarado como apenas `{ message }` faz o serializador do Fastify descartar os campos inválidos montados pelo errorHandler, e o cliente perde a informação de o que corrigir.

#### Scenario: Falha de validação nomeia os campos

- **WHEN** um ADMIN envia `name` vazio e `url` inválida
- **THEN** a API responde `400` com `message` e com `errors` listando `name` e `url`

#### Scenario: Falha de regra de negócio traz só a mensagem

- **WHEN** a operação é recusada por já existir um ativo do mesmo tipo
- **THEN** a API responde `400` com `message` e sem `errors`
