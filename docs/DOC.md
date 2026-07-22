# 📚 Sala Livre — Documentação

> O **Sala Livre** é uma plataforma integrada de gestão de espaços tecnológicos voltada para os
> escritórios compartilhados e salas de fórum da **OAB Maranhão**.

---

## 💻 Fluxo da Aplicação

### Acesso do Advogado (App Desktop)

- O aplicativo Sala Livre já estará em execução no computador da sala.
- Na tela de login, o advogado(a) informa **CPF**, **data de nascimento** e **número da OAB**.
- O sistema valida se o advogado(a) está **adimplente** na API do **Protheus**.
- O sistema valida os dados contra a tabela `lawyers`: se já existe, segue; senão, cria um novo registro.
- Se os dados estiverem corretos:
  - O computador é liberado para uso (`released = true`).
  - O sistema registra o tempo padrão de uso da sala (`rooms.standard_time`) e pode iniciar um timer de controle de sessão.
- Durante o uso, o advogado pode navegar na internet, usar softwares da máquina ou enviar arquivos para impressão.
- Ao enviar um arquivo, o sistema cria um registro na tabela `printers`:

| Campo         | Descrição                       |
| ------------- | ------------------------------- |
| `lawyer_id`   | Identifica o advogado.          |
| `computer_id` | Identifica o computador usado.  |
| `file_url`    | Caminho para o arquivo enviado. |
| `created_at`  | Timestamp do envio.             |

### Gestão de Funcionários (Web / Frontend)

- Cada funcionário tem acesso ao painel web, autenticado como `employees` (funcionários).
- O funcionário está vinculado a uma ou mais salas via `employees_rooms`.
- No painel, ele pode:
  - Visualizar computadores da(s) sala(s) que gerencia.
  - Ver o status do computador: **liberado** (`released`) ou **em manutenção** (`maintenance`).
  - Acompanhar advogados usando os computadores em tempo real.
  - Liberar o computador para o advogado de forma manual, caso precise.
  - Ver a lista de arquivos enviados para impressão (`printers`) e baixá-los para impressão física.

### Controle de Salas e Computadores

Cada **sala** (`rooms`) possui:

- `standard_time` → tempo padrão de uso de cada advogado:
  - **180 minutos (3h)** para escritórios compartilhados.
  - **120 minutos (2h)** para salas de fórum.
- `remaining_time` → tempo restante da sessão (opcional, pode ser usado pelo desktop para exibir contador).

Cada **computador** (`computers`) possui:

- `room_id` → vínculo com a sala.
- `released` → indica se está liberado ou bloqueado.
- `maintenance` → indica se o computador está fora de operação.

> ⚠️ O sistema deve impedir que computadores em manutenção sejam liberados.

### Fluxo de Impressão

1. O advogado envia um arquivo pelo app desktop → cria registro em `printers`.
2. O funcionário da sala acessa o painel web → vê os arquivos pendentes.
3. O funcionário baixa o arquivo e realiza a impressão.
4. Opcionalmente, o status do arquivo pode ser atualizado (`downloaded_at` / `printed_at`).

> 🗑️ As impressões devem ser apagadas do servidor **um dia após** o envio.

### Administração e Relatórios

Funcionários com papel **`ADMIN`** podem:

- Cadastrar novas salas (`rooms`).
- Cadastrar ou gerenciar computadores (`computers`).
- Cadastrar e vincular funcionários a salas (`employees_rooms`).

O sistema pode gerar relatórios:

- Uso de cada sala e computador.
- Quantidade de impressões por advogado e sala.
- Tempo médio de uso por sessão.

---

## 🔑 Observações do Fluxo

- A tabela `employees_rooms` garante que cada funcionário veja apenas os computadores das salas que gerencia.
- A tabela `computers` controla a liberação física e a manutenção dos computadores.
- A tabela `printers` mantém rastreio completo de arquivos enviados para impressão, associando advogado + computador + sala indiretamente.
- A autenticação do advogado é simples, mas segura, baseada em **CPF**, **OAB** e **data de nascimento**.

---

## 🧠 Lógica de Diagramação do Banco de Dados

| Relação                            | Cardinalidade  | Descrição                                                                                                 |
| ---------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| **Funcionários ⇄ Salas**           | Many to Many   | Um funcionário pode pertencer a várias salas e uma sala pode ser acessada por um ou vários funcionários.  |
| **Salas → Computadores**           | One to Many    | Uma sala tem vários computadores; cada computador pertence a apenas uma sala.                              |
| **Advogado/Computador → Impressão** | One to Many    | Cada impressão é enviada por um advogado e feita em um computador específico.                              |

> A relação de impressão é implementada pelas chaves estrangeiras `computer_id` e `lawyer_id` na tabela `printers`.
> Um computador pode ter várias impressões associadas, e um advogado pode enviar várias impressões.

---

## 👥 Atores

- 👔 **Funcionários** (`employees`)
- 🏢 **Salas** (`rooms`)
- 🖥️ **Computadores** (`computers`)
- 🖨️ **Impressoras** (`printers`)
- ⚖️ **Advogados** (`lawyers`)

