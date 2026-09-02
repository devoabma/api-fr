# Sala Livre API — Roadmap de Construção

> Rastreio incremental de tudo que vamos construir, derivado de [`docs/DOC.md`](./DOC.md).
> Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído.
> Convenção de código: cada caso de uso é um arquivo em `src/http/core/<entidade>/<ação>.ts`, registrado em `src/http/routes/index.ts`.

---

## 0. Infraestrutura / Fundação

- [x] Plugin Prisma Client (singleton com adapter-pg) acessível nas rotas
- [x] Tratamento global de erros (errorHandler) + classes de erro de domínio (inclui rede de segurança para os 4xx do próprio Fastify — corpo grande demais, mídia não suportada: respondem o status certo com mensagem traduzida em vez de virarem `500` e ruído no log)
- [x] Parser próprio de `application/json` (`app.ts` — corpo vazio vira `{}` porque axios/fetch mandam o header mesmo sem corpo; o parser padrão recusava isso **antes do roteamento** e mascarava tanto o `404` de URL errada quanto a lista de campos faltando do Zod. JSON malformado continua `400`)
- [x] Hash de senha (bcrypt/argon2) — RNF: senha criptografada
- [x] Autenticação JWT (`@fastify/jwt`) + middleware/decorator `request.getIdCurrentEmployee()`
- [x] Middleware de autorização por papel (ADMIN vs MEMBER) — `request.checkIfEmployeeIsAdmin()`
- [ ] Paginação reutilizável (10 itens por página) — RNF
- [x] Envio de e-mail (confirmação de cadastro, solicitação de reset e confirmação de troca de senha)
- [x] Upload de imagem de perfil (Supabase Storage — `imageUrl` / `imagePublicId`)
- [x] Integração com API externa (Protheus) — validação de adimplência do advogado (`src/lib/axios.ts` — client `API_PROTHEUS_DATA`)
- [x] Documentação Swagger/OpenAPI (`@fastify/swagger`)
- [x] Handler para rota inexistente (`app.setNotFoundHandler` — `404` com `{ message, route }`; com teto próprio de 60 req/min por IP, já que o limitador do plugin só cobre rotas registradas)
- [x] Rate limit por IP (`@fastify/rate-limit` — política em `src/http/rate-limit.ts`: teto global de 300 req/min, tetos apertados nas rotas públicas caras (login, recuperação/reset de senha, liberação de computador, impressão), `429` com `{ message, retryAfterInSeconds }`; `/health` e `/docs` isentos; IP real do cliente via `TRUST_PROXY`)
- [x] Sondas de saúde separadas (`app.ts` — `GET /health` responde **vivacidade** e de propósito não toca em nada, porque quem o lê é o `HEALTHCHECK` do container e "não saudável" ali significa *reiniciar*, o que não conserta banco fora do ar e ainda derruba o WebSocket de todas as salas; `GET /ready` responde **prontidão**, sondando o banco com `SELECT 1` e devolvendo `503 { database: 'down' }` — é o que o selo do painel lê. Teto de 3s na sonda, menor que os 15s que o pool espera por conexão (a espera longa chegaria justo quando o banco está mal, e o cliente desistiria antes). Registrada dentro do `.after()` do rate limit, porque rota de nível de raiz nunca é vista pelo hook `onRoute` do plugin e ficaria sem teto — medido: primeiro `429` na 61ª chamada)
- [x] Política de CORS (`@fastify/cors` — origem única vinda de `WEB_URL` + `credentials: true`, exigência do navegador para o cookie `httpOnly` de sessão funcionar entre origens; `WEB_URL` validada como URL e sem barra final, porque a comparação com o header `Origin` é byte a byte; `methods` explícito com `GET, HEAD, POST, PUT, PATCH, DELETE`, já que o default do plugin são só os safelisted e o painel deixaria de fazer qualquer escrita. Não vale para cliente fora do navegador: desktop, Insomnia e `curl` não passam por CORS)
- [x] Seed do usuário ADMIN master (`prisma/seed.ts` — cria o ADMIN a partir do `.env` quando ausente e envia e-mail de confirmação; idempotente via guard; rodar via `pnpm db:deploy` no release do deploy)
- [x] Build de produção (`tsup.config.ts` — compila `src` para `build/` em ESM; `pnpm build` + `pnpm start` executam o artefato sem depender de `tsx`)
- [x] Deploy em produção (Coolify + Nginx Proxy Manager em `api-fr.oabma.org.br` — runbook completo em [`docs/DEPLOY.md`](./DEPLOY.md))
- [~] WebSocket com os Desktops das salas (`src/http/websocket/` — `@fastify/websocket` na mesma app e mesma porta, endpoint `ws://<host>:<porta>/ws/computers`)
  - [x] Infraestrutura: registro por `{ "type": "register", "macCode": "..." }`, mapa em memória `macCode → socket` (`connections.ts`), protocolo tipado por `type` com Zod (`protocol.ts`), heartbeat de ping/pong a cada 30s, limpeza na desconexão e no shutdown
  - [x] Rótulo da estação no `registered` (`roomName` e `number` do cadastro — o instalador não precisa mais saber a sala, e remanejar um computador no painel chega à tela na reconexão; ausentes quando o MAC não está cadastrado, e aí o Desktop cai na configuração local)
  - [x] UF da estação no `registered` (`rooms.uf` — a sala passou a guardar o estado, e o Desktop grava a sigla em disco: é o que permite publicar versão dirigida a um estado. Vem junto do rótulo, nunca sozinha nem como string vazia)
  - [x] Versão do Desktop guardada por estação (`computers.appVersion` + `computers.appVersionReportedAt` — o `register` já trazia o campo e ele só ia para o log; agora o painel responde em que versão está cada sala e se a publicação chegou, inclusive para máquina desligada. Gravação crua, porque o cliente faz rollback e a versão pode legitimamente diminuir; campo ausente preserva o valor guardado, porque há interruptor local de envio; o carimbo é de **quando informou**, não de quando esteve online — a versão só viaja na conexão)
  - [ ] Autenticação da estação (TOFU: token opaco no header `Authorization`, hoje o `macCode` é só uma afirmação do cliente — gancho pronto em `websocket/authorization.ts`)
  - [~] Eventos de negócio
    - [x] `session_closed` (`websocket/notifications.ts` — disparado por `close-session.ts` com `reason: manual` e pelo cron `auto-close-sessions` com `reason: expired`; leva `macCode` e `sessionId` para o Desktop conferir antes de fechar a tela)
    - [x] `session_started` (`websocket/notifications.ts` — disparado por `release-computer.ts` depois de gravar a sessão; é o que faz a liberação pelo painel destravar a máquina da sala, e o `notified` da resposta HTTP diz se a estação estava conectada)
    - [x] `update_now` (`websocket/notifications.ts` — disparado por `POST /computers/update-app/:id`; a **primeira** mensagem do canal que pede uma ação em vez de avisar de um fato consumado. É um toque no ombro: não carrega URL, hash nem tamanho, então servidor comprometido não consegue apontar um executável para a estação baixar — o que ela instala vem do manifesto assinado que ela mesma busca e confere. Aqui o retorno do envio **importa**, porque nada foi gravado antes: `false` é "estação desconectada" para mostrar ao funcionário)
  - [x] Estações conectadas em HTTP (`GET /computers/online/:roomId?` — o registro em memória ganhou porta de saída, e o painel passa a barrar a liberação em máquina muda **antes** de gravar a sessão, em vez de descobrir pelo `notified`)
  - [ ] Snapshot no `register` (hoje quem estava offline não fica sabendo do que perdeu — a rede de segurança é o relógio do próprio Desktop)

