# Design

## 1. O assunto principal é a identidade da conexão, não o transporte

Abrir um WebSocket no Fastify é uma linha. O que decide se esse canal funciona por meses sem manutenção é responder a uma pergunta só: **quando duas coisas dizem ser o mesmo computador, qual delas é o computador?**

Praticamente todos os defeitos difíceis desse tipo de servidor saem daí — mapa que aponta para socket morto, evento entregue na máquina errada, estação que nunca mais consegue voltar depois de uma queda. As três decisões abaixo são as respostas adotadas.

## 2. Reconexão do mesmo `macCode` derruba a conexão antiga

Duas políticas eram possíveis quando um `macCode` já registrado tenta registrar de novo:

- **Recusar a nova.** Parece defensivo: protege o registro existente contra um impostor.
- **A nova vence** e a antiga é fechada com `4409`.

Adotamos a segunda, e o motivo é o cenário real de sala: o cabo é puxado ou o switch reinicia. O Desktop percebe na hora (o TCP dele quebra), mas **o servidor não percebe nada** — para ele, o socket continua aberto até o keepalive do sistema desistir, o que leva horas. Nesse intervalo, recusar a nova conexão significaria que o Desktop tenta voltar a cada poucos segundos e é recusado todas as vezes, por causa de um fantasma. A máquina ficaria fora do ar por uma falha de rede de dez segundos.

A política escolhida inverte isso: quem chegou por último é quem está vivo, porque chegou por uma conexão TCP que existe agora. O custo é que um impostor consegue expulsar a estação legítima — um problema real, mas que **já está aberto de qualquer forma** enquanto o `macCode` não for autenticado (o impostor simplesmente registraria primeiro). É a credencial de estação que fecha essa porta, não a política de conflito.

## 3. `unregister` só remove se o socket for o mesmo

Este é o bug clássico do padrão, e ele é silencioso:

```ts
// Errado — apaga a conexão nova
socket.on('close', () => connections.delete(macCode))
```

A sequência que quebra é exatamente a do item anterior:

1. Conexão B registra `AA-BB-...`; o mapa passa a apontar para B.
2. A conexão A (substituída) recebe o `close` — que chega **depois**, porque fechar é assíncrono.
3. O handler de A executa `delete(macCode)` e apaga **o registro de B**.

O resultado é uma estação conectada, viva e respondendo ping, que o servidor considera offline: todo evento futuro para ela é descartado sem erro. Por isso `unregister(macCode, socket)` compara a identidade do socket antes de apagar e devolve `false` quando o registro pertence a outra conexão — o handler usa esse retorno inclusive para não logar uma desconexão que não aconteceu.

## 4. Heartbeat de frames de controle, não de mensagem de aplicação

Sem heartbeat, o requisito "ao desconectar, a API remove o socket" **falha justamente no caso mais comum da sala**: ninguém fecha o app: a pessoa desliga o computador no botão ou a energia cai. Não existe frame de close nessa situação. O socket permanece `OPEN` na visão do servidor até o TCP keepalive do sistema operacional expirar — padrão de horas no Linux.

O ping usado aqui é frame de controle do protocolo, respondido pela própria pilha do WebSocket. Isso importa para o outro lado: **o Desktop não precisa implementar nada** para o heartbeat funcionar, o que permite que o servidor detecte estação morta desde já, antes de qualquer acordo sobre mensagens de aplicação.

O ciclo é o padrão do `ws`: a cada 30s, quem não respondeu ao ping anterior (`isAlive === false`) é removido do mapa e encerrado com `terminate()`; quem respondeu é marcado como não-vivo e recebe um novo ping. O `pong` devolve a marca. O intervalo é `unref()`, para não segurar o processo vivo no shutdown.

Vale registrar o limite: isso detecta **cliente morto**, não **servidor mudo**. Um Desktop conectado a uma API travada não tem como perceber, porque o `ClientWebSocket` do .NET não expõe API para observar pongs. Fechar esse lado exige uma mensagem de aplicação (`heartbeat`/`ack`) no próximo ciclo — está fora desta entrega, mas é por isso que o protocolo já é discriminado por `type`.

## 5. Conexão anônima tem prazo de validade

O heartbeat só cobre estações registradas — elas são as que estão no mapa. Uma conexão que abre e nunca se identifica não está em lugar nenhum e ficaria pendurada indefinidamente, consumindo socket. Daí o corte de 10 segundos para o `register`, com fechamento `4408`.

É também a primeira barreira barata contra quem só abre conexões: sem se identificar, ninguém segura recurso por mais de dez segundos.

## 6. Mensagem inválida não derruba a conexão

Frame malformado é ruído de cliente, não incidente de servidor. O parser devolve o motivo (`invalid_payload`, `unknown_message_type`) em vez de lançar, a API responde `{ type: 'error', ... }` e **mantém a conexão aberta**.

Derrubar seria pior de duas maneiras: transformaria um bug de serialização do Desktop em laço de reconexão, e daria a qualquer um um jeito trivial de derrubar a estação alheia caso o canal um dia aceite mensagens não autenticadas.

O conteúdo bruto do frame **nunca vai para o log**: hoje porque é texto arbitrário de origem não confiável (injeção em log), e amanhã porque carregará credencial de estação. Pelo mesmo motivo o `macCode` recusado por formato não é impresso — só o fato da recusa.

## 7. Por que o protocolo já nasce discriminado por `type`

Só existe uma mensagem hoje (`register`), o que tornaria tentador aceitar qualquer JSON e ler os campos. A união discriminada com Zod foi escolhida porque o custo dela é quase zero agora e ela paga em três lugares depois:

- O `switch` do handler tem um `default` com `never`: **adicionar um tipo novo ao protocolo quebra o build** enquanto ninguém tratar o caso.
- O cliente recebe `unknown_message_type` com o nome do tipo, o que torna incompatibilidade de versão entre API e Desktop um erro legível em vez de silêncio.
- Os eventos futuros entram como novos membros da união, sem tocar no que existe.

## 8. `fastify-plugin` e o registro antes das rotas

O módulo é exportado via `fastify-plugin` para não criar escopo encapsulado: sem isso, a rota nasceria em um contexto filho e hooks globais registrados depois não a alcançariam — o mesmo cuidado que já vale para o rate limit.

O `onClose` fecha todas as conexões com `4503` e limpa o mapa. Serve ao deploy (o Desktop distingue "API reiniciando, reconecte com backoff" de "fui substituído") e a testes, que de outro modo ficariam pendurados em sockets abertos.

## 9. Verificação

A infraestrutura foi provada subindo a aplicação de verdade em `127.0.0.1:25699` e conectando clientes WebSocket reais, com inspeção direta do `computerConnections` a cada passo — registro, normalização do `macCode`, os três erros de mensagem, substituição de conexão, remoção no `close` e corte por timeout de registro. Todos os cenários passaram. Os passos estão em `tasks.md`, seção 6.
