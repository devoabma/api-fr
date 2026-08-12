# Design

## 1. A pergunta desta entrega não é "como enviar", é "o que pode dar errado depois de enviado"

Empurrar um JSON por um socket que já está no mapa é uma linha de código. O que decide se esse evento pode ser confiado por meses é o que acontece nas bordas: a mensagem que não chega, a mensagem que chega tarde demais, e a mensagem que chega antes de quem a provocou terminar de agir. As decisões abaixo são as respostas a essas três.

## 2. O aviso sai depois do commit e não pode derrubar a resposta

A ordem é deliberada:

```
transação (sessão encerrada, computador liberado, cota atualizada)
   ↓ commit
notifySessionClosed(...)   ← não lança, não é aguardado por nada
   ↓
reply 200
```

Inverter isso — avisar antes de gravar — criaria a pior falha possível: o Desktop fecha a tela, devolve a máquina à trava, e a transação falha logo depois. O advogado perde a sessão que o banco ainda considera aberta.

E envolver o aviso na transação seria pior ainda de outro jeito: uma estação com o socket meio-aberto faria o `close-computer` responder `500` para uma operação que **deu certo**. O funcionário veria "erro ao encerrar" e clicaria de novo, num encerramento que já aconteceu.

Por isso `notifySessionClosed` tem uma regra dura: **nunca lança**. O `try/catch` interno existe para essa promessa, não por medo de erro específico — o `sendMessage` já ignora socket fora de `OPEN`, mas a função é chamada de dentro de handlers e de um cron, e nenhum dos dois pode ser derrubado por um problema de transporte.

O retorno `boolean` existe só para o log separar dois fatos que parecem iguais e não são: "não entreguei porque a estação está offline" (esperado, `warn`) e "não entreguei porque algo quebrou" (`error`).

## 3. A mensagem repete o que o roteamento já sabe — e isso é a proteção

`macCode` e `sessionId` são redundantes: a mensagem sai pelo socket daquela estação, e a estação só tem uma sessão aberta por vez. Mesmo assim os dois viajam no corpo, porque cada um cobre uma falha diferente e nenhuma delas é hipotética:

| Campo | Falha que ele impede |
| --- | --- |
| `macCode` | engano de roteamento no servidor derrubando a sessão da máquina errada — a pessoa está sentada ali usando |
| `sessionId` | evento atrasado encerrando a **sessão seguinte**, depois que a máquina foi liberada de novo |

O segundo é o que mais assusta. Basta a estação ficar alguns segundos fora do ar, o advogado seguinte liberar a máquina, e um evento antigo chegar: sem a conferência, a sessão nova morre sem motivo. O servidor não tem como evitar isso enquanto não houver numeração monotônica por estação — quem tem a informação necessária (qual sessão está aberta **agora** naquela máquina) é o Desktop. Por isso o contrato manda comparar e ignorar quando não bate, e a documentação diz isso com todas as letras.

## 4. `reason` descreve, não comanda

`manual` e `expired` mudam apenas o texto exibido. A ação — fechar a tela, devolver a máquina à trava — é idêntica.

A alternativa seria mandar o Desktop fazer coisas diferentes conforme o motivo, e ela envelhece mal: no dia em que aparecer um terceiro motivo (`maintenance`, `room_disabled`), toda versão instalada nas salas teria que ser atualizada antes de o servidor poder usá-lo. Com `reason` descritivo, um motivo novo cai no texto genérico e o comportamento continua correto sem ninguém tocar nas máquinas.

Escolha de forma: objeto `as const` + tipo derivado, em vez de `enum` do TypeScript. É o valor literal que vai no JSON, então `SESSION_CLOSED_REASONS.MANUAL` e a string `'manual'` são a mesma coisa — sem a camada de indireção que o `enum` cria entre o que se escreve no código e o que trafega na rede.

## 5. O eco chega antes da resposta HTTP

Quando o próprio Desktop pede o encerramento, ele recebe a mesma notificação de volta:

```
Desktop → POST /lawyers/close-computer/:sessionId
                                    servidor grava, notifica, responde
Desktop ← session_closed (socket, já aberto)     ← quase sempre primeiro
Desktop ← 200 { message, remainingTime }         ← depois
```

Não é defeito, é consequência de o socket estar aberto e a resposta HTTP ainda estar no caminho. A saída considerada e descartada foi **não ecoar para quem pediu** — o servidor teria que saber que a chamada HTTP veio daquela máquina, o que ele não sabe: o painel web encerra a sessão de uma máquina que não é a dele, e a rota é a mesma nos dois casos. Fabricar essa distinção (mandar o Desktop enviar um identificador de origem no HTTP) adicionaria um campo ao contrato REST para resolver um problema que o cliente resolve com um booleano local.

Então o contrato assume o eco e exige duas coisas do Desktop, ambas documentadas em `docs/DOC.md`: marcar no estado local que há um encerramento em curso (para fechar em silêncio em vez de acusar "encerrado pela administração"), e tornar a rotina de saída **idempotente**, porque ela vai rodar duas vezes — pelo evento e pela resposta.

## 6. Por que `notifications.ts` e não chamar `computerConnections.sendTo` direto

O `sendTo` já faz o trabalho; um arquivo a mais parece cerimônia. Ele existe por causa da limitação 3 da fundação: **o mapa é por processo**. No dia em que houver mais de uma instância da API, a estação estará conectada em uma e o encerramento pode acontecer na outra — e a entrega vira Redis pub/sub, fila, ou o que for.

Com as rotas e os jobs chamando `notifySessionClosed`, essa mudança acontece dentro de um arquivo. Com cada chamador falando com o mapa direto, ela vira uma caçada por `sendTo` espalhado pelo código, e cada ponto esquecido é um evento que silenciosamente não chega.

## 7. O `count === 0` do cron também é uma decisão sobre o aviso

O job já usava `updateMany` com `endedAt: null` e desistia quando não atualizava nada — o caminho clássico de corrida entre o cron e o botão de encerrar. O que mudou é que agora **desistir cedo também significa não avisar**, e isso é o comportamento certo por dois motivos:

1. Quem fechou de fato já avisou (a rota `close-computer` notifica).
2. Se o advogado liberou a máquina de novo nesse intervalo, um segundo aviso carregaria o `sessionId` **da sessão antiga** — que a conferência do Desktop descartaria, mas que não deveria ter saído do servidor.

## 8. Objeto em vez de parâmetros posicionais no `closeSession` do cron

`closeSession(sessionId, computerId, macCode, lawyerId, now)` seria quatro strings seguidas: trocar duas de lugar compila, passa no lint e produz um bug que só aparece na sala — computador errado liberado, cota zerada do advogado errado. Com um objeto nomeado, o compilador cobra o nome de cada campo. É a mesma razão de o `macCode` ter sido incluído no tipo `ExpiredSession` em vez de ser buscado de novo lá dentro.
