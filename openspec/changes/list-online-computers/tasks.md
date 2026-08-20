## 1. Rota de estações conectadas

- [x] 1.1 Criar `src/http/core/computers/get-online.ts` com `GET /computers/online/:roomId?` e o plugin `auth`
- [x] 1.2 Ler o registro em memória via `computerConnections.list()` e montar o mapa `macCode → connectedAt`
- [x] 1.3 Curto-circuitar com `200 { computers: [] }` quando o registro estiver vazio, sem tocar no banco
- [x] 1.4 Aplicar o escopo por papel no `where` do Prisma (ADMIN em qualquer sala; MEMBER só nas vinculadas), com `roomId` opcional
- [x] 1.5 Definir o schema de resposta `200` (`id`, `macCode`, `roomId`, `connectedAt`) e devolver o `connectedAt` vindo do registro
- [x] 1.6 Registrar a rota com prefixo `/computers` em `src/http/routes/index.ts`

## 2. Verificação

- [x] 2.1 `pnpm exec tsc --noEmit` sem erros
- [x] 2.2 `pnpm exec biome check` sem apontamentos
- [x] 2.3 `pnpm build` concluindo
- [ ] 2.4 Validar manualmente: Desktop conectado aparece na lista; ao fechar o Desktop, ele some no ciclo seguinte do heartbeat; MEMBER só vê as salas dele; sem JWT → `401`

## 3. Documentação

- [x] 3.1 `docs/DOC.md`: incluir a rota no catálogo de Computadores
- [x] 3.2 `docs/ROADMAP.md`: marcar o item da limitação de estação offline aberta pela `start-session-over-websocket`
