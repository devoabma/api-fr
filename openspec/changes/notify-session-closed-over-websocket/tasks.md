## 1. Protocolo

- [x] 1.1 Criar `SESSION_CLOSED_REASONS` (`manual`, `expired`) como objeto `as const` em `protocol.ts`
- [x] 1.2 Derivar o tipo `SessionClosedReason` das chaves do objeto, sem `enum`
- [x] 1.3 Adicionar `session_closed` à união `ServerMessage`, com `macCode`, `sessionId`, `reason`, `closedAt` e `remainingTime`
- [x] 1.4 Documentar no próprio tipo por que `macCode` e `sessionId` são redundantes de propósito
- [x] 1.5 Reexportar `SESSION_CLOSED_REASONS` e `SessionClosedReason` no `index.ts` do módulo

## 2. Camada de notificação

- [x] 2.1 Criar `src/http/websocket/notifications.ts` como ponto único entre regras de negócio e entrega
- [x] 2.2 Escrever `notifySessionClosed` recebendo `closedAt` como `Date` e serializando em ISO/UTC na borda
- [x] 2.3 Garantir que a função **nunca lança**, com `try/catch` interno
- [x] 2.4 Devolver `boolean` e separar no log estação offline (`warn`) de falha de transporte (`error`)
- [x] 2.5 Não expor conteúdo sensível nos logs — apenas `macCode`, `sessionId` e `reason`

## 3. Disparo manual (`close-computer`)

- [x] 3.1 Selecionar `computer.macCode` na consulta da sessão
- [x] 3.2 Chamar `notifySessionClosed` **depois** do `$transaction` e **antes** do `reply`
- [x] 3.3 Enviar `reason: manual` e o mesmo `remainingTime` que vai na resposta HTTP
- [x] 3.4 Usar como `closedAt` exatamente o instante gravado em `endedAt`
- [x] 3.5 Confirmar que o contrato da resposta HTTP não mudou

## 4. Disparo automático (cron `auto-close-sessions`)

- [x] 4.1 Selecionar `computer.macCode` na varredura de sessões candidatas
- [x] 4.2 Trocar os parâmetros posicionais de `closeSession` pelo objeto `ExpiredSession`
- [x] 4.3 Substituir o `TODO: Lançamento do WebSocket...` pela chamada real
- [x] 4.4 Enviar `reason: expired` e `remainingTime: 0`, coerente com o `update` que zera a cota
- [x] 4.5 Manter o `return` em `count === 0` **antes** do aviso, para não notificar encerramento que outro caminho fez
- [x] 4.6 Registrar em comentário por que o aviso mora depois do `count === 0`

## 5. Verificação

- [x] 5.1 `npx tsc --noEmit` sem erros
- [x] 5.2 `npx biome check src/` sem issues
- [x] 5.3 Confirmar que o `macCode` gravado em `computers` é normalizado pelo mesmo `formattedCodeMac` que gera a chave do mapa (senão o `sendTo` erraria em silêncio para sempre)
- [ ] 5.4 Com o Desktop conectado, encerrar pela rota `close-computer` e provar que o `session_closed` chega com `reason: manual` e o `remainingTime` igual ao do corpo da resposta
- [ ] 5.5 Deixar a cota estourar e provar que o cron entrega `reason: expired` com `remainingTime: 0`
- [ ] 5.6 Com a estação desconectada, provar que o encerramento continua respondendo `200` e que o log registra a não entrega
- [ ] 5.7 Provar que encerrar duas vezes a mesma sessão não gera um segundo `session_closed`

## 6. Documentação

- [x] 6.1 Documentar o evento em `docs/DOC.md`, com a tabela de campos e as duas conferências obrigatórias
- [x] 6.2 Documentar as três armadilhas do lado do Desktop: eco antes da resposta HTTP, saída idempotente e entrega não garantida
- [x] 6.3 Atualizar `docs/ROADMAP.md` separando `session_closed` (feito) dos eventos restantes e do snapshot

## 7. Próximos ciclos (fora desta change)

- [ ] 7.1 Snapshot autoritativo no `register`, para a estação que estava offline descobrir o que perdeu
- [ ] 7.2 `seq` monotônico por estação, para descartar evento atrasado no servidor em vez de depender da conferência do cliente
- [ ] 7.3 Eventos `computer_released` e `session_started`
- [ ] 7.4 Credencial de estação por TOFU, pré-requisito para trafegar dados do advogado pelo canal