---

## 1. Funcionários (Employees)

### Casos de uso (RF)
- [x] Criar funcionário (`create-account.ts` — `POST /employees/create-account`; ADMIN-only, o `201` devolve `employeeId` além da mensagem, para encadear `link-with-rooms` logo após o cadastro)
- [x] Autenticar (login) (`authenticate.ts`)
- [x] Encerrar sessão (logout) (`logout.ts` — `POST /employees/session/logout`; apaga o cookie `httpOnly` repetindo os mesmos atributos da gravação, sem exigir autenticação para que a sessão expirada também consiga sair. O JWT segue válido até vencer — não há lista de revogação)
- [x] Obter perfil do usuário logado (`get-profile.ts` — `GET /employees/profile`)
- [x] Trocar de senha (`change-password.ts` — `PATCH /employees/change-password`)
- [x] Redefinir senha (`reset-password.ts` — `POST /employees/reset-password`)
- [x] Enviar e-mail para redefinir senha (`request-password-recovery.ts` — `POST /employees/password-recovery`)
- [x] Enviar e-mail ao funcionário quando o ADM o cadastrar
- [x] Links dos e-mails apontando para as rotas reais do front (`/auth/sign-in` e `/auth/reset-password?code=...`, também no `prisma/seed.ts`. São caminhos de outro repositório: se o `web-fr` renomear, o e-mail quebra em silêncio — a API responde com sucesso e o 404 só aparece para quem clica)
- [~] Listar todos os funcionários (`get-all.ts` — `GET /employees/get-all`; devolve `createdAt` e as salas vinculadas de cada funcionário (`employeesRooms`, ordenadas por nome, incluindo as inativas) e ordena a lista por data de cadastro desc; paginação ainda pendente)
- [x] Inativar funcionário (`deactivate.ts` — `PATCH /employees/deactivate/:id`)
- [x] Ativar funcionário (`activate.ts` — `PATCH /employees/activate/:id`)
- [x] Alterar funcionário (`update.ts` — `PATCH /employees/update/:id`)
- [x] Trocar foto de perfil do funcionário logado (`update-image.ts` — `PATCH /employees/update-image`)
- [x] Vincular funcionário a uma ou várias salas (`link-with-rooms.ts` — `POST /employees/link-with-rooms`)
- [x] Desvincular funcionário de uma ou várias salas (`unlink-with-rooms.ts` — `POST /employees/unlink-with-rooms`)

