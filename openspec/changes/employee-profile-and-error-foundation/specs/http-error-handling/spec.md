## ADDED Requirements

### Requirement: Tratamento global de erros

O sistema SHALL registrar um único `errorHandler` global (`app.setErrorHandler`) que traduz exceções em respostas HTTP padronizadas, antes do registro das rotas. Casos de uso MUST sinalizar falhas lançando erros de domínio em vez de montar a resposta HTTP localmente.

#### Scenario: Erro de validação Zod

- **WHEN** a requisição falha na validação de schema (`hasZodFastifySchemaValidationErrors`)
- **THEN** a API responde `400` com `message` genérica de validação
- **AND** inclui `errors` como lista de `{ field, message }`, onde `field` é o `instancePath` sem a barra inicial

#### Scenario: Erro de requisição inválida (domínio)

- **WHEN** o código lança `BadRequestError`
- **THEN** a API responde `400` com a `message` do erro

#### Scenario: Recurso não encontrado

- **WHEN** o código lança `NotFoundError`
- **THEN** a API responde `404` com a `message` do erro

#### Scenario: Não autorizado

- **WHEN** o código lança `UnauthorizedError`
- **THEN** a API responde `401` com a `message` do erro

#### Scenario: Falha em consulta externa (Axios)

- **WHEN** uma chamada à API externa lança `AxiosError`
- **THEN** a API responde `404` informando consulta indisponível ou advogado não encontrado

#### Scenario: Erro não previsto

- **WHEN** ocorre um erro que não corresponde a nenhum dos casos acima
- **THEN** a API responde `500` com mensagem genérica de erro interno
- **AND** o erro é registrado no servidor para diagnóstico

### Requirement: Classes de erro de domínio

O sistema SHALL expor classes de erro de domínio em `src/http/_errors/` que os casos de uso usam para sinalizar falhas sem conhecer o código HTTP: `BadRequestError`, `NotFoundError` e `UnauthorizedError`. `UnauthorizedError` MUST ter uma mensagem padrão quando nenhuma for informada.

#### Scenario: UnauthorizedError sem mensagem

- **WHEN** `UnauthorizedError` é instanciado sem argumento
- **THEN** sua mensagem assume um texto padrão de "não autorizado"
