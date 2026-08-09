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

> 🗑️ As impressões são apagadas do servidor **toda sexta-feira às 23:59:59** (fuso de `TIMEZONE`), por job agendado: o arquivo sai do bucket `prints` e o registro sai da tabela `printers`.

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

- [x] Solicitar o uso do computador em uma determinada sala (`POST /lawyers/release-computer`; o `200` devolve `message`, `sessionId`, `lawyerName`, `remainingTime` em minutos e `expiresAt` em ISO 8601 UTC — o cliente distingue liberação concedida de sessão estourada por `remainingTime`, nunca pelo texto de `message`).
- [x] Criar cron job que verifica sessões expiradas dos advogados e libera o computador (`node-cron` in-process, verifica a cada 1min sem sobreposição).
- [x] Cancelar a própria sessão (`POST /lawyers/close-computer/:sessionId`).
- [x] Continuar a sessão de onde parou (no mesmo dia somente).
- [~] Buscar todas as sessões (`GET /lawyers/get-all-releases/:roomId?`; ADMIN vê todas, MEMBER só das salas vinculadas; paginação pendente).

#### 🖨️ Impressões (Printers)

- [x] Enviar um arquivo para impressão pelo advogado com sessão ativa (`POST /printers/send-to-print/:macCode`; sem JWT, identifica a sessão pelo `macCode` do computador).
- [~] Listar as impressões enviadas (`GET /printers/get-all/:roomId?`; ADMIN vê todas, MEMBER só das salas vinculadas; paginação e filtro por status pendentes).
- [x] Criar cron job que apaga as impressões do servidor toda sexta-feira às 23:59:59 (job in-process via `node-cron`, no fuso de `TIMEZONE`; remove o arquivo do bucket `prints` antes de apagar o registro).

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
- O advogado só poderá liberar um computador se estiver adimplente, salvo quando a OAB determinar liberação geral (`ALLOW_DEFAULTING_LAWYERS="true"` no ambiente).
- Somente administradores podem emitir relatórios.

### ⚙️ RNFs — Requisitos Não-Funcionais

- A senha do usuário precisa estar **criptografada**.
- Os dados da aplicação precisam estar persistidos em um banco **PostgreSQL**.
- O administrador e o usuário devem ser identificados por um **JWT**.
- Assim que o administrador cadastrar um funcionário, este receberá um **e-mail de confirmação** contendo seus dados.
- A consulta dos dados dos advogados virá de uma **API externa**.
- Todo o histórico (salas, computadores, advogados, impressões e funcionários) precisa estar **paginado**, com **10 itens por página**.
- As rotas públicas precisam ter **limite de requisições** (rate limit) por IP, para que ninguém consiga forçar senha, disparar e-mails em massa, sobrecarregar a API do Protheus ou encher o storage de arquivos:

  | Rota | Teto | Janela | Conta por |
  | --- | --- | --- | --- |
  | Qualquer rota (teto global) | 300 | 1 min | IP |
  | Rota inexistente | 60 | 1 min | IP |
  | `POST /employees/session/auth` | 5 | 10 min | IP + CPF |
  | `POST /employees/password-recovery` | 5 | 15 min | IP |
  | `POST /employees/reset-password` | 10 | 10 min | IP |
  | `POST /lawyers/release-computer` | 10 | 1 min | IP + macCode |
  | `POST /lawyers/close-computer/:sessionId` | 30 | 1 min | IP |
  | `POST /printers/send-to-print/:macCode` | 15 | 5 min | IP + macCode |

  Ao estourar o teto, a API responde `429` com `{ message, retryAfterInSeconds }` e os headers `retry-after` / `x-ratelimit-*`. **O app desktop e o front devem tratar o `429` lendo `retryAfterInSeconds`** e aguardar esse tempo, em vez de retentar em laço. `/health` e `/docs` são isentos.

  > A contagem só funciona por cliente se `TRUST_PROXY` estiver correto em produção — ver [`docs/DEPLOY.md`](./DEPLOY.md).

- A API mantém um **canal WebSocket permanente** com os Desktops das salas, na mesma aplicação e na mesma porta: `ws://<host>:<porta>/ws/computers`. É por ele que os eventos que nascem fora da máquina (sessão encerrada pelo cron, computador colocado em manutenção, sala inativada) vão chegar ao Desktop, sem polling.

  **O que o Desktop precisa fazer hoje** (só a identificação existe; nenhum evento de negócio trafega ainda):

  1. Conectar assim que o aplicativo iniciar — a conexão é permanente, não se abre só na liberação.
  2. Enviar, logo após conectar, a identificação (prazo de **10 segundos**, senão a API encerra com `4408`):

     ```json
     { "type": "register", "macCode": "AA-BB-CC-DD-EE-01" }
     ```

  3. Aguardar a confirmação da API:

     ```json
     { "type": "registered", "macCode": "AA-BB-CC-DD-EE-01", "connectedAt": "2026-08-09T18:00:00.000Z" }
     ```

  4. Tratar o erro, que **não fecha a conexão** — corrigir a mensagem e reenviar:

     ```json
     { "type": "error", "code": "invalid_mac_code", "message": "Mac Code inválido. Padrão de 17 caracteres." }
     ```

     Códigos possíveis: `invalid_payload`, `unknown_message_type`, `invalid_mac_code`, `already_registered`, `internal_error`.

  5. Reconectar conforme o **close code**, e não sempre da mesma forma:

     | Código | Significado | O que o Desktop faz |
     | --- | --- | --- |
     | `4408` | não se identificou a tempo | corrigir o cliente — reconectar não resolve |
     | `4409` | outra conexão assumiu este `macCode` | **não** reconectar em laço; esta instância foi substituída |
     | `4401` | reservado para autenticação da estação | reconectar só depois de obter credencial válida |
     | `4503` | API reiniciando | reconectar com backoff |
     | demais | queda de rede | reconectar com backoff |

  Observações que evitam retrabalho: o `macCode` é normalizado pela API para `AA-BB-CC-DD-EE-01` (maiúsculas, 17 caracteres) — enviar com ou sem hífen dá no mesmo, mas o valor precisa ser o mesmo MAC cadastrado em `computers`. Toda mensagem é um JSON com o campo `type`, e frames maiores que 4KB são recusados. A API envia `ping` de controle a cada 30s: a pilha WebSocket do .NET responde sozinha, nada a implementar — mas uma estação que parar de responder é considerada offline e removida.

  > ⚠️ **O canal ainda não é autenticado.** O `macCode` é uma afirmação do cliente: qualquer processo que alcance a porta se declara qualquer computador, e CORS não protege WebSocket. Enquanto a credencial de estação não existir, nada sensível trafega por aqui.