### Regras de negócio (RN)
- [x] Somente ADMIN cadastra funcionários/salas/computadores (funcionários, salas e cadastro/edição/exclusão de computadores protegidos)
- [x] Não permitir e-mail nem CPF duplicado
- [x] Não trocar a senha se a nova for igual à antiga
- [x] Somente ADMIN lista todos os funcionários
- [x] Somente ADMIN inativa/ativa/altera funcionário
- [x] Funcionário inativo não pode se autenticar
- [x] Não vincular funcionário a uma sala inativa

---

## 2. Salas (Rooms)

### Casos de uso (RF)
- [x] Criar sala (`create.ts` — `POST /rooms/create`; corpo aceita `uf`, validada contra as 27 siglas e assumida como `MA` quando omitida — o padrão vive no Zod, não no banco, então o cadastro pode discordar sem migração)
- [~] Listar salas por papel (`get-all.ts` — `GET /rooms/get-all`; ADMIN vê todas inclusive inativas, MEMBER vê apenas as próprias salas ativas via `getCurrentEmployee()`; com computadores, disponibilidade `inUse`/`maintenance` e funcionários vinculados **ativos** — quem foi desligado, soft delete via `employees.inactive`, some da equipe da sala; devolve `createdAt` e `uf` da sala e a versão do Desktop de cada estação (`appVersion` + `appVersionReportedAt`, para o card do painel mostrar em que versão a máquina está); sem paginação ainda)
- [x] Editar sala (`update.ts` — `PATCH /rooms/update/:id`; `uf` opcional e sem padrão aqui: campo ausente mantém o estado atual)
- [x] Inativar sala (`deactivate.ts` — `PATCH /rooms/deactivate/:id`)
- [x] Ativar sala (`activate.ts` — `PATCH /rooms/activate/:id`)

### Regras de negócio (RN)
- [x] Somente ADMIN cria/edita/inativa/ativa salas

---

## 3. Computadores (Computers)

