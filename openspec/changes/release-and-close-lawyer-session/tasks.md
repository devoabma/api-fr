## 1. Infraestrutura de suporte

- [x] 1.1 Adicionar env `API_PROTHEUS_DATA_URL` em `src/http/env.ts` e `.env.example`
- [x] 1.2 Criar client `API_PROTHEUS_DATA` (axios) em `src/lib/axios.ts`
- [x] 1.3 Criar `dayjs` configurado com timezone `America/Sao_Paulo` em `src/lib/dayjs.ts`
- [x] 1.4 Tratar `AxiosError` no `errorHandler` global como `404` (consulta indisponível/advogado não encontrado)

## 2. Schema e cota diária

- [x] 2.1 Criar `lawyerApiSchema` e `SITUACOES_LIBERADAS` em `schema/lawyer.ts`
- [x] 2.2 Criar helper `getDailyQuota` (cota diária global por advogado, definida pela sala da primeira sessão finalizada do dia)

## 3. Liberar computador

- [x] 3.1 Criar `release-computer.ts` com rota `POST /lawyers/release-computer`
- [x] 3.2 Validar/normalizar `macCode` (17 caracteres) via `formattedCodeMac`
- [x] 3.3 Consultar API do Protheus por CPF e validar formato da resposta
- [x] 3.4 Rejeitar advogado(a) fora de `SITUACOES_LIBERADAS` ou inadimplente
- [x] 3.5 Conferir CPF/OAB/nascimento informados contra a API
- [x] 3.6 Validar computador: existe, sala ativa, não em manutenção, não em uso
- [x] 3.7 Criar ou atualizar `lawyers` a partir dos dados consultados
- [x] 3.8 Verificar sessão ativa: recusar se em outro computador; encerrar por tempo esgotado se no mesmo computador; recusar se ainda há saldo
- [x] 3.9 Recusar se a cota diária global estiver zerada
- [x] 3.10 Abrir nova sessão (`computerSessions` + `computers.inUse/currentLawyerId` + `lawyers.remainingTime/lastAccess`) em transação

## 4. Encerrar sessão

- [x] 4.1 Criar `close-session.ts` com rota `POST /lawyers/close-computer/:sessionId`
- [x] 4.2 Rejeitar sessão inexistente ou já encerrada
- [x] 4.3 Recalcular saldo diário (mesma cota global) somando o tempo da sessão em curso
- [x] 4.4 Encerrar sessão e liberar computador (`inUse: false`, `currentLawyerId: null`) em transação

## 5. Registro e verificação

- [x] 5.1 Registrar as duas rotas em `routes/index.ts` sob o prefixo `/lawyers`
- [x] 5.2 Adicionar `.catch()` ao `app.listen(...)` em `server.ts`
- [x] 5.3 `npx tsc --noEmit` sem erros
- [x] 5.4 `npx biome check` sem issues
- [ ] 5.5 Validar manualmente os fluxos de liberação/encerramento contra a API real do Protheus
