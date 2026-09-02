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

> 📧 Cada execução envia um relatório por e-mail ao administrador (`EMAIL_ADMIN`), inclusive quando não havia nada a limpar — assim a **ausência** do e-mail na sexta já é sinal de problema. Se a API estiver fora do ar no horário agendado, o `node-cron` não recupera o disparo: o alerta sai no boot seguinte, quando a API encontra impressões anteriores à última sexta 23:59:59 ainda na fila.

### Administração e Relatórios

Funcionários com papel **`ADMIN`** podem:

- Cadastrar novas salas (`rooms`).
- Cadastrar ou gerenciar computadores (`computers`).
- Cadastrar e vincular funcionários a salas (`employees_rooms`).

O sistema pode gerar relatórios:

- Uso de cada sala e computador — por sala já sai em `GET /lawyers/releases-metrics`; por computador ainda não.
- Quantidade de impressões por advogado e sala.
- Tempo médio de uso por sessão — em `releases-metrics`, apenas sobre sessões encerradas.

> ⚠️ A tela de **Métricas** (`releases-metrics`) fica em "Operação" e é aberta a MEMBER, recortada pelas salas dele. A restrição a ADMIN acima vale para a tela de **Relatórios** da Administração, ainda por fazer.

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
- [x] Cadastrar funcionários (`POST /employees/create-account`; ADMIN-only, o `201` devolve `employeeId` para que o painel encadeie a vinculação com salas sem precisar varrer a listagem).
- [x] Autenticar.
- [x] Encerrar a sessão (logout).
- [x] Obter o perfil de um usuário logado.
- [x] Trocar de senha.
- [x] Redefinir a senha.
- [x] Enviar um e-mail para redefinir senha.
- [x] Enviar um e-mail ao funcionário quando o ADM o cadastrar.
- [x] Listar todos os funcionários cadastrados (`GET /employees/get-all`; ADMIN-only, cada funcionário traz `createdAt` e as salas vinculadas em `employeesRooms` — inclusive as inativas, distinguidas por `inactive` —, e a lista vem ordenada por data de cadastro, mais recente primeiro).
- [x] Inativar um funcionário.
- [x] Ativar um funcionário.
- [x] Alterar um funcionário.
- [x] Trocar a foto de perfil do funcionário logado.
- [x] Vincular um funcionário a uma ou várias salas.
- [x] Desvincular um funcionário de uma ou várias salas.
- [x] Não deve ser possível vincular um funcionário a uma sala inativa.

#### 🏢 Salas (Rooms)

- [x] Criar uma sala.
- [x] Buscar as salas por papel (`GET /rooms/get-all`; ADMIN vê todas inclusive inativas, MEMBER vê apenas as próprias salas ativas — a rota dedicada do membro foi removida).
  - A equipe devolvida em `employeesRooms` traz apenas funcionários **ativos**: desligar alguém é soft delete (`employees.inactive`) e o vínculo continua no banco, então a API é que filtra.
  - Cada sala devolve também `createdAt` (data de cadastro), para o cliente exibir "criada em" e reordenar localmente sem perder a informação.
- [x] Editar uma sala.
- [x] Inativar uma sala.
- [x] Ativar uma sala.

#### 🖥️ Computadores (Computers)

- [x] Cadastrar um computador.
- [x] Editar um computador (`PATCH /computers/update/:id`; ADMIN-only, atualização parcial).
- [x] Excluir um computador (`DELETE /computers/delete/:id`; ADMIN-only, recusa se em uso, remove sessões e impressões em cascata).
- [~] Listar computadores (`GET /computers/get-all`; filtros por sala e por descrição; ordenada por data de cadastro, mais recente primeiro; paginação pendente). Cada máquina traz `createdAt`, `appVersion`/`appVersionReportedAt`, `isOnline` e `updateStatus`; a resposta traz `latestVersion` no topo.
  - `isOnline` sai do mapa em memória do canal, com **uma** leitura servindo a lista inteira — a mesma fonte de `GET /computers/online/:roomId?`, e com as mesmas ressalvas (o atraso do heartbeat faz uma máquina desligada na tomada aparecer conectada por até ~60s).
  - `updateStatus` tem **três** valores: `outdated`, `up-to-date` e `unknown`. A conta é do servidor de propósito — comparar versão por texto é um erro que só aparece na décima publicação (`'1.0.10' < '1.0.9'` em ordem alfabética) e não pode ser reescrito em cada tela.
  - `unknown` cobre três situações — nunca informou a versão, informou algo ilegível (`"1.0.8-beta"`), ou a API ainda não conhece a publicada. Ele **nunca** vira `up-to-date`: confundir "não sei" com "está certo" é exatamente como uma máquina desatualizada some do radar.
  - `latestVersion` traz `version`, `notes` e `generatedAt` da publicada vigente, ou `null` enquanto nenhuma chegou. As `notes` vêm do próprio manifesto, escritas em português para o funcionário ler antes de mandar atualizar.
