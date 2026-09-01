## 1. Índices para agregação

- [x] 1.1 Adicionar `@@index([startedAt])`, `@@index([computerId])` e `@@index([lawyerId])` ao model `ComputerSessions`
- [x] 1.2 Escrever a migração `20260901120000_indices_para_metricas` (⚠️ ainda **não aplicada**: o `.env` aponta para o Neon de produção)

## 2. Inscrição do advogado na listagem

- [x] 2.1 Incluir `oab` no `select` de `get-all-releases.ts` e no schema de resposta

## 3. Agregação das liberações

- [x] 3.1 Criar `get-releases-metrics.ts` com `GET /lawyers/releases-metrics/:roomId?` (autenticada via `auth`)
- [x] 3.2 Resolver as salas visíveis por papel **antes** das queries e passá-las como parâmetro — a autorização fica em TypeScript, fora do SQL
- [x] 3.3 Agrupar por ano e por mês com dupla conversão de fuso (`AT TIME ZONE 'UTC' AT TIME ZONE <env.TIMEZONE>`)
- [x] 3.4 Agrupar por sala via `JOIN computers`, completando com `total: 0` as salas sem liberação
- [x] 3.5 Agrupar por advogado, ordenado por total decrescente, com `name` e `oab`
- [x] 3.6 Calcular os indicadores de topo, incluindo a comparação com o mesmo período do ano anterior
- [x] 3.7 Calcular o tempo médio apenas sobre sessões encerradas, descartando durações não-positivas ou acima de 24 h
- [x] 3.8 Registrar a rota em `routes/index.ts` sob o prefixo `/lawyers`

## 4. Verificação

- [x] 4.1 `npx tsc --noEmit` sem erros
- [x] 4.2 `npx biome check` sem issues
- [x] 4.3 Conferir a rota em `/docs` (Scalar) com o schema completo

## 5. Documentação

- [x] 5.1 `docs/ROADMAP.md`: marcar "Tempo médio por sessão" e "Liberações por ano/mês/advogado"; "Uso por sala" em andamento (falta por computador)
- [x] 5.2 `docs/ROADMAP.md`: registrar por que `releases-metrics` não é ADMIN-only, sob a RN "Somente ADMIN emite relatórios"
- [x] 5.3 `docs/DOC.md`: listar a rota nova em Advogados e anotar o `oab` na listagem de sessões
- [x] 5.4 `docs/DATABASE.md`: documentar os três índices em `computer_sessions` e o crescimento sem teto da tabela
- [x] 5.5 Deploy: nada a fazer — o entrypoint já roda `prisma migrate deploy` a cada boot, que é idempotente
