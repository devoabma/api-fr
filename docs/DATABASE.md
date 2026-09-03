# 📚 Documentação do Banco de Dados — Sala Livre API

> **Sistema**: Sala Livre (OAB-MA) — gestão de salas com computadores de uso compartilhado por advogados.
> **ORM**: Prisma · **Banco**: PostgreSQL
> **Fonte da verdade**: [`prisma/schema.prisma`](../prisma/schema.prisma)

---

## 🎯 Visão Geral do Domínio

A **Sala Livre** é um espaço (físico) da OAB onde advogados podem usar **computadores** durante um
**tempo limitado**. O sistema controla:

- **Quem administra** o ambiente → `Employees` (funcionários, com papéis `ADMIN`/`MEMBER`).
- **Onde** ficam os computadores → `Rooms` (salas).
- **Quais máquinas** existem e seu estado → `Computers`.
- **Quem usa** as máquinas → `Lawyers` (advogados, identificados pela OAB).
- **Quando** cada uso acontece → `ComputerSessions` (sessões com início/fim).
- **O que é impresso** → `Printers` (arquivos enviados para impressão).
- **Recuperação de senha** de funcionários → `Tokens`.

### Fluxo resumido

```
Employee (ADMIN) ──cadastra──▶ Rooms ──contém──▶ Computers
        │                                              │
        │ vínculo N:N (EmployeesRooms)                 │ uso registrado em
        ▼                                              ▼
   gerencia salas                              ComputerSessions ◀──── Lawyer
                                                       │                  │
                                                       └── impressões ────┴──▶ Printers
```

---

## 🧩 Enums

### `Roles` — papel do funcionário
| Valor    | Significado                                            |
|----------|--------------------------------------------------------|
| `ADMIN`  | Acesso administrativo total.                           |
| `MEMBER` | Funcionário comum (**valor padrão** em `Employees`).   |

### `TokenTypes` — finalidade do token
| Valor              | Significado                              |
|--------------------|------------------------------------------|
| `PASSWORD_RECOVER` | Token de recuperação de senha.           |

### `AppVersionOrigins` — por onde a versão publicada chegou
| Valor       | Significado                                                                       |
|-------------|-----------------------------------------------------------------------------------|
| `PUBLISHER` | Chegou pelo `POST /app/version`, no instante da publicação. É a fonte.             |
| `MIRROR`    | Chegou pelo job que espelha o arquivo público. É a rede de segurança.              |

> Campo de **diagnóstico**: responde "por onde esta versão chegou por último" quando alguém pergunta
> por que o painel demorou a mostrar o número novo. Não participa de nenhuma regra de negócio.

### `DownloadKinds` — o que o arquivo é
| Valor         | Significado                                            |
|---------------|--------------------------------------------------------|
| `INSTALLER`   | O executável que instala o Sala Livre na estação.      |
| `UNINSTALLER` | O executável que remove o Sala Livre da estação.       |

> É por este campo que o front sabe qual link vai em cada botão — **não** pelo nome, que é texto
> livre editável. Enum, e não texto: um `"INSTALADOR"` digitado errado não daria erro em lugar
> nenhum, o botão só ficaria vazio. Vale a regra de **um ativo por tipo** (ver a tabela `downloads`).

---

## 🗂️ Modelos (Tabelas)

> Convenção: os campos no código usam **camelCase**; no banco são mapeados para **snake_case** via `@map`.
> O nome da tabela é definido por `@@map`. IDs usam **CUID** (`@default(cuid())`).

---

### 1. `Employees` → tabela `employees`
Funcionários/usuários do sistema (quem opera a Sala Livre).