### Casos de uso (RF)
- [x] Cadastrar computador (`create.ts` — `POST /computers/create`; MAC normalizado/único, `number` e `description` únicos por sala)
- [x] Editar computador (`update.ts` — `PATCH /computers/update/:id`; atualização parcial restrita a ADMIN, MAC normalizado/único e `number`/`description` únicos na sala efetiva)
- [x] Excluir computador (`delete.ts` — `DELETE /computers/delete/:id`; restrito a ADMIN, recusa com `400` se em uso, remove histórico de sessões e impressões em cascata)
- [~] Listar computadores (`get-all.ts` — `GET /computers/get-all`; filtros opcionais por sala e por descrição case-insensitive; devolve `createdAt` da máquina, a última versão do Desktop informada por ela (`appVersion` + `appVersionReportedAt`), o `isOnline` lido do mapa em memória do canal e o `updateStatus` calculado no servidor, além de `latestVersion` no topo da resposta; ordena por data de cadastro desc; paginação ainda pendente)
  - O `updateStatus` tem **três** estados (`outdated`, `up-to-date`, `unknown`) e a conta é do servidor de propósito: comparar versão por texto é um erro que só aparece na décima publicação (`'1.0.10' < '1.0.9'` em ordem alfabética) e não pode ser reescrito em cada tela. `unknown` — nunca informou, informou algo ilegível, ou a API ainda não sabe a publicada — **jamais** vira `up-to-date`, porque confundir "não sei" com "está certo" é como uma máquina desatualizada some do radar
- [x] Mandar uma estação atualizar agora (`update-app.ts` — `POST /computers/update-app/:id`; ADMIN-only, uma máquina por chamada, teto de 10 em 5 minutos **por máquina** porque cada disparo aceito manda a estação baixar ~60 MB. Recusa com `400` se em uso — nenhuma versão interrompe advogado(a) em atendimento — e também quem já está na versão publicada; **manutenção não bloqueia**, é o melhor momento para trocar o executável. `409` para estação fora do canal, sem enfileirar: a máquina desligada pega a versão sozinha na próxima partida. A resposta confirma o envio do recado, jamais a atualização — a prova é o `register` seguinte trazendo a versão nova)
  - Caminho `/update-app/:id` e **não** `/update/:id`: o segundo já é o `PATCH` que edita o cadastro, e as duas na mesma URL separadas só pelo verbo fariam um `POST` distraído mandar uma estação baixar o pacote inteiro
- [x] Colocar/retirar computador de manutenção (`put-into-maintenance.ts` — `PATCH /computers/maintenance/:id`; e `take-out-of-maintenance.ts` — `PATCH /computers/maintenance/:id/remove`; ADMIN em qualquer máquina e funcionário comum nas de suas salas; ao colocar recusa se já em manutenção ou em uso, ao retirar recusa se não estava em manutenção)
- [x] Liberar computador manualmente (funcionário) — sem rota nova: o painel usa a mesma `POST /lawyers/release-computer` informando o `macCode` da máquina escolhida, e o evento `session_started` destrava a estação (o `notified` da resposta avisa quando o Desktop está offline)

### Regras de negócio (RN)
- [x] Somente ADMIN cadastra/edita/exclui computadores (cadastro, edição e exclusão protegidos). Manutenção é operacional: ADMIN em qualquer máquina, funcionário comum nas de suas salas
- [x] Não liberar computador de sala inativa (`release-computer.ts` recusa com `400` quando `computer.room.inactive`, orientando a procurar a administração)
- [x] Não liberar computador em manutenção (`release-computer.ts` recusa com `400` quando `computer.maintenance`, orientando a procurar a administração)
- [x] Não liberar computador já em uso (`release-computer.ts` recusa com `400` quando `computer.inUse`, antes de abrir a nova sessão)

---

## 4. Advogados (Lawyers) e Sessões

