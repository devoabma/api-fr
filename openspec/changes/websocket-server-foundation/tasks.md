## 1. Fundação do WebSocket

- [x] 1.1 Adicionar `@fastify/websocket@^11.3.0` às dependências
- [x] 1.2 Criar o módulo `src/http/websocket/`, no mesmo nível de `src/http/jobs/`
- [x] 1.3 Expor `websocketPlugin` via `fastify-plugin`, para a rota não nascer em escopo encapsulado
- [x] 1.4 Registrar o plugin em `src/http/app.ts` antes de `appRoutes`
- [x] 1.5 Declarar a rota `GET /ws/computers` com `websocket: true` e `schema: { hide: true }`
- [x] 1.6 Limitar `maxPayload` a 4KB no servidor `ws`
- [x] 1.7 Informar o endpoint na mensagem de boot (`src/http/server.ts`)

## 2. Protocolo de mensagens

- [x] 2.1 Criar `protocol.ts` com união discriminada por `type` validada por Zod
- [x] 2.2 Definir `register` como única mensagem aceita do cliente
- [x] 2.3 Definir `registered` e `error` como mensagens do servidor
- [x] 2.4 Definir os close codes privados (`4408`, `4409`, `4401`, `4503`) e os códigos de erro de aplicação
- [x] 2.5 Escrever `parseClientMessage` devolvendo o motivo em vez de lançar, distinguindo JSON inválido de tipo desconhecido
- [x] 2.6 Escrever `sendMessage`/`sendError` ignorando socket que não está `OPEN`

## 3. Registro das conexões em memória

- [x] 3.1 Criar `connections.ts` com o singleton `computerConnections` (`Map<macCode, ComputerConnection>`)
- [x] 3.2 Normalizar o `macCode` com `formattedCodeMac` e exigir os 17 caracteres, igual ao gravado em `computers.macCode`
- [x] 3.3 Fazer a reconexão do mesmo `macCode` vencer, devolvendo a conexão anterior para ser fechada com `4409`
- [x] 3.4 Fazer `unregister` remover somente quando o socket for o mesmo do registro
- [x] 3.5 Expor `get`/`has`/`sendTo`/`list`/`size`, base para os eventos futuros

## 4. Ciclo de vida da conexão

- [x] 4.1 Tratar conexão estabelecida e registrar log sem dados de cliente
- [x] 4.2 Tratar `register`, respondendo `registered` com `connectedAt`
- [x] 4.3 Tratar mensagem inválida respondendo `error` e mantendo a conexão aberta
- [x] 4.4 Recusar `register` com `macCode` fora do padrão sem imprimir o valor recebido
- [x] 4.5 Recusar `register` de uma conexão já registrada em outro `macCode` (`already_registered`)
- [x] 4.6 Cortar com `4408` a conexão que não se identificar em 10s
- [x] 4.7 Remover a estação do mapa no `close` e registrar erro de socket sem derrubar o processo
- [x] 4.8 Garantir exaustividade do `switch` com `never`, para tipo novo quebrar o build

## 5. Sobrevivência do canal

- [x] 5.1 Implementar heartbeat de ping/pong a cada 30s, descartando quem não responde
- [x] 5.2 Marcar `isAlive` no evento `pong`, apenas quando o socket ainda for o registrado
- [x] 5.3 `unref()` no intervalo, para não segurar o processo no shutdown
- [x] 5.4 Fechar todas as conexões com `4503` e limpar o mapa no hook `onClose`

## 6. Verificação

- [x] 6.1 `npx tsc --noEmit` sem erros
- [x] 6.2 `npx biome check src/http` sem issues
- [x] 6.3 Confirmar que o tipo do socket resolve de verdade (não vira `any` por falha de resolução do pacote `ws`)
- [x] 6.4 Subir a aplicação real e provar: `register` responde `registered`, o `macCode` é normalizado e o socket é localizável pelo `macCode`
- [x] 6.5 Provar que JSON quebrado, tipo desconhecido e `macCode` curto respondem `error` sem fechar a conexão nem perder o registro
- [x] 6.6 Provar que reconectar com o mesmo `macCode` fecha a conexão antiga com `4409` e deixa o mapa apontando para a nova
- [x] 6.7 Provar que desconectar remove a estação do mapa
- [x] 6.8 Provar que a conexão que não se identifica é fechada com `4408` após 10s

## 7. Segurança (preparação, não implementação)

- [x] 7.1 Criar `authorization.ts` como ponto único de decisão do handshake, aplicado em `preValidation` (último momento em que ainda cabe resposta HTTP)
- [x] 7.2 Escrever `extractStationToken` lendo `Authorization: Bearer`, nunca query string
- [x] 7.3 Registrar como TODO a credencial de estação (TOFU) e a recusa de `Origin` de navegador
- [x] 7.4 Garantir que nenhum log imprime conteúdo de frame, header ou token

## 8. Documentação

- [x] 8.1 Registrar o WebSocket em `docs/ROADMAP.md` (seção 0 — Infraestrutura), com os próximos passos como pendentes
- [x] 8.2 Registrar o canal nos RNFs de `docs/DOC.md`, com o protocolo que o Desktop precisa implementar

## 9. Próximos ciclos (fora desta change)

- [ ] 9.1 Credencial de estação por TOFU: token opaco emitido no primeiro contato do MAC, exigido nas conexões seguintes
- [ ] 9.2 Recusar `Origin` de navegador no handshake
- [ ] 9.3 Mensagem de aplicação `heartbeat`/`ack`, para o Desktop detectar servidor mudo
- [ ] 9.4 Eventos de negócio (`computer_released`, `session_started`, `session_finished`), começando pelo `TODO` já existente em `auto-close-sessions.cron.ts`
- [ ] 9.5 Snapshot autoritativo na reconexão, com `seq` monotônico por estação para descartar evento atrasado