| Campo           | Tipo        | Coluna (DB)         | Regras / Observações                          |
|-----------------|-------------|---------------------|-----------------------------------------------|
| `id`            | String      | `id`                | PK, CUID.                                      |
| `name`          | String      | `name`              | Nome do funcionário.                           |
| `cpf`           | String      | `cpf`               | **Único**.                                     |
| `email`         | String      | `email`             | **Único**.                                     |
| `imageUrl`      | String?     | `image_url`         | URL do avatar (opcional).                      |
| `imagePublicId` | String?     | `image_public_id`   | ID público no provedor de imagem (ex.: Cloudinary). |
| `passwordHash`  | String      | `password_hash`     | Hash da senha (nunca a senha em texto).        |
| `role`          | Roles       | `role`              | Papel; **default `MEMBER`**.                   |
| `inactive`      | DateTime?   | `inactive`          | **Soft delete**: se preenchido, está inativo.  |
| `createdAt`     | DateTime    | `created_at`        | `@default(now())`.                             |
| `updatedAt`     | DateTime    | `updated_at`        | `@updatedAt` (atualiza sozinho).               |

**Relações**
- `tokens` → `Tokens[]` (1:N) — tokens de recuperação deste funcionário.
- `employeesRooms` → `EmployeesRooms[]` (N:N com `Rooms`).

---

### 2. `Tokens` → tabela `tokens`
Tokens temporários (hoje só recuperação de senha) vinculados a um funcionário.

| Campo        | Tipo        | Coluna (DB)    | Regras / Observações                              |
|--------------|-------------|----------------|---------------------------------------------------|
| `id`         | String      | `id`           | PK, CUID.                                          |
| `type`       | TokenTypes  | `type`         | Finalidade (`PASSWORD_RECOVER`).                  |
| `code`       | String      | `code`         | **Único**, `VarChar(6)` — código de 6 caracteres. |
| `createdAt`  | DateTime    | `created_at`   | `@default(now())`.                                |
| `expiresAt`  | DateTime?   | `expires_at`   | Validade do token (opcional).                     |
| `employeeId` | String      | `employee_id`  | FK → `Employees.id`.                              |

**Relações**
- `employee` → `Employees` (N:1). **`onDelete: Cascade`**: apagar o funcionário apaga seus tokens.

---

### 3. `Rooms` → tabela `rooms`
Salas que contêm os computadores.

| Campo          | Tipo      | Coluna (DB)       | Regras / Observações                                   |
|----------------|-----------|-------------------|--------------------------------------------------------|
| `id`           | String    | `id`              | PK, CUID.                                               |
| `name`         | String    | `name`            | **Único**.                                             |
| `slug`         | String    | `slug`            | **Único** — identificador amigável p/ URL.            |
| `uf`           | String    | `uf`              | `CHAR(2)`, **obrigatório e sem default no banco** — sigla do estado da sala. Validada contra as 27 UFs no Zod, que aplica `MA` como padrão no cadastro. Vai para a estação no `registered` do WebSocket. |
| `standardTime` | Int       | `standard_time`   | Tempo padrão de uso em **minutos**; **default 180**.   |
| `description`  | String?   | `description`     | Descrição opcional.                                    |
| `inactive`     | DateTime? | `inactive`        | **Soft delete**.                                       |
| `createdAt`    | DateTime  | `created_at`      | `@default(now())`.                                     |
| `updatedAt`    | DateTime  | `updated_at`      | `@updatedAt`.                                          |

**Relações**
- `employeesRooms` → `EmployeesRooms[]` (N:N com `Employees`).
- `computers` → `Computers[]` (1:N).

---

### 4. `EmployeesRooms` → tabela `employees_rooms`
Tabela de junção **N:N** entre `Employees` e `Rooms` (quais funcionários cuidam de quais salas).

| Campo        | Tipo     | Coluna (DB)     | Regras / Observações                  |
|--------------|----------|-----------------|---------------------------------------|
| `id`         | String   | `id`            | PK, CUID.                             |
| `createdAt`  | DateTime | `created_at`    | `@default(now())`.                   |
| `employeeId` | String   | `employee_id`   | FK → `Employees.id`, **Cascade**.    |
| `roomId`     | String   | `room_id`       | FK → `Rooms.id`, **Cascade**.        |

**Restrições**
- `@@unique([employeeId, roomId])` — um funcionário **não** pode ser vinculado à mesma sala duas vezes.
- Ambas as FKs com **`onDelete: Cascade`**: apagar funcionário OU sala remove o vínculo.

---