- [x] Mandar uma estação atualizar agora (`POST /computers/update-app/:id`; ADMIN-only, uma máquina por chamada).
  - O caminho é `/update-app/:id` e **não** `/update/:id` — este último é o `PATCH` que edita o cadastro. Duas operações sem nada em comum na mesma URL, separadas só pelo verbo, fariam um `POST` distraído mandar uma estação baixar ~60 MB.
  - Recusa com `400` a máquina **em uso** (nenhuma versão interrompe advogado(a) em atendimento) e a que já está na versão publicada. **Manutenção não bloqueia**: é o melhor momento possível para trocar o executável.
  - Responde `409` para estação fora do canal, **sem enfileirar** — a máquina desligada pega a versão sozinha na próxima partida.
  - O `200` confirma **o envio do recado, jamais a atualização**. O resultado real chega no `register` seguinte, com a versão nova.
  - Teto de 10 em 5 minutos contado **por máquina**, não por funcionário: o que satura o link da unidade é a mesma sala baixando junto, não o mesmo crachá clicando.
- [x] Colocar/retirar um computador de manutenção (`PATCH /computers/maintenance/:id` e `.../remove`; ADMIN em qualquer máquina, funcionário comum nas de suas salas).
- [x] Liberar um computador manualmente pelo painel (mesma rota `POST /lawyers/release-computer`: o funcionário informa os dados do advogado(a) e o `macCode` da máquina, e a API destrava a estação pelo evento `session_started` do WebSocket).
- [x] Saber quais estações estão conectadas (`GET /computers/online/:roomId?`; ADMIN vê todas, MEMBER só as salas vinculadas; a resposta traz **apenas** os computadores no canal `/ws/computers`, com `id`, `macCode`, `roomId` e `connectedAt` — quem não está na lista está desligado, sem rede ou com o Desktop fechado).
  - A fonte é o registro em memória do WebSocket, não o banco: não há coluna de "online". Reiniciar a API zera a lista até os Desktops reconectarem.
  - O painel usa isso para **bloquear a liberação antes de gravar a sessão**. Não substitui o `notified`: entre a consulta e o clique a estação pode cair, e aí a resposta da liberação continua sendo a última palavra.
  - O atraso do heartbeat (`ping` a cada 30s) faz uma máquina desligada na tomada aparecer como conectada por até ~60s.

#### ⚖️ Advogados (Lawyers)

- [x] Solicitar o uso do computador em uma determinada sala (`POST /lawyers/release-computer`; o `200` devolve `message`, `sessionId`, `lawyerName`, `remainingTime` em minutos, `expiresAt` em ISO 8601 UTC e `notified` — o cliente distingue liberação concedida de sessão estourada por `remainingTime`, nunca pelo texto de `message`).
  - A rota é a mesma para o quiosque e para o painel. Quem chama não muda nada no servidor: a API grava a sessão e avisa a estação pelo WebSocket (`session_started`), de modo que a liberação feita no balcão destrava a máquina da sala sozinha.
  - `notified: false` significa que a sessão foi gravada mas o Desktop daquele computador está offline — **o painel precisa mostrar isso**, porque a tela não vai destravar sem alguém ir até a máquina.