### Casos de uso (RF)
- [x] Solicitar uso de computador em uma sala (abre sessão) (`release-computer.ts` — `POST /lawyers/release-computer`; pública, autenticação por CPF/OAB/nascimento; o `200` devolve `lawyerName`, `remainingTime` e `expiresAt` (ISO 8601 UTC) — `remainingTime: 0` + `expiresAt: null` distinguem o encerramento de sessão estourada da liberação concedida)
- [x] Cron job que encerra sessões expiradas e libera o computador (`src/http/jobs/auto-close-sessions.cron.ts`; `node-cron` in-process a cada 1min com `noOverlap`, update condicional evita corrida com `close-computer`/`release-computer`)
- [x] Cancelar sessão (guardando o tempo restante) (`close-session.ts` — `POST /lawyers/close-computer/:sessionId`)
- [x] Continuar sessão de onde parou (apenas no mesmo dia) (cota diária global via `getDailyQuota` — soma sessões finalizadas no dia em qualquer sala)
- [~] Buscar todas as sessões (`get-all-releases.ts` — `GET /lawyers/get-all-releases/:roomId?`; ADMIN vê todas, MEMBER só das salas vinculadas; filtros por advogado/data, retorna o computador usado (`id`/`description`) e cálculo de `usedMinutes`/`remainingMinutes`/`usedAllTime`; paginação ainda pendente)

### Regras de negócio (RN)
- [x] Validar adimplência na API externa antes de liberar
- [x] Validar/criar advogado na tabela `lawyers` a partir dos dados externos
- [x] Advogado existe (Lawyers)
- [x] Computador existe e não está em uso (`inUse === false`)
- [x] Advogado tem tempo restante (`remainingTime > 0`) (via saldo diário global)
- [x] Computador pertence a uma sala ativa (`inactive === null`)
- [x] Advogado não pode ter duas sessões ao mesmo tempo
- [x] Dados vindos da API externa não podem ser editados (advogado(a) só é criado/atualizado a partir do que a API retorna)
- [x] Não acessar no mesmo dia se o tempo acabou
- [x] Ao cancelar, guardar o tempo restante
- [x] Só usar o tempo restante no mesmo dia
- [x] Só liberar se estiver adimplente (suspensível por determinação da OAB via `ALLOW_DEFAULTING_LAWYERS="true"` no ambiente; padrão bloqueia, e o boot avisa em vermelho enquanto a exceção estiver ligada)

---

## 5. Impressão (Printers)

### Casos de uso (RF)
- [x] Registrar arquivo enviado para impressão (cria registro em `printers`)
- [x] Listar arquivos pendentes da(s) sala(s) do funcionário
- [ ] Baixar arquivo para impressão
- [ ] (Opcional) Atualizar status `downloaded_at` / `printed_at`
- [x] Cron job: apagar impressões do servidor toda sexta-feira às 23:59:59 (`src/http/jobs/delete-weekly-prints.cron.ts`; `node-cron` no fuso de `TIMEZONE`, remove do bucket `prints` antes de apagar o registro)
  - Regra revisada: era "1 dia após o envio"; passou a ser expurgo semanal, para não apagar arquivo enviado na sexta antes de ser impresso na segunda
- [x] Relatório por e-mail de cada limpeza semanal para `EMAIL_ADMIN` (concluída, parcial ou falha; sai também quando não havia nada a limpar, para que a ausência do e-mail seja sinal)
- [x] Alerta no boot quando a janela agendada passou sem limpeza (API fora do ar na sexta): a fila com impressões anteriores à última sexta 23:59:59 é a evidência

---

## 6. Relatórios (Reports)

### Casos de uso (RF)
- [~] Uso de cada sala e computador — `GET /lawyers/releases-metrics/:roomId?` agrega por sala; por computador ainda não
- [ ] Quantidade de impressões por advogado e sala
- [x] Tempo médio de uso por sessão — em `releases-metrics`, apenas sobre sessões encerradas
- [x] Liberações por ano, por mês e por advogado — `releases-metrics`

### Regras de negócio (RN)
- [ ] Somente ADMIN emite relatórios
  - Obs.: `releases-metrics` **não** é restrita a ADMIN — ela alimenta a tela de Métricas, que fica em
    "Operação" e recorta por sala vinculada, como `get-all-releases`. A regra acima vale para a tela de
    Relatórios da Administração, ainda por fazer.

---

## 7. Versão do Desktop (App)

A pergunta "quais máquinas estão atrasadas" precisa de duas metades. A primeira já existia: `computers.appVersion`, que cada estação anuncia no `register`. Esta seção é a segunda — **qual versão deveria estar lá** — e o que se faz com a resposta.