### 5. `Computers` → tabela `computers`
Computadores físicos disponíveis em uma sala.

| Campo             | Tipo      | Coluna (DB)          | Regras / Observações                                  |
|-------------------|-----------|----------------------|-------------------------------------------------------|
| `id`              | String    | `id`                 | PK, CUID.                                              |
| `macCode`         | String    | `mac_code`           | **Único** — identificador da máquina (MAC).           |
| `description`     | String    | `description`        | Descrição da máquina.                                 |
| `number`          | Int       | `number`             | Número/posição do computador na sala.                 |
| `inUse`           | Boolean   | `in_use`             | Está em uso agora? **default `false`**.               |
| `maintenance`     | DateTime? | `maintenance`        | Marcado se estiver em manutenção.                     |
| `appVersion`      | String?   | `app_version`        | `VARCHAR(40)`. Última versão do Desktop informada pela estação no `register`. Texto (`"1.0.7"`), nunca número. |
| `appVersionReportedAt` | DateTime? | `app_version_reported_at` | **Quando ela informou**, não quando esteve online. |
| `createdAt`       | DateTime  | `created_at`         | `@default(now())`.                                    |
| `updatedAt`       | DateTime  | `updated_at`         | `@updatedAt`.                                         |
| `roomId`          | String    | `room_id`            | FK → `Rooms.id`.                                      |
| `currentLawyerId` | String?   | `current_lawyer_id`  | **FK** → `Lawyers.id`, **`@unique`** (advogado usando no momento). |

**Relações**
- `room` → `Rooms` (N:1). ⚠️ Sem `onDelete` explícito → comportamento padrão (`Restrict`): não dá para apagar a sala se ela tiver computadores.
- `currentLawyer` → `Lawyers?` (**1:1**, opcional). **`onDelete: SetNull`**: ao apagar o advogado, o campo volta a `null`.
- `computerSession` → `ComputerSessions[]` (1:N).
- `printers` → `Printers[]` (1:N).

> 🔒 **Regra de negócio — um advogado não usa dois computadores ao mesmo tempo**: garantida pelo `@unique` em `currentLawyerId`. No Postgres, várias linhas com `NULL` são permitidas (máquinas livres), mas só pode existir **um** computador por advogado não-nulo. **A lógica da aplicação é responsável por limpar o campo (`currentLawyerId = null`) ao encerrar a sessão** — caso contrário a máquina fica "presa" àquele advogado.

> 📦 **Sobre `appVersion` / `appVersionReportedAt`** — três leituras erradas que o par convida e que o modelo recusa:
> 1. **Não é heartbeat.** A versão só viaja no `register`, ou seja, **a cada conexão**. Uma estação um mês no ar sem cair informa uma vez só, no começo do mês: o carimbo antigo dela não significa nada de errado. Quem está online agora é o mapa em memória do canal (`GET /computers/online/:roomId?`), nunca este campo.
> 2. **O valor pode diminuir.** O Desktop volta sozinho ao executável anterior quando a atualização falha três vezes, então `1.0.7` hoje e `1.0.6` amanhã é comportamento legítimo — e o sinal mais valioso do parque. A gravação é crua, sem comparar com o que já estava.
> 3. **`NULL` não é pendência.** Existe um interruptor local de envio; desligado, o campo sai fora do JSON. `NULL` quer dizer "nunca informou" (nunca conectou desde a migração, ou está configurada para não informar), e **registro sem o campo nunca apaga o valor guardado**.

---

### 6. `Lawyers` → tabela `lawyers`
Advogados que utilizam os computadores (identificados pela OAB).

| Campo           | Tipo      | Coluna (DB)        | Regras / Observações                              |
|-----------------|-----------|--------------------|---------------------------------------------------|
| `id`            | String    | `id`               | PK, CUID.                                          |
| `name`          | String    | `name`             | Nome do advogado.                                 |
| `cpf`           | String    | `cpf`              | **Único**.                                        |
| `oab`           | String    | `oab`              | **Único** — número de inscrição na OAB.          |
| `email`         | String    | `email`            | **Único**.                                        |
| `birth`         | String    | `birth`            | Data de nascimento (armazenada como **String**).  |
| `category`      | String    | `category`         | Categoria do advogado.                            |
| `remainingTime` | Int?      | `remaining_time`   | Tempo restante de uso em **minutos** (opcional).  |
| `lastAccess`    | DateTime? | `last_access`      | Último acesso.                                     |
| `createdAt`     | DateTime  | `created_at`       | `@default(now())`.                                |
| `updatedAt`     | DateTime  | `updated_at`       | `@updatedAt`.                                      |

