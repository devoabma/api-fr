## 1. Protocolo

- [x] 1.1 Trocar o membro `registered` da união `ServerMessage` por uma forma documentada, com `roomName?` e `number?`
- [x] 1.2 Registrar no próprio tipo por que os dois campos são opcionais (MAC não cadastrado, falha de banco) e o que o Desktop faz na ausência deles
- [x] 1.3 Declarar `version` opcional no `registerMessageSchema`, com teto de tamanho
- [x] 1.4 Sanear a `version` por `transform`, deixando só `[\w.+-]`, em vez de recusar a mensagem
- [x] 1.5 Anotar no schema por que a tolerância a campos desconhecidos é contrato e não acidente

## 2. Consulta ao cadastro (`handler.ts`)

- [x] 2.1 Escrever `findComputerLabel(macCode)` buscando `number` e `room.name` por `macCode`
- [x] 2.2 Garantir que a função nunca lança: MAC ausente devolve `null` com `warn`, exceção devolve `null` com `error`
- [x] 2.3 Manter todo o registro (validação, `clearTimeout`, mapa, `registeredMacCode`) **antes** do primeiro `await`
- [x] 2.4 Conferir que o socket ainda é o dono da chave no mapa antes de enviar o ack
- [x] 2.5 Espalhar o rótulo no `registered` com `...(label ?? {})`, para os campos sumirem juntos
- [x] 2.6 Incluir sala, número e versão na linha de log do registro bem-sucedido
- [x] 2.7 Tornar o listener de `message` assíncrono e `await` no `handleRegister`, para a rejeição continuar dentro do `try/catch` existente

## 3. Verificação

- [x] 3.1 `npx tsc --noEmit` sem erros
- [x] 3.2 `npx biome check src/http/websocket` sem issues
- [x] 3.3 Subir a API real e provar que um MAC cadastrado recebe `roomName` e `number` corretos
- [x] 3.4 Provar que o MAC com e sem separadores (`D97874587480` e `D9-78-74-58-74-80`) leva ao mesmo rótulo
- [x] 3.5 Provar que MAC desconhecido recebe `registered` sem os campos e **permanece conectado**
- [x] 3.6 Provar que campo desconhecido no `register` (`hostname`, objeto aninhado) não recusa a mensagem
- [x] 3.7 Provar que `version` com quebra de linha não forja linha no log do servidor

## 4. Documentação

- [x] 4.1 Atualizar o contrato do canal em `docs/DOC.md`: `registered` com a tabela dos campos novos, a regra de precedência sobre a configuração local e o caso de ausência
- [x] 4.2 Registrar em `docs/DOC.md` que `version` é opcional e que campos extras são ignorados, nunca recusados
- [x] 4.3 Marcar o item no `docs/ROADMAP.md`

## 5. Próximos ciclos (fora desta change)

- [ ] 5.1 Empurrar o rótulo para a estação já conectada quando o computador for remanejado pelo `update-computer`
- [ ] 5.2 Persistir a `version` em `computers` e exibir a distribuição no painel
- [ ] 5.3 Credencial de estação (TOFU) — segue sendo o que falta para o canal ter identidade de verdade
- [ ] 5.4 Snapshot autoritativo no `register`, entregando o estado da sessão junto com o rótulo
