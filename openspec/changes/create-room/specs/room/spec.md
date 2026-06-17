## ADDED Requirements

### Requirement: Criação de sala restrita a ADMIN

A API SHALL expor `POST /rooms/create` para cadastrar uma sala. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`. O corpo MUST conter `name` (string não vazia, obrigatório) e MAY conter `standardTime` (inteiro positivo) e `description` (string); quando `standardTime` for omitido, o valor padrão do banco (`180`) MUST ser aplicado.

O `name` MUST ser persistido em maiúsculas. O `slug` MUST ser derivado do `name` via `slugify` (`lower: true`, `strict: true`) e MUST ser único: havendo registros cujo slug começa com o slug derivado, um sufixo numérico (`-N`) MUST ser anexado. Em caso de sucesso, a API MUST responder `201` com `{ roomId }`.

#### Scenario: ADMIN cria uma sala com sucesso

- **WHEN** um funcionário ADMIN autenticado envia `name` válido
- **THEN** a sala é criada com o `name` em maiúsculas e um `slug` único
- **AND** a API responde `201` com `{ roomId }`

#### Scenario: standardTime omitido assume o padrão

- **WHEN** o corpo não informa `standardTime`
- **THEN** a sala é criada com o `standardTime` padrão do banco (`180`)

#### Scenario: Colisão de slug recebe sufixo

- **WHEN** já existe uma sala cujo slug começa com o slug derivado do novo `name`
- **THEN** o slug da nova sala recebe um sufixo numérico (`-N`) para permanecer único

#### Scenario: Corpo inválido

- **WHEN** `name` está ausente ou vazio, ou `standardTime` não é um inteiro positivo
- **THEN** a API responde `400` e nenhuma sala é criada

#### Scenario: Funcionário sem permissão

- **WHEN** a chamada é feita por um funcionário não-ADMIN
- **THEN** a API responde `401` e nenhuma sala é criada

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
- **AND** nenhuma sala é criada