**Relações**
- `computerSessions` → `ComputerSessions[]` (1:N).
- `printers` → `Printers[]` (1:N).
- `currentComputer` → `Computers?` (**1:1**) — o computador que este advogado está usando agora (no máximo um, por causa do `@unique`).

> ⚠️ **Nota de modelagem**: `birth` é `String` (não `DateTime`) — validação de formato fica a cargo da aplicação.

---

### 7. `ComputerSessions` → tabela `computer_sessions`
Registra cada **sessão de uso** de um computador por um advogado.

| Campo        | Tipo      | Coluna (DB)     | Regras / Observações                          |
|--------------|-----------|-----------------|-----------------------------------------------|
| `id`         | String    | `id`            | PK, CUID.                                      |
| `startedAt`  | DateTime  | `started_at`    | Início; `@default(now())`.                    |
| `endedAt`    | DateTime? | `ended_at`      | Fim (nulo = sessão **em andamento**).         |
| `computerId` | String    | `computer_id`   | FK → `Computers.id`.                          |
| `lawyerId`   | String    | `lawyer_id`     | FK → `Lawyers.id`.                            |

**Relações**
- `computer` → `Computers` (N:1). Sem `onDelete` explícito → `Restrict`.
- `lawyer` → `Lawyers` (N:1). Sem `onDelete` explícito → `Restrict`.

**Índices** (migração `20260901120000_indices_para_metricas`)
- `@@index([startedAt])` — recorte por período das métricas.
- `@@index([computerId])` — agregação por sala, que chega aqui via `Computers`.
- `@@index([lawyerId])` — ranking por advogado.

> 💡 Sessão "aberta" = `endedAt == null`. A duração é `endedAt - startedAt`.

> ⚠️ Esta é a única tabela que **cresce sem teto** — uma linha por liberação, para sempre. Ela nasceu só com a PK; sem os índices acima cada agregação da tela de métricas varre a tabela inteira.

---

### 8. `Printers` → tabela `printers`
Arquivos enviados para impressão, associados a um computador e a um advogado.

| Campo        | Tipo     | Coluna (DB)     | Regras / Observações                       |
|--------------|----------|-----------------|--------------------------------------------|
| `id`         | String   | `id`            | PK, CUID.                                  |
| `fileUrl`    | String   | `file_url`      | **Único** — URL do arquivo impresso.       |
| `createdAt`  | DateTime | `created_at`    | `@default(now())`.                         |
| `computerId` | String   | `computer_id`   | FK → `Computers.id`, **Cascade**.          |
| `lawyerId`   | String   | `lawyer_id`     | FK → `Lawyers.id`, **Cascade**.            |

**Relações**
- `computer` → `Computers` (N:1). **`onDelete: Cascade`**.
- `lawyer` → `Lawyers` (N:1). **`onDelete: Cascade`**.

---

### 9. `AppVersions` → tabela `app_versions`
Versões publicadas do Desktop. É a metade que faltava para responder **"quais máquinas estão atrasadas"** — a outra metade é `computers.app_version`, que cada estação anuncia no `register` do canal.

Tabela **sem relação com nenhuma outra**: ela descreve o parque como um todo, não uma máquina.

