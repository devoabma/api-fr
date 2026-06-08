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

> 💡 Sessão "aberta" = `endedAt == null`. A duração é `endedAt - startedAt`.

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


