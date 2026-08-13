## 1. Protocolo

- [x] 1.1 Adicionar `session_started` à união `ServerMessage`, com `macCode`, `sessionId`, `lawyerName`, `startedAt`, `expiresAt` e `remainingTime`
- [x] 1.2 Documentar no próprio tipo que a mensagem é idempotente e deve ser ignorada quando o `sessionId` já estiver em tela
- [x] 1.3 Registrar no campo `lawyerName` o limite do que pode trafegar pelo canal enquanto não houver credencial de estação
- [x] 1.4 Limpar do cabeçalho a lista de eventos futuros que citava `computer_released` / `session_started`

## 2. Camada de notificação

- [x] 2.1 Extrair `deliver(macCode, message, description)` com o `try/catch`, o `warn` de estação offline e o `error` de transporte
- [x] 2.2 Reescrever `notifySessionClosed` sobre o `deliver`, sem mudar mensagem nem log
- [x] 2.3 Escrever `notifySessionStarted` recebendo `startedAt`/`expiresAt` como `Date` e serializando em ISO/UTC na borda
- [x] 2.4 Subir para o cabeçalho do módulo a promessa de que nenhuma função dali lança
- [x] 2.5 Reexportar `notifySessionStarted` no `index.ts` do módulo

## 3. Disparo na liberação (`release-computer`)

- [x] 3.1 Extrair `expiresAt` como `Date`, usado pela mensagem e pela resposta HTTP, para as duas pontas expirarem no mesmo instante
- [x] 3.2 Chamar `notifySessionStarted` **depois** do `$transaction` e **antes** do `reply`
- [x] 3.3 Enviar o mesmo `sessionId`, `lawyerName` e `remainingTime` que vão no corpo da resposta
- [x] 3.4 Adicionar `notified` ao schema de resposta `200`, documentando que ele existe para o painel

## 4. Ramo da sessão estourada

- [x] 4.1 Trocar `update` por `updateMany` com `endedAt: null` para detectar quem realmente encerrou
- [x] 4.2 Disparar `notifySessionClosed` com `reason: expired` e `remainingTime: 0` somente quando `count > 0`
- [x] 4.3 Devolver `notified` também neste `200`, coerente com o outro caminho
- [x] 4.4 Registrar em comentário por que a corrida com o cron é o caso típico neste ramo, e não a exceção

## 5. Verificação

- [x] 5.1 `npx tsc --noEmit` sem erros
- [x] 5.2 `npx biome check src/` sem issues
- [x] 5.3 `npx tsup` — build limpo
- [x] 5.4 Confirmar que o `macCode` usado no disparo é o `formattedCodeMac` normalizado, mesma chave do mapa de conexões
- [ ] 5.5 Com o Desktop conectado, liberar pela rota e provar que o `session_started` chega com o `sessionId` e o `expiresAt` iguais aos do corpo da resposta
- [ ] 5.6 Com a estação desconectada, provar que a liberação continua respondendo `200`, com `notified: false` e log de não entrega
- [ ] 5.7 Liberar duas vezes seguidas para o mesmo advogado(a) e provar que a segunda chamada responde `400` sem emitir evento
- [ ] 5.8 Deixar a cota estourar, chamar `release-computer` e provar que chega `session_closed` com `reason: expired`
- [ ] 5.9 Provar que, quando o cron encerra primeiro, a liberação logo em seguida **não** emite um segundo `session_closed`

## 6. Documentação

- [x] 6.1 Documentar `session_started` em `docs/DOC.md`, com tabela de campos e as conferências obrigatórias do cliente
- [x] 6.2 Documentar que este é o evento que faz a liberação pelo painel valer, e o que acontece com a estação offline
- [x] 6.3 Documentar o campo `notified` na descrição da rota `release-computer`
- [x] 6.4 Ajustar a descrição de `reason: expired`, que agora também nasce da rota de liberação
- [x] 6.5 Marcar no `docs/ROADMAP.md` o evento e a liberação manual pelo funcionário

## 7. Próximos ciclos (fora desta change)

- [ ] 7.1 Snapshot autoritativo no `register` — virou o item mais urgente do canal, porque a liberação pelo painel depende de a estação estar online
- [ ] 7.2 Credencial de estação por TOFU, agora que o canal transporta o nome do advogado(a)
- [ ] 7.3 Autoria da liberação (quem liberou pelo painel), com autenticação na rota e coluna no banco
- [ ] 7.4 `seq` monotônico por estação, para descartar evento atrasado no servidor em vez de depender da conferência do cliente