| Campo         | Tipo              | Coluna (DB)     | Regras / Observações                                                                 |
|---------------|-------------------|-----------------|--------------------------------------------------------------------------------------|
| `id`          | String            | `id`            | PK, CUID.                                                                             |
| `version`     | String            | `version`       | **Único**, `VarChar(40)`. Texto, nunca numérico.                                       |
| `envelope`    | String            | `envelope`      | O manifesto assinado **como chegou**, sem reserializar.                                |
| `generatedAt` | DateTime?         | `generated_at`  | `geradoEm` de dentro do manifesto: quando a versão foi publicada, não quando a API soube. |
| `notes`       | String?           | `notes`         | `notas` do manifesto, em português, para o funcionário ler antes de mandar atualizar.  |
| `rollout`     | Json?             | `rollout`       | `implantacao` (`{ percentual, macs }`), guardada como veio, sem interpretar.            |
| `origin`      | AppVersionOrigins | `origin`        | Por qual das duas fontes esta linha chegou por último.                                  |
| `etag`        | String?           | `etag`          | `ETag` da última leitura pública — é o que faz o job perguntar com `If-None-Match`.     |
| `createdAt`   | DateTime          | `created_at`    | `@default(now())`. Indexado **desc**.                                                   |
| `updatedAt`   | DateTime          | `updated_at`    | `@updatedAt`.                                                                           |

**Três decisões que o modelo esconde**

1. **É histórico, e não uma linha só sobrescrita.** Uma linha por versão responde de graça "quando a 1.0.8 saiu, com que notas" — hoje isso só existe no terminal de quem publicou. A **vigente** é a de `created_at` mais recente, e isso só é verdade porque a gravação recusa o que é mais velho do que o já guardado.
2. **`version` é texto, e a ordenação por versão não é do banco.** `ORDER BY version` mentiria: `'1.0.10' < '1.0.7'` em comparação alfabética. A conta mora em `src/utils/app-version.ts`, por partes numéricas.
3. **`envelope` é texto cru, e não `Json`.** A fase 2 (`GET /app/version`) devolve este campo byte a byte às estações, e a estação recusa em silêncio o envelope cuja assinatura não confere. Guardar objeto e remontar na saída reordena chaves e reindenta o JSON — ou seja, quebraria a assinatura sem alterar um único dado.

### 10. `Downloads` → tabela `downloads`
Os arquivos que o funcionário baixa do painel — hoje o instalador e o desinstalador do Desktop.

Existe porque esse endereço não tinha dono: o Dev C# manda os dois links a cada versão e eles circulavam por mensagem, colados à mão em algum ponto do front. O erro que isso produz é o pior tipo — alguém distribui um executável velho e **nada na aplicação sabe dizer que está velho**.

Tabela **sem relação com nenhuma outra**, como `app_versions`.

| Campo         | Tipo          | Coluna (DB)  | Regras / Observações                                                              |
|---------------|---------------|--------------|-----------------------------------------------------------------------------------|
| `id`          | String        | `id`         | PK, CUID.                                                                          |
| `kind`        | DownloadKinds | `kind`       | O que o arquivo é. **Um ativo por tipo** (regra de aplicação). Não editável no update. |
| `name`        | String        | `name`       | `VarChar(80)`. O rótulo que aparece no botão, escrito para o funcionário ler.       |
| `description` | String?       | `description`| Texto de apoio opcional ("instale com a máquina fora de uso").                      |
| `url`         | String        | `url`        | Endereço direto do arquivo. Só `http`/`https`, validado na entrada.                 |
| `version`     | String?       | `version`    | `VarChar(40)`. Texto, nunca numérico. Opcional: o desinstalador raramente é versionado. |
| `inactive`    | DateTime?     | `inactive`   | Soft delete (nulo = ativo). Também é o histórico do link anterior.                  |
| `createdAt`   | DateTime      | `created_at` | `@default(now())`.                                                                  |
| `updatedAt`   | DateTime      | `updated_at` | `@updatedAt`.                                                                       |

**Índice**: `(kind, inactive)` — as duas colunas que toda leitura filtra: o painel separando ativo de inativo, e a checagem de unicidade procurando o concorrente do mesmo tipo.

**Quatro decisões que o modelo esconde**