- [x] Criar cron job que verifica sessões expiradas dos advogados e libera o computador (`node-cron` in-process, verifica a cada 1min sem sobreposição).
- [x] Cancelar a própria sessão (`POST /lawyers/close-computer/:sessionId`).
- [x] Continuar a sessão de onde parou (no mesmo dia somente).
- [~] Buscar todas as sessões (`GET /lawyers/get-all-releases/:roomId?`; ADMIN vê todas, MEMBER só das salas vinculadas; cada item traz `lawyer.oab`, porque homônimos são comuns e o nome sozinho não identifica quem usou a máquina; paginação pendente).
- [x] Agregar as liberações para a tela de métricas (`GET /lawyers/releases-metrics/:roomId?year=`; devolve `kpis`, `byYear`, `byMonth`, `byRoom` e `byLawyer` **já somados no Postgres**, para o painel não baixar o histórico bruto só para desenhar um gráfico).
  - Mesmo recorte por papel de `get-all-releases`, e **não** restrita a ADMIN: a tela fica em "Operação". MEMBER que pedir uma sala à qual não pertence recebe `200` zerado, não erro.
  - `byRoom` **ignora** o `roomId` de propósito — é um ranking *entre* salas, e comparar uma sala com ela mesma não informa nada. Salas sem movimento entram com `total: 0`.
  - Ano e mês são agrupados no fuso de `TIMEZONE`, não em UTC: senão a liberação das 23h de 31/12 cairia em janeiro do ano seguinte.
  - O tempo médio só conta sessões encerradas e despreza durações acima de 24h — resto de sessão fechada tarde pelo cron após uma queda do serviço.

#### 🖨️ Impressões (Printers)

- [x] Enviar um arquivo para impressão pelo advogado com sessão ativa (`POST /printers/send-to-print/:macCode`; sem JWT, identifica a sessão pelo `macCode` do computador).
- [~] Listar as impressões enviadas (`GET /printers/get-all/:roomId?`; ADMIN vê todas, MEMBER só das salas vinculadas; paginação e filtro por status pendentes).
- [x] Criar cron job que apaga as impressões do servidor toda sexta-feira às 23:59:59 (job in-process via `node-cron`, no fuso de `TIMEZONE`; remove o arquivo do bucket `prints` antes de apagar o registro).
- [x] Enviar relatório da limpeza semanal por e-mail ao administrador (concluída, parcial ou falha), com envio não-fatal — falha de e-mail não interrompe o job.
- [x] Alertar no boot quando a janela agendada passou sem limpeza, usando a própria fila como evidência (sem tabela de controle).

#### 📦 Versão do Desktop (App)

A API não distribui o executável e **não assina nada**. Ela guarda qual versão foi publicada, para conseguir dizer quais máquinas estão atrasadas — e para o painel poder pedir que uma delas atualize.

- [x] Guardar o histórico das versões publicadas (tabela `app_versions`; uma linha por versão, a vigente é a última criada).
- [x] Receber o aviso da publicação (`POST /app/version`).
  - **Não é login de funcionário.** Autentica por `Authorization: Bearer <APP_VERSION_PUBLISH_TOKEN>`, comparado em tempo constante. Quem chama é o `publicar.ps1`, uma vez por versão.
  - Sem o token configurado na API, responde `503` e não aceita nada — o contrário seria comparar segredo vazio com segredo vazio e aceitar qualquer manifesto que batesse à porta.
  - `201` gravou; `409` chegou depois de algo mais novo (com mensagens distintas para "versão mais nova já publicada" e "publicação mais recente desta mesma versão"); `400` envelope ou assinatura inválidos; `401` token errado.
  - O corpo é o envelope assinado (`conteudo`, `algoritmo`, `chave`, `assinatura`) e vai ao banco **como texto, byte a byte**. Reserializar reordenaria chaves e reindentaria o JSON — o que quebra a assinatura sem alterar um único dado.
- [x] Espelhar o manifesto público a cada 5 minutos (`APP_MANIFEST_URL`), com `If-None-Match`.
  - É a **rede de segurança**, não a fonte: existe para o dia em que o aviso acima não chegar (script que falhou, API reiniciando, rede ruim na hora exata).
  - Uma consulta **por processo**, jamais por usuário do painel — o painel lê da tabela.
  - Falha de leitura (timeout, `5xx`, DNS oscilando) **mantém** a versão conhecida. Apagá-la faria o painel anunciar o parque inteiro em dia, e ninguém atualizaria nada naquele dia.