---

## ↪️ Use Cases

### 📋 RFs — Requisitos Funcionais

#### 👔 Funcionários (Employees)

- [x] Criar seed do usuário administrador master (permissão para criar funcionários e salas).
- [x] Cadastrar funcionários.
- [x] Autenticar.
- [x] Obter o perfil de um usuário logado.
- [x] Trocar de senha.
- [x] Redefinir a senha.
- [x] Enviar um e-mail para redefinir senha.
- [x] Enviar um e-mail ao funcionário quando o ADM o cadastrar.
- [x] Listar todos os funcionários cadastrados.
- [x] Inativar um funcionário.
- [x] Ativar um funcionário.
- [x] Alterar um funcionário.
- [x] Trocar a foto de perfil do funcionário logado.
- [x] Vincular um funcionário a uma ou várias salas.
- [x] Desvincular um funcionário de uma ou várias salas.
- [x] Não deve ser possível vincular um funcionário a uma sala inativa.

#### 🏢 Salas (Rooms)

- [x] Criar uma sala.
- [x] Buscar todas as salas.
- [x] Buscar salas que o membro está vinculado.
- [x] Editar uma sala.
- [x] Inativar uma sala.
- [x] Ativar uma sala.

#### 🖥️ Computadores (Computers)

- [x] Cadastrar um computador.
- [x] Editar um computador (`PATCH /computers/update/:id`; ADMIN-only, atualização parcial).
- [x] Excluir um computador (`DELETE /computers/delete/:id`; ADMIN-only, recusa se em uso, remove sessões e impressões em cascata).
- [~] Listar computadores (`GET /computers/get-all`; filtros por sala e por descrição; paginação pendente).
- [x] Colocar/retirar um computador de manutenção (`PATCH /computers/maintenance/:id` e `.../remove`; ADMIN em qualquer máquina, funcionário comum nas de suas salas).
- [ ] Liberar um computador manualmente.

#### ⚖️ Advogados (Lawyers)

- [x] Solicitar o uso do computador em uma determinada sala (`POST /lawyers/release-computer`).
- [ ] Criar cron job que verifica sessões encerradas dos advogados e libera o computador.
- [x] Cancelar a própria sessão (`POST /lawyers/close-computer/:sessionId`).
- [x] Continuar a sessão de onde parou (no mesmo dia somente).
- [~] Buscar todas as sessões (`GET /lawyers/get-all-releases/:roomId?`; ADMIN vê todas, MEMBER só das salas vinculadas; paginação pendente).

### 📐 RNs — Regras de Negócio

#### 👔 Funcionários (Employees)

- Somente administradores podem cadastrar funcionários / salas / computadores.
- O administrador não pode cadastrar funcionários com e-mail e CPF duplicados.
- O funcionário não poderá alterar a senha se a informada for igual à antiga.
- Somente administradores podem ver todos os funcionários cadastrados.
- Somente administradores podem inativar um funcionário.
- Somente administradores podem ativar um funcionário.
- Somente administradores podem alterar um funcionário.
- O funcionário não pode se autenticar se estiver inativo.
- Somente administradores podem vincular funcionários a salas.
- Não é possível vincular um funcionário a uma sala inativa nem duplicar um vínculo existente.
- Somente administradores podem criar salas.
- Somente administradores podem editar salas.
- Somente administradores podem ver todas as salas.
- Somente administradores podem inativar uma sala.
- Somente administradores podem ativar uma sala.
- Somente administradores podem cadastrar computadores.
- Somente administradores podem editar computadores.
- Somente administradores podem excluir computadores.

#### ⚖️ Advogados (Lawyers)

Validações para liberar um computador:

- O advogado existe (`Lawyers`).
- O computador existe e não está em uso (`Computers.inUse === false`).
- O advogado tem tempo restante (`Lawyers.remainingTime > 0`).
- O computador pertence a uma sala ativa (`Rooms.inactive === null`).

Demais regras:

- O advogado não pode ter duas sessões ao mesmo tempo.
- Os dados vindos da API externa não podem ser editados.
- Não é possível liberar computador de uma sala inativa.
- Não é possível liberar computador em manutenção.
- Não é possível liberar um computador que já está em uso.
- Não é possível o advogado acessar no mesmo dia se o tempo dele acabou.
- Ao cancelar a sessão, guardar o tempo restante.
- O advogado só poderá usar o tempo restante se ainda houver, no mesmo dia.
- O advogado só poderá liberar um computador se estiver adimplente.
- Somente administradores podem emitir relatórios.

### ⚙️ RNFs — Requisitos Não-Funcionais

- A senha do usuário precisa estar **criptografada**.
- Os dados da aplicação precisam estar persistidos em um banco **PostgreSQL**.
- O administrador e o usuário devem ser identificados por um **JWT**.
- Assim que o administrador cadastrar um funcionário, este receberá um **e-mail de confirmação** contendo seus dados.
- A consulta dos dados dos advogados virá de uma **API externa**.
- Todo o histórico (salas, computadores, advogados, impressões e funcionários) precisa estar **paginado**, com **10 itens por página**.
