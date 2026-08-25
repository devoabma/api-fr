## ADDED Requirements

### Requirement: Estado (UF) da sala

Toda sala SHALL ter um estado, gravado em `rooms.uf` como `CHAR(2)` **obrigatório**. A coluna MUST NOT ter valor padrão no banco: o padrão pertence ao contrato da rota de criação, onde pode mudar sem migração.

A sigla MUST ser validada contra a lista fechada das 27 unidades federativas do Brasil. A entrada MUST ser normalizada antes da validação (espaços removidos, caixa alta), de modo que `" ma "` seja aceito como `MA` e `"XX"` seja rejeitado com `400`.

O estado SHALL ser a origem única da UF entregue à estação no `registered` do canal WebSocket. Por ser o dado que decide se uma máquina entra em uma publicação de versão dirigida a um estado, sigla livre digitada no cliente MUST ser tratada como defeito: uma UF errada não falha em lugar nenhum e só aparece como atualização que não chegou.

#### Scenario: Salas existentes na adoção do campo

- **WHEN** a migração que cria a coluna é aplicada
- **THEN** as salas já cadastradas recebem `MA` pelo backfill
- **AND** o valor padrão é removido da coluna em seguida, de modo que cadastro novo tenha de informar o estado

#### Scenario: Sigla fora da lista

- **WHEN** o corpo de criação ou edição informa uma `uf` que não é uma das 27 siglas
- **THEN** a API responde `400` com a mensagem "UF inválida. Use a sigla de 2 letras do estado (ex: MA)."
- **AND** nada é criado nem atualizado

## MODIFIED Requirements

### Requirement: Criação de sala restrita a ADMIN

A API SHALL expor `POST /rooms/create` para cadastrar uma sala. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`. O corpo MUST conter `name` (string não vazia, obrigatório) e MAY conter `uf` (sigla de estado), `standardTime` (inteiro positivo) e `description` (string); quando `standardTime` for omitido, o valor padrão do banco (`180`) MUST ser aplicado.

Quando `uf` for omitida, a API MUST aplicar `MA` como padrão. Esse padrão MUST viver no schema Zod da rota, e não como default da coluna, de modo que um cliente que ainda não conhece o campo continue cadastrando salas sem exigir deploy coordenado, e que a mudança do padrão não exija migração.

O `name` MUST ser persistido em maiúsculas. O `slug` MUST ser derivado do `name` via `slugify` (`lower: true`, `strict: true`) e MUST ser único (constraint `@unique`): havendo uma sala cujo slug seja exatamente igual ao slug derivado, a API MUST rejeitar a criação com `400`. Em caso de sucesso, a API MUST responder `201` com `{ roomId }`.

#### Scenario: ADMIN cria uma sala com sucesso

- **WHEN** um funcionário ADMIN autenticado envia `name` válido
- **THEN** a sala é criada com o `name` em maiúsculas e um `slug` único
- **AND** a API responde `201` com `{ roomId }`

#### Scenario: uf omitida assume MA

- **WHEN** o corpo não informa `uf`
- **THEN** a sala é criada com `uf` igual a `MA`

#### Scenario: uf informada em minúsculas

- **WHEN** o corpo informa `uf` como `"es"`
- **THEN** a sala é criada com `uf` igual a `ES`

#### Scenario: standardTime omitido assume o padrão

- **WHEN** o corpo não informa `standardTime`
- **THEN** a sala é criada com o `standardTime` padrão do banco (`180`)

#### Scenario: Slug duplicado é rejeitado

- **WHEN** já existe uma sala cujo slug é exatamente igual ao slug derivado do novo `name`
- **THEN** a API responde `400` com a mensagem "Sala com esse nome já cadastrada." e nenhuma sala é criada

#### Scenario: Corpo inválido

- **WHEN** `name` está ausente ou vazio, `uf` não é uma sigla válida, ou `standardTime` não é um inteiro positivo
- **THEN** a API responde `400` e nenhuma sala é criada

#### Scenario: Funcionário sem permissão

- **WHEN** a chamada é feita por um funcionário não-ADMIN
- **THEN** a API responde `401` e nenhuma sala é criada

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
- **AND** nenhuma sala é criada

### Requirement: Edição parcial de sala restrita a ADMIN

A API SHALL expor `PATCH /rooms/update/:id` para editar uma sala por `id`. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`. O `id` (params) MUST ser um `cuid2`. O corpo é parcial: MAY conter `name` (string), `uf` (sigla de estado), `standardTime` (inteiro positivo) e `description` (string); apenas os campos enviados MUST ser atualizados.

O campo `uf` MUST NOT ter padrão nesta rota. Aplicar aqui o padrão da criação MUST ser tratado como defeito: devolveria toda sala de outro estado para `MA` a cada edição de nome ou de tempo padrão.

