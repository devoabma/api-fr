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
- [~] Envio de e-mail (confirmação de cadastro feito; reset de senha pendente)
- [ ] Upload de imagem de perfil (Cloudinary — `imageUrl` / `imagePublicId`)
- [ ] Integração com API externa (Protheus) — validação de adimplência do advogado
- [x] Documentação Swagger/OpenAPI (`@fastify/swagger`)
- [ ] Seed do usuário ADMIN master

---

## 1. Funcionários (Employees)

### Casos de uso (RF)
- [x] Criar funcionário (`create-account.ts`)
- [x] Autenticar (login) (`authenticate.ts`)
- [x] Obter perfil do usuário logado (`get-profile.ts` — `GET /employees/profile`)
- [ ] Trocar de senha
- [ ] Redefinir senha
- [ ] Enviar e-mail para redefinir senha
- [x] Enviar e-mail ao funcionário quando o ADM o cadastrar
- [ ] Listar todos os funcionários (paginado)
- [ ] Inativar funcionário
- [ ] Ativar funcionário
- [ ] Alterar funcionário
- [ ] Trocar foto de perfil do funcionário logado
- [ ] Vincular funcionário a uma ou várias salas
- [ ] Desvincular funcionário de uma ou várias salas

### Regras de negócio (RN)
- [~] Somente ADMIN cadastra funcionários/salas/computadores (funcionários protegido; salas/computadores pendentes)
- [x] Não permitir e-mail nem CPF duplicado
- [ ] Não trocar a senha se a nova for igual à antiga
- [ ] Somente ADMIN lista todos os funcionários
- [ ] Somente ADMIN inativa/ativa/altera funcionário
- [x] Funcionário inativo não pode se autenticar
- [ ] Não vincular funcionário a uma sala inativa

---

## 2. Salas (Rooms)

### Casos de uso (RF)
- [ ] Criar sala
- [ ] Buscar todas as salas (paginado)
- [ ] Editar sala
- [ ] Inativar sala
- [ ] Ativar sala

### Regras de negócio (RN)
- [ ] Somente ADMIN cria/edita/inativa/ativa salas

---

## 3. Computadores (Computers)

### Casos de uso (RF)
- [ ] Cadastrar computador
- [ ] Editar computador
- [ ] Excluir computador
- [ ] Listar computadores (paginado)
- [ ] Liberar computador manualmente (funcionário)

### Regras de negócio (RN)
- [ ] Somente ADMIN cadastra/edita/exclui computadores
- [ ] Não liberar computador de sala inativa
- [ ] Não liberar computador em manutenção
- [ ] Não liberar computador já em uso

---

## 4. Advogados (Lawyers) e Sessões

### Casos de uso (RF)
- [ ] Solicitar uso de computador em uma sala (abre sessão)
- [ ] Cron job que encerra sessões expiradas e libera o computador
- [ ] Cancelar sessão (guardando o tempo restante)
- [ ] Continuar sessão de onde parou (apenas no mesmo dia)
- [ ] Buscar todas as sessões (paginado)

### Regras de negócio (RN)
- [ ] Validar adimplência na API externa antes de liberar
- [ ] Validar/criar advogado na tabela `lawyers` a partir dos dados externos
- [ ] Advogado existe (Lawyers)
- [ ] Computador existe e não está em uso (`inUse === false`)
- [ ] Advogado tem tempo restante (`remainingTime > 0`)
- [ ] Computador pertence a uma sala ativa (`inactive === null`)
- [ ] Advogado não pode ter duas sessões ao mesmo tempo
- [ ] Dados vindos da API externa não podem ser editados
- [ ] Não acessar no mesmo dia se o tempo acabou
- [ ] Ao cancelar, guardar o tempo restante
- [ ] Só usar o tempo restante no mesmo dia
- [ ] Só liberar se estiver adimplente

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