- [x] Conferir a assinatura do manifesto na entrada, quando `APP_MANIFEST_PUBLIC_KEY` estiver configurada.
  - **É rede, não muralha.** Quem protege o parque é cada estação, que valida o mesmo envelope com a chave embutida no próprio executável antes de instalar. A conferência aqui cobre dois casos que a estação cobriria tarde demais: alguém de posse do token empurrando lixo pela rota, e arquivo corrompido em trânsito virando "versão publicada" no painel.
  - A chave é **pública** e não é segredo: ela já viaja dentro de todo executável instalado no parque. A privada nunca chega perto da API.
- [ ] `GET /app/version` — servir o envelope às estações direto da API (fase 2). O banco já guarda o manifesto preparado para isso.

**A guarda que parece paranoia e não é.** O arquivo público tem `Cache-Control: max-age=300`. Publica-se a 1.0.9, o `POST` avisa e a API já sabe; minutos depois o espelho pergunta à CDN, que **ainda entrega a 1.0.8 do cache**. Sem guarda, o espelho rebaixaria a versão publicada: o painel voltaria a dizer que o parque está em dia, o botão de atualizar sumiria de todas as máquinas, e cinco minutos depois tudo se consertaria sozinho — um bug que aparece e some sozinho é um bug que ninguém consegue reproduzir para reportar. Por isso a ordem **nunca** é por quem escreveu por último: é por número de versão e, no empate, pelo `geradoEm` de dentro do conteúdo assinado (a onda sobe republicando o **mesmo** número, e conter uma versão ruim é republicar com percentual **menor** — comparar percentual quebraria justamente esse freio de mão).

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
- Sair da conta é uma chamada à API (`POST /employees/session/logout`), não uma limpeza no front: o cookie de sessão é `httpOnly` e o JavaScript não consegue apagá-lo. O logout não exige sessão válida — o caso mais comum de clicar em "sair" é a sessão já ter expirado, e recusar com `401` deixaria no navegador justamente o cookie que se queria remover.
- O logout encerra a sessão do navegador, mas o JWT continua válido até vencer (1 dia). Não existe lista de revogação: derrubar um token específico exigiria consultar armazenamento a cada requisição autenticada.
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
  | `GET /ready` | 60 | 1 min | IP |
  | `POST /employees/session/auth` | 5 | 10 min | IP + CPF |
  | `POST /employees/password-recovery` | 5 | 15 min | IP |
  | `POST /employees/reset-password` | 10 | 10 min | IP |
  | `POST /lawyers/release-computer` | 10 | 1 min | IP + macCode |
  | `POST /lawyers/close-computer/:sessionId` | 30 | 1 min | IP |
  | `POST /printers/send-to-print/:macCode` | 15 | 5 min | IP + macCode |

  Ao estourar o teto, a API responde `429` com `{ message, retryAfterInSeconds }` e os headers `retry-after` / `x-ratelimit-*`. **O app desktop e o front devem tratar o `429` lendo `retryAfterInSeconds`** e aguardar esse tempo, em vez de retentar em laço. `/health` e `/docs` são isentos — `/ready` **não é**, porque encosta no banco (ver o RNF de sondas de saúde abaixo).

  > A contagem só funciona por cliente se `TRUST_PROXY` estiver correto em produção — ver [`docs/DEPLOY.md`](./DEPLOY.md).

- A API expõe **duas sondas de saúde**, que respondem a perguntas diferentes e têm consumidores diferentes. Confundir as duas é o erro clássico aqui:

  | Rota | Pergunta | Quem consome | Toca no banco |
  | --- | --- | --- | --- |
  | `GET /health` | **vivacidade** — o processo está atendendo? | `HEALTHCHECK` do container | não |
  | `GET /ready` | **prontidão** — dá para atender de verdade? | selo do painel web | sim (`SELECT 1`) |

  `/health` responde `200 {"status":"ok"}` e **de propósito não toca em nada**. `/ready` sonda o banco e responde `200 {"status":"ok","database":"up"}` ou `503 {"status":"error","database":"down"}` — este último também quando a sonda passa de 3s, teto menor de propósito que os 15s que o pool espera por conexão nova (calibrados para o cold start do Neon): numa sonda, a espera longa chegaria justamente quando o banco está mal, e quem perguntou desistiria antes por timeout, recebendo erro de rede genérico no lugar do `503` legível.

  **O `HEALTHCHECK` do container não pode migrar para `/ready`.** Para o orquestrador, "não saudável" significa uma coisa só: reiniciar o container. Reiniciar a API não conserta banco fora do ar — só derruba o WebSocket dos Desktops de todas as salas e, se a queda durar, vira laço de reinício.

  **O que o front web precisa fazer**: o selo do painel pergunta em `/ready`, nunca em `/health`, e precisa distinguir três estados, não dois — `200` (tudo no ar), `503` (**API no ar, banco fora**) e falha de rede (API fora). Mostrar a mesma mensagem para o `503` e para a falha de rede joga fora exatamente a informação que a rota existe para dar: no primeiro caso o problema é o banco e a API não deve ser reiniciada; no segundo, o problema é a API.

  Ambas são públicas, sem auth, e nenhuma das duas aparece no `/docs` — o `@fastify/swagger` descobre rotas por hook, e só enxerga as que são registradas depois dele. Estão documentadas aqui e em [`docs/DEPLOY.md`](./DEPLOY.md), em prosa, de propósito.

