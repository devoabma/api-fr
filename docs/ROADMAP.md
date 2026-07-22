# Sala Livre API — Roadmap de Construção

> Rastreio incremental de tudo que vamos construir, derivado de [`docs/DOC.md`](./DOC.md).
> Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído.
> Convenção de código: cada caso de uso é um arquivo em `src/http/core/<entidade>/<ação>.ts`, registrado em `src/http/routes/index.ts`.

---

## 0. Infraestrutura / Fundação

- [x] Plugin Prisma Client (singleton com adapter-pg) acessível nas rotas
- [x] Tratamento global de erros (errorHandler) + classes de erro de domínio
- [x] Hash de senha (bcrypt/argon2) — RNF: senha criptografada
- [x] Autenticação JWT (`@fastify/jwt`) + middleware/decorator `request.getIdCurrentEmployee()`
- [x] Middleware de autorização por papel (ADMIN vs MEMBER) — `request.checkIfEmployeeIsAdmin()`
- [ ] Paginação reutilizável (10 itens por página) — RNF
- [x] Envio de e-mail (confirmação de cadastro, solicitação de reset e confirmação de troca de senha)
- [x] Upload de imagem de perfil (Supabase Storage — `imageUrl` / `imagePublicId`)
- [x] Integração com API externa (Protheus) — validação de adimplência do advogado (`src/lib/axios.ts` — client `API_PROTHEUS_DATA`)
- [x] Documentação Swagger/OpenAPI (`@fastify/swagger`)
- [x] Handler para rota inexistente (`app.setNotFoundHandler` — `404` com `{ message, route }`)
- [x] Seed do usuário ADMIN master (`prisma/seed.ts` — cria o ADMIN a partir do `.env` quando ausente e envia e-mail de confirmação; idempotente via guard; rodar via `pnpm db:deploy` no release do deploy)

---

## 1. Funcionários (Employees)

### Casos de uso (RF)
- [x] Criar funcionário (`create-account.ts`)
- [x] Autenticar (login) (`authenticate.ts`)
- [x] Obter perfil do usuário logado (`get-profile.ts` — `GET /employees/profile`)
- [x] Trocar de senha (`change-password.ts` — `PATCH /employees/change-password`)
- [x] Redefinir senha (`reset-password.ts` — `POST /employees/reset-password`)
- [x] Enviar e-mail para redefinir senha (`request-password-recovery.ts` — `POST /employees/password-recovery`)
- [x] Enviar e-mail ao funcionário quando o ADM o cadastrar
- [~] Listar todos os funcionários (`get-all.ts` — `GET /employees/get-all`; paginação ainda pendente)
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
- [x] Criar sala (`create.ts` — `POST /rooms/create`)
- [~] Listar salas por papel (`get-all.ts` — `GET /rooms/get-all`; ADMIN vê todas inclusive inativas, MEMBER vê apenas as próprias salas ativas via `getCurrentEmployee()`; com computadores, disponibilidade `inUse`/`maintenance` e funcionários vinculados; sem paginação ainda)
- [x] Editar sala (`update.ts` — `PATCH /rooms/update/:id`)
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
- [~] Listar computadores (`get-all.ts` — `GET /computers/get-all`; filtros opcionais por sala e por descrição case-insensitive; paginação ainda pendente)
- [x] Colocar/retirar computador de manutenção (`put-into-maintenance.ts` — `PATCH /computers/maintenance/:id`; e `take-out-of-maintenance.ts` — `PATCH /computers/maintenance/:id/remove`; ADMIN em qualquer máquina e funcionário comum nas de suas salas; ao colocar recusa se já em manutenção ou em uso, ao retirar recusa se não estava em manutenção)
- [ ] Liberar computador manualmente (funcionário)

### Regras de negócio (RN)
- [x] Somente ADMIN cadastra/edita/exclui computadores (cadastro, edição e exclusão protegidos). Manutenção é operacional: ADMIN em qualquer máquina, funcionário comum nas de suas salas
- [ ] Não liberar computador de sala inativa
- [ ] Não liberar computador em manutenção
- [ ] Não liberar computador já em uso

---

## 4. Advogados (Lawyers) e Sessões

### Casos de uso (RF)
- [x] Solicitar uso de computador em uma sala (abre sessão) (`release-computer.ts` — `POST /lawyers/release-computer`; pública, autenticação por CPF/OAB/nascimento)
- [ ] Cron job que encerra sessões expiradas e libera o computador (hoje o encerramento por tempo esgotado só ocorre de forma reativa, ao tentar liberar novamente o mesmo computador)
- [x] Cancelar sessão (guardando o tempo restante) (`close-session.ts` — `POST /lawyers/close-computer/:sessionId`)
- [x] Continuar sessão de onde parou (apenas no mesmo dia) (cota diária global via `getDailyQuota` — soma sessões finalizadas no dia em qualquer sala)
- [~] Buscar todas as sessões (`get-all-releases.ts` — `GET /lawyers/get-all-releases/:roomId?`; ADMIN vê todas, MEMBER só das salas vinculadas; filtros por advogado/data e cálculo de `usedMinutes`/`remainingMinutes`/`usedAllTime`; paginação ainda pendente)

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
- [x] Só liberar se estiver adimplente

---

## 5. Impressão (Printers)

### Casos de uso (RF)
- [ ] Registrar arquivo enviado para impressão (cria registro em `printers`)
- [ ] Listar arquivos pendentes da(s) sala(s) do funcionário
- [ ] Baixar arquivo para impressão
- [ ] (Opcional) Atualizar status `downloaded_at` / `printed_at`
- [ ] Cron job: apagar impressões do servidor 1 dia após o envio

---

## 6. Relatórios (Reports)

### Casos de uso (RF)
- [ ] Uso de cada sala e computador
- [ ] Quantidade de impressões por advogado e sala
- [ ] Tempo médio de uso por sessão

### Regras de negócio (RN)
- [ ] Somente ADMIN emite relatórios
</content>
</invoke>