### Casos de uso (RF)
- [x] Guardar as versões publicadas (`app_versions` — histórico, uma linha por versão, e não uma linha só sobrescrita: "quando a 1.0.8 saiu e com que notas" hoje só existe no terminal de quem publicou. A vigente é a última criada)
- [x] Receber o aviso da publicação (`app-version/publish.ts` — `POST /app/version`; o `publicar.ps1` avisa no instante em que a versão sai. Token de serviço no `Authorization: Bearer`, **não** é login de funcionário; comparação em tempo constante sobre digests SHA-256. Parser de content type próprio e encapsulado, para ficar com o corpo **como texto** — o envelope vai ao banco byte a byte, porque reserializar reordena chaves e quebra a assinatura sem alterar um único dado)
- [x] Espelhar o manifesto público (`jobs/mirror-app-version.cron.ts` — a cada 5 min com `noOverlap`, alinhado ao `max-age` do próprio arquivo; `If-None-Match` faz a esmagadora maioria das rodadas voltar `304` sem corpo. É a **rede de segurança** para o dia em que o aviso acima não chegar, não a fonte)
- [x] Conferir a assinatura do manifesto na entrada (`utils/app-version.ts` — ECDSA P-256 sobre os bytes decodificados do `conteudo`; `APP_MANIFEST_PUBLIC_KEY` vazia desliga. É rede, não muralha: quem protege o parque é cada estação, com a chave embutida no próprio executável)
- [x] Situação de cada estação diante da publicada (`updateStatus` em `GET /computers/get-all`)
- [x] Mandar uma estação atualizar agora (ver seção 3)
- [ ] `GET /app/version` — servir o envelope às estações direto da API (fase 2). O banco já guarda o manifesto byte a byte preparado para isso; hoje as estações continuam lendo o arquivo público
- [ ] Disparo em lote ("atualize a Sala 3 inteira"). Hoje é o front repetindo a chamada — e o teto por máquina existe justamente para isso não travar

### Regras de negócio (RN)
- [x] **A ordem nunca é "quem escreveu por último"** (`save-published-version.ts`). O arquivo público tem `max-age=300`: publica-se a 1.0.9, o `POST` avisa, e minutos depois o espelho pergunta à CDN, que **ainda entrega a 1.0.8 do cache**. Sem guarda, o espelho rebaixaria a versão publicada, o painel voltaria a dizer que o parque está em dia, e cinco minutos depois tudo se consertaria sozinho — bug que aparece e some é bug que ninguém consegue reproduzir para reportar
- [x] Empate de versão se desfaz por `geradoEm`, **nunca** por percentual: a onda sobe republicando o mesmo número (1.0.8 a 0%, 10%, 50%, 100%) e conter uma versão ruim é o mesmo movimento ao contrário, republicar com percentual **menor**. Uma regra por percentual bloquearia exatamente esse freio de mão. `geradoEm` vem de dentro do conteúdo assinado, então não é falsificável sem invalidar a assinatura
- [x] Sem `geradoEm` comparável, o desempate vai para a origem (publicação vence, espelho perde) **e sai aviso no log** — é sinal de manifesto entrando fora do processo normal, e silencioso não haveria pista nenhuma
- [x] Falha de leitura **nunca** vira "não há versão": timeout, `5xx` e DNS oscilando mantêm o valor conhecido. Apagar a publicada por oscilação de rede faria o painel anunciar o parque inteiro em dia
- [x] Duas fontes, **uma** porta de entrada (`savePublishedVersion`): a regra de sobrescrita mora num lugar só, porque duplicada nas duas pontas divergiria na primeira correção
- [x] Sem `APP_VERSION_PUBLISH_TOKEN` configurado a rota responde `503` e não atende ninguém — o contrário seria comparar segredo vazio com segredo vazio e aceitar qualquer manifesto. Token e chave **vazios ou em branco** valem como "não configurado", e não como erro de validação: o `.env.example` copiado não pode derrubar o boot
- [x] A API **não assina** manifesto em hipótese alguma. A chave privada fica no cofre de quem publica; a pública já viaja dentro de todo executável instalado no parque e não é segredo