- A API aceita chamadas de navegador de **uma única origem**: a definida em `WEB_URL`. A resposta traz `Access-Control-Allow-Credentials: true`, porque a autenticação do painel é por **cookie `httpOnly`** e o navegador só grava e reenvia esse cookie entre origens diferentes quando a API nomeia a origem explicitamente — o coringa `*` é proibido pela especificação quando há credenciais.

  **O que o front web precisa fazer**: enviar as requisições com credenciais — `credentials: 'include'` no `fetch`, `withCredentials: true` no axios. Sem isso o cookie não acompanha a chamada e a API responde `401`, mesmo com o login tendo funcionado. É o sintoma mais provável de um front que "loga e cai".

  **O app desktop não é afetado.** CORS é uma regra que o *navegador* aplica antes de entregar a resposta à página; cliente que não manda o header `Origin` — desktop, Insomnia, `curl`, healthcheck do contêiner — nem é avaliado. Pelo mesmo motivo, **CORS não é controle de acesso**: quem protege a API continua sendo a autenticação, a autorização por papel e o rate limit. O canal WebSocket também fica de fora.

  **Métodos liberados no preflight**: `GET`, `HEAD`, `POST`, `PUT`, `PATCH` e `DELETE`. A lista é declarada explicitamente porque o default do `@fastify/cors` são apenas os métodos safelisted (`GET`, `HEAD`, `POST`) — sem ela, toda rota de escrita do painel (editar funcionário, manutenção de computador, exclusão) era barrada pelo navegador **antes de sair**. O sintoma engana: o preflight responde `204` normalmente, o front recebe um erro de rede sem corpo e a API não registra nada, porque a requisição real nunca chegou.

  `WEB_URL` precisa ser a origem exata (esquema + host + porta), **sem barra no fim** — o header `Origin` nunca tem uma, e a comparação é byte a byte. A API corta barras finais sozinha e recusa subir com URL sem esquema, justamente porque a falha seria silenciosa: o bloqueio acontece no navegador e nada aparece no log.

- **Os links dos e-mails apontam para rotas do front, não da API.** A API concatena `WEB_URL` com caminhos que só existem no `web-fr`:

  | E-mail | Link |
  | --- | --- |
  | Cadastro de funcionário (inclui o admin do seed) | `${WEB_URL}/auth/sign-in` |
  | Recuperação de senha | `${WEB_URL}/auth/reset-password?code=<code>` |
  | Confirmação de troca de senha | `${WEB_URL}` (raiz — o front decide entre painel e login) |

  **Renomear qualquer uma dessas rotas no front quebra o e-mail em silêncio**: a API responde com sucesso, o Resend entrega e nada aparece no log — só quem clica descobre, num 404. Dói mais em quem acabou de ser cadastrado (não tem senha para tentar outro caminho) e em quem pediu recuperação (o código expira em 5 min enquanto a pessoa tenta entender). O app desktop não é afetado: lá o funcionário digita o código, sem passar pelo link.

- **Requisição sem corpo é válida.** Axios e `fetch` mandam `Content-Type: application/json` mesmo quando não há corpo (`axios.post(url)` sem segundo argumento). A API usa parser próprio: corpo vazio chega às rotas como `{}` e quem decide se falta algo é o schema Zod da rota. Corpo que não é JSON válido continua respondendo `400`.

  Isso importa além do logout, porque o corpo é lido **antes do roteamento**: com o parser padrão, uma URL errada respondia reclamando do corpo em vez de `404`, e em rota com campos obrigatórios o Zod nem chegava a rodar — o front não recebia a lista de campos faltando.