Se a sala não existir, a API MUST responder `404`. Quando `name` for enviado e diferente do nome atual (comparação em maiúsculas), o `name` MUST ser persistido em maiúsculas e o `slug` MUST ser regerado via `slugify` (`lower: true`, `strict: true`); a checagem de duplicidade MUST ignorar a própria sala (`id: { not: id }`) e, havendo outra sala com o mesmo slug, a API MUST rejeitar com `400`. Quando o nome não muda, o `slug` MUST permanecer inalterado. Em caso de sucesso, a API MUST responder `200` com `{ message }`.

#### Scenario: ADMIN edita campos parciais

- **WHEN** um ADMIN envia apenas `standardTime` e/ou `description`
- **THEN** somente os campos enviados são atualizados e o slug permanece inalterado
- **AND** a API responde `200` com `{ message }`

#### Scenario: Edição sem uf preserva o estado atual

- **WHEN** um ADMIN edita uma sala de `ES` sem enviar `uf`
- **THEN** a sala continua com `uf` igual a `ES`

#### Scenario: ADMIN corrige o estado da sala

- **WHEN** um ADMIN envia `uf` com uma sigla válida diferente da atual
- **THEN** a sala passa a ter o novo estado
- **AND** as estações daquela sala recebem a UF nova no próximo registro no canal

#### Scenario: Nome que gera slug duplicado é rejeitado

- **WHEN** o novo `name` gera um slug já usado por outra sala (`id` diferente)
- **THEN** a API responde `400` com a mensagem "Sala com esse nome já cadastrada." e nada é atualizado

#### Scenario: Sala inexistente

- **WHEN** o `id` informado não corresponde a nenhuma sala
- **THEN** a API responde `404` com a mensagem "Sala não encontrada."

#### Scenario: Funcionário sem permissão ou sem autorização

- **WHEN** a chamada é feita por um não-ADMIN, sem JWT ou com token inválido/expirado
- **THEN** a API responde `401` e nada é atualizado

### Requirement: Listagem de salas por papel

A API SHALL expor `GET /rooms/get-all` para listar salas de acordo com o papel do funcionário autenticado. A rota MUST registrar o plugin `auth` e obter `{ id, role }` via `request.getCurrentEmployee()` (sem exigir ADMIN). O escopo MUST depender do papel:

- `ADMIN`: MUST retornar todas as salas cadastradas, inclusive inativas (`where: {}`).
- `MEMBER`: MUST retornar apenas as salas ativas (`inactive: null`) às quais o funcionário está vinculado, filtrando por `employeesRooms: { some: { employeeId } }`.

As salas MUST ser ordenadas por `createdAt` em ordem decrescente, e cada sala MUST devolver `id`, `name`, `uf` (o estado da sala, para que o painel possa exibi-lo e corrigi-lo), `standardTime`, `description`, `inactive` e `createdAt`, além dos funcionários vinculados e dos `computers` (`id`, `macCode`, `number`, `description`, `inUse`, `maintenance`).

Como desligar um funcionário é **soft delete** (preenche `employees.inactive` e mantém o registro em `employees_rooms`), o array `employeesRooms` MUST conter apenas os vínculos cujo funcionário está ativo — a consulta MUST aplicar `where: { employees: { inactive: null } }` ao `select` de `employeesRooms`, para os dois papéis. Em caso de sucesso, a API MUST responder `200` com `{ rooms }`.

#### Scenario: ADMIN lista todas as salas

- **WHEN** um funcionário ADMIN autenticado chama `GET /rooms/get-all`
- **THEN** a API responde `200` com `{ rooms }` contendo todas as salas (inclusive inativas), ordenadas por `createdAt` desc
- **AND** cada sala inclui seus computadores com `inUse` e `maintenance`

#### Scenario: MEMBER lista apenas as próprias salas ativas

- **WHEN** um funcionário MEMBER autenticado chama `GET /rooms/get-all`
- **THEN** a API responde `200` com `{ rooms }` contendo apenas as salas ativas às quais ele está vinculado

#### Scenario: Estado da sala no response

- **WHEN** um funcionário autenticado (ADMIN ou MEMBER) chama `GET /rooms/get-all`
- **THEN** cada sala devolvida inclui `uf` com a sigla do estado, em maiúsculas
- **AND** o campo nunca vem nulo ou vazio, porque a coluna é obrigatória

#### Scenario: Data de criação da sala no response

- **WHEN** um funcionário autenticado (ADMIN ou MEMBER) chama `GET /rooms/get-all`
- **THEN** cada sala devolvida inclui `createdAt` com a data/hora do cadastro da sala
- **AND** a sequência de `createdAt` acompanha a ordenação decrescente da lista

#### Scenario: Sala desativada não aparece para o MEMBER

- **WHEN** uma sala vinculada ao funcionário MEMBER tem `inactive` preenchido
- **THEN** essa sala não é incluída na resposta

#### Scenario: Funcionário desligado não aparece na equipe da sala

- **WHEN** uma sala tem vínculo com um funcionário cujo `inactive` está preenchido
- **THEN** esse vínculo não é incluído em `employeesRooms` na resposta
- **AND** os demais funcionários ativos da mesma sala continuam listados

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`