1. **É catálogo, e não uma linha só com duas colunas de URL.** O dia em que entrar um manual em PDF ou um driver de impressora é uma linha nova, não uma migration de coluna — e o painel que já sabe listar não muda.
2. **Um ativo por tipo, garantido na aplicação e não no banco.** Quem escolhe o link é o front, e ele escolhe pelo `kind`: com dois instaladores ativos ele pegaria o primeiro da lista e ninguém perceberia que o botão passou a apontar para o arquivo errado. A garantia de verdade seria um `UNIQUE` parcial (`WHERE inactive IS NULL`), que o schema do Prisma não sabe expressar — criado só no SQL, ele sumiria no primeiro `prisma migrate dev` de quem alterasse a tabela, e a regra passaria a valer em produção mas não no banco de quem desenvolve. A regra mora em `src/http/core/downloads/helpers/ensure-single-active.ts`, num lugar só.
3. **Sem relação com `app_versions`, de propósito.** Aquela tabela responde "qual versão **deveria** estar rodando"; esta responde "de **onde** se baixa o arquivo". Amarrar as duas obrigaria a publicar uma versão inteira só para consertar um link quebrado.
4. **A API guarda o endereço e devolve o endereço.** Não redireciona nem repassa o binário: servir ~60 MB por download gastaria banda da API para entregar o que a origem já entrega. O efeito colateral é que não há contador de downloads — se algum dia ele for necessário, aí sim entra uma rota de redirect.

---

## 🔗 Mapa de Relacionamentos

| De                 | Para                | Cardinalidade | onDelete  |
|--------------------|---------------------|:-------------:|-----------|
| Tokens             | Employees           | N:1           | Cascade   |
| EmployeesRooms     | Employees           | N:1           | Cascade   |
| EmployeesRooms     | Rooms               | N:1           | Cascade   |
| Computers          | Rooms               | N:1           | Restrict* |
| Computers          | Lawyers (atual)     | 1:1 opcional  | SetNull   |
| ComputerSessions   | Computers           | N:1           | Restrict* |
| ComputerSessions   | Lawyers             | N:1           | Restrict* |
| Printers           | Computers           | N:1           | Cascade   |
| Printers           | Lawyers             | N:1           | Cascade   |
| Employees ⇄ Rooms  | via EmployeesRooms  | N:N           | Cascade   |
| AppVersions        | —                   | isolada       | —         |
| Downloads          | —                   | isolada       | —         |

\* *Restrict* = comportamento padrão do Prisma quando `onDelete` não é declarado.

### Diagrama (ER simplificado)

```
                         ┌──────────────┐
                         │   Employees  │
                         └──────┬───────┘
                  1:N           │           N:N (EmployeesRooms)
            ┌─────────────┐     │     ┌───────────────┐
            │   Tokens    │◀────┤     │     Rooms      │
            └─────────────┘     └────▶└───────┬───────┘
                                              │ 1:N
                                       ┌──────▼───────┐
                                       │  Computers   │
                                       └──┬────────┬──┘
                                     1:N  │        │ 1:N
                          ┌───────────────▼─┐    ┌─▼────────────┐
                          │ ComputerSessions│    │   Printers   │
                          └────────┬────────┘    └──────┬───────┘
                                   │ N:1                │ N:1
                              ┌────▼─────────────────────▼────┐
                              │           Lawyers              │
                              └────────────────────────────────┘
```

---

## 🧠 Padrões e Convenções Importantes

1. **IDs**: todos CUID (`@default(cuid())`) — strings ordenáveis e seguras para URLs.
2. **Timestamps**: `createdAt` (`now()`) e `updatedAt` (`@updatedAt`) na maioria das tabelas mutáveis.
3. **Soft delete**: `Employees.inactive` e `Rooms.inactive` (DateTime nulo = ativo). Não há delete físico nesses casos.
4. **Tempo em minutos**: `Rooms.standardTime` (default 180 = 3h) e `Lawyers.remainingTime`.
5. **Mapeamento camelCase → snake_case** via `@map`/`@@map` em todo o schema.
6. **Cascades** concentrados em registros dependentes/filhos (tokens, junção, impressões).
7. **Uso exclusivo de máquina**: `Computers.currentLawyerId @unique` impede um advogado de ocupar dois computadores ao mesmo tempo (ver nota na tabela `Computers`).