- **A API não responde `500` para erro do cliente.** Falhas que nascem no próprio framework — corpo acima do limite (`413`), tipo de conteúdo não suportado (`415`) — respondem o status correto com mensagem em pt-BR. Front e desktop podem tratar `5xx` como "problema na API, vale retentar" e `4xx` como "a requisição precisa mudar".

- A API mantém um **canal WebSocket permanente** com os Desktops das salas, na mesma aplicação e na mesma porta: `ws://<host>:<porta>/ws/computers`. É por ele que os eventos que nascem fora da máquina (sessão encerrada pelo cron, computador colocado em manutenção, sala inativada) vão chegar ao Desktop, sem polling.

  **O que o Desktop precisa fazer hoje** (identificação + o evento de encerramento de sessão):

  1. Conectar assim que o aplicativo iniciar — a conexão é permanente, não se abre só na liberação.
  2. Enviar, logo após conectar, a identificação (prazo de **10 segundos**, senão a API encerra com `4408`):

     ```json
     { "type": "register", "macCode": "AA-BB-CC-DD-EE-01", "version": "1.0.1" }
     ```

     O `version` (versão do Desktop instalado) é **opcional** e a API o **guarda no cadastro da máquina** (`computers.appVersion` + `computers.appVersionReportedAt`), além de escrevê-lo no log. É o que permite o painel responder em que versão está cada sala e se a publicação de ontem chegou onde deveria — inclusive para máquina desligada, que fica com o que informou da última vez que esteve no ar. Campos extras que a API não conhece são ignorados, nunca recusados — o canal não cai por causa deles.

     Quatro regras do campo, todas com consequência do lado do servidor:

     | Regra | O que a API faz |
     | --- | --- |
     | Só vai no `register`, nunca periodicamente | Guarda "última versão informada" com o carimbo de quando. Ausência de mensagem **não** significa máquina sumida — quem responde isso é `GET /computers/online/:roomId?` |
     | A versão pode **diminuir** (rollback do cliente após três falhas) | Grava o que chegou, sem comparar com o valor anterior. Nada de "só para frente" |
     | O campo pode **sair fora do JSON** (interruptor local desligado) | Preserva o último valor conhecido e não mexe no carimbo. Ausência não é erro nem apagamento |
     | É **texto** (`"1.0.7"`, sem o `V` da tela) | Coluna `VARCHAR(40)`, saneada para `[\w.+-]`. Sobrou string vazia, vale como não informada |

  3. Aguardar a confirmação da API, que **já traz o rótulo da estação**:

     ```json
     {
       "type": "registered",
       "macCode": "AA-BB-CC-DD-EE-01",
       "connectedAt": "2026-08-09T18:00:00.000Z",
       "roomName": "Sala Fórum",
       "number": 10,
       "uf": "MA"
     }
     ```

     | Campo | Para que serve |
     | --- | --- |
     | `roomName` | Nome da sala a que o computador pertence, direto do cadastro |
     | `number` | Número do computador dentro da sala |
     | `uf` | Sigla do estado da sala, sempre em maiúsculas — sai de `rooms.uf` |

     **O Desktop deve exibir o que vier daqui**, em vez do que estiver no arquivo local: quem sabe onde a máquina está é o servidor. Assim a instalação de um quiosque novo não exige saber a sala nem o estado (basta cadastrar o computador no painel), e um remanejamento feito no painel aparece sozinho na tela, na conexão seguinte.

     A `uf` tem um uso a mais que os outros dois: é o que permite publicar versão do Desktop dirigida a um estado. Por isso o Desktop **grava a UF em disco** (diferente do rótulo da sala, que pode viver só em memória) — a decisão de atualizar é tomada no arranque, antes de o canal conectar, então a UF recebida vale a partir da execução seguinte. Máquina recém-instalada que nunca conectou não tem UF e não casa com publicação por estado; ela segue recebendo as ondas por percentual e passa a casar depois do primeiro registro.

     Os três campos **podem não vir** — MAC ainda não cadastrado ou indisponibilidade do banco no instante do registro. Nesse caso o registro acontece normalmente e o Desktop cai na configuração local. Eles vêm **sempre juntos**: como `rooms.uf` é obrigatório no banco, não existe resposta com sala e sem estado. A chave ausente nunca é substituída por `""`.

  4. Tratar o erro, que **não fecha a conexão** — corrigir a mensagem e reenviar:

     ```json
     { "type": "error", "code": "invalid_mac_code", "message": "Mac Code inválido. Padrão de 17 caracteres." }
     ```

     Códigos possíveis: `invalid_payload`, `unknown_message_type`, `invalid_mac_code`, `already_registered`, `internal_error`.

  5. Tratar o evento **`session_started`** — alguém liberou esta máquina e a sessão precisa abrir:

     ```json
     {
       "type": "session_started",
       "macCode": "AA-BB-CC-DD-EE-01",
       "sessionId": "clx8f2k9c0000abcd1234efgh",
       "lawyerName": "FULANO DE TAL",
       "startedAt": "2026-08-13T13:02:00.000Z",
       "expiresAt": "2026-08-13T15:02:00.000Z",
       "remainingTime": 120
     }
     ```

     | Campo | Para que serve |
     | --- | --- |
     | `macCode` | destinatário pretendido, normalizado. **Confira contra o MAC desta máquina antes de agir**, pela mesma razão do `session_closed` |
     | `sessionId` | identidade da sessão. **Se for igual à sessão já aberta na tela, ignore** — é o eco da liberação que o próprio Desktop pediu |
     | `lawyerName` | nome para a tela de boas-vindas. É o único dado do advogado(a) que trafega pelo canal |
     | `startedAt` / `expiresAt` | início e fim da sessão, em UTC. **Desenhe a contagem a partir do `expiresAt`**, não somando minutos no relógio local |
     | `remainingTime` | cota concedida a esta sessão, em minutos |

     Ao receber: destravar a máquina e abrir a tela de sessão, exatamente como quando o advogado(a) digita os dados no próprio quiosque. **Não chamar `release-computer`** — a sessão já está gravada; o servidor está informando, não perguntando.

     - **É este evento que faz a liberação pelo painel funcionar.** O funcionário preenche CPF, OAB e nascimento no balcão e escolhe o computador; sem tratar `session_started`, a máquina ficaria `inUse` no banco e trancada na tela.
     - **O eco vale aqui também.** Quando é o próprio Desktop que chama `release-computer`, o evento chega — muitas vezes antes da resposta HTTP. Abrir uma sessão já aberta não pode reiniciar a contagem nem duplicar tela: compare o `sessionId` e ignore.
     - **Estação offline não recebe nada.** Se o Desktop estava fora do ar durante a liberação, ele não abre a sessão sozinha ao voltar — o `register` ainda não devolve o estado atual (ver o roadmap). O painel enxerga esse caso pelo `notified: false` na resposta HTTP.

  6. Tratar o evento **`session_closed`** — a sessão daquela máquina acabou e a tela precisa sair:

     ```json
     {
       "type": "session_closed",
       "macCode": "AA-BB-CC-DD-EE-01",
       "sessionId": "clx8f2k9c0000abcd1234efgh",
       "reason": "manual",
       "closedAt": "2026-08-12T18:32:10.114Z",
       "remainingTime": 95
     }
     ```

     | Campo | Para que serve |
     | --- | --- |
     | `macCode` | destinatário pretendido, normalizado. **Confira contra o MAC desta máquina antes de agir** — a mensagem já chega pelo socket certo, mas conferir impede que um engano de roteamento no servidor derrube a sessão de quem está sentado na máquina |
     | `sessionId` | **compare com a sessão aberta localmente e ignore se não bater.** É o que impede um evento atrasado (estação estava offline) de encerrar a sessão do advogado seguinte |
     | `reason` | `manual` = alguém encerrou pela rota `close-computer` (painel ou o próprio Desktop); `expired` = a cota do dia acabou (o cron `auto-close-sessions`, ou uma tentativa de liberação em cima de uma sessão que já estourou o tempo). Muda só o texto na tela, não a ação |
     | `closedAt` | instante gravado no banco, UTC |
     | `remainingTime` | saldo do dia depois deste encerramento, em minutos |

     Ao receber (e passar nas duas conferências acima): fechar a tela de sessão, devolver a máquina à trava e mostrar o motivo. **Não chamar `close-computer`** — o servidor está informando o que já gravou, não perguntando.

     Três armadilhas que valem mais que o resto desta seção:

     - **O evento volta como eco do próprio Desktop.** Quando o advogado clica em "Encerrar", o Desktop chama `POST /lawyers/close-computer/:sessionId` e o mesmo `session_closed` chega de volta pelo canal — muitas vezes **antes** da resposta HTTP, porque o socket já está aberto e a resposta ainda está no caminho. Marque no estado local que há um encerramento em curso e, quando o evento bater com esse `sessionId`, feche em silêncio, sem o aviso de "encerrado pela administração".
     - **Toda a saída tem de ser idempotente.** O eco acima e a resposta HTTP vão executá-la duas vezes. Fechar uma janela já fechada não pode lançar.
     - **Entrega não é garantida.** Estação offline não recebe nada, e o `register` ainda não devolve o estado atual. A rede de segurança é o próprio relógio do Desktop: quando ele zera, o `close-computer` responde `400` dizendo que a sessão já foi encerrada — trate esse `400` como sucesso e volte para a tela de identificação.

  7. Tratar o evento **`update_now`** — o servidor está pedindo que a estação consulte o manifesto **agora**, em vez de esperar o intervalo dela:

     ```json
     {
       "type": "update_now",
       "macCode": "AA-BB-CC-DD-EE-01",
       "version": "1.0.9"
     }
     ```

     | Campo | Para que serve |
     | --- | --- |
     | `macCode` | destinatário pretendido, normalizado. **Obrigatório**, e a estação descarta o que não for dela — mesma disciplina do `session_closed`. Pedido sem `macCode` não significa "para todas": significa descartado |
     | `version` | versão que o servidor esperava encontrar. **Informativa**: a estação não instala nada por causa dela, só anota no diário. Ausente quando a API ainda não sabe qual é a publicada, e o pedido continua válido |

     **O que esta mensagem deliberadamente não tem: URL, hash e tamanho de arquivo.** Ela não é capaz de apontar um executável para a máquina baixar. O que a estação instala vem exclusivamente do manifesto assinado que ela mesma vai buscar e conferir com a chave embutida no próprio executável — é isso que garante que uma invasão do servidor **não** vire um programa arbitrário instalado em todas as salas.

     "Atualizar agora" quer dizer **antecipar**, nunca atropelar: numa máquina ocupada, o pacote fica pronto e espera o advogado(a) sair. A API já recusa o pedido com `400` quando a máquina está em uso, mas a última palavra é da estação. Nenhuma versão interrompe sessão aberta, nem quando a atualização é obrigatória.

     **Não existe confirmação de volta.** Quem aplica a atualização reinicia, então a prova de que deu certo é o `register` seguinte chegando com a versão nova — e ela pode demorar minutos.

  8. Reconectar conforme o **close code**, e não sempre da mesma forma:

     | Código | Significado | O que o Desktop faz |
     | --- | --- | --- |
     | `4408` | não se identificou a tempo | corrigir o cliente — reconectar não resolve |
     | `4409` | outra conexão assumiu este `macCode` | **não** reconectar em laço; esta instância foi substituída |
     | `4401` | reservado para autenticação da estação | reconectar só depois de obter credencial válida |
     | `4503` | API reiniciando | reconectar com backoff |
     | demais | queda de rede | reconectar com backoff |

  Observações que evitam retrabalho: o `macCode` é normalizado pela API para `AA-BB-CC-DD-EE-01` (maiúsculas, 17 caracteres) — enviar com ou sem hífen dá no mesmo, mas o valor precisa ser o mesmo MAC cadastrado em `computers`. Toda mensagem é um JSON com o campo `type`, e frames maiores que 4KB são recusados. A API envia `ping` de controle a cada 30s: a pilha WebSocket do .NET responde sozinha, nada a implementar — mas uma estação que parar de responder é considerada offline e removida.

  > ⚠️ **O canal ainda não é autenticado.** O `macCode` é uma afirmação do cliente: qualquer processo que alcance a porta se declara qualquer computador, e CORS não protege WebSocket. Enquanto a credencial de estação não existir, nada sensível trafega por aqui.
