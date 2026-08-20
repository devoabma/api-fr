## Why

A `start-session-over-websocket` abriu a liberação pelo balcão e deixou anotada, como limitação mais dolorida, a estação offline: o painel grava a sessão, o `session_started` não encontra ninguém do outro lado, e o computador fica `inUse: true` com a tela trancada. O `notified: false` na resposta era o paliativo — avisar o funcionário **depois** do estrago.

O problema é a ordem. Quem libera pelo balcão não vê a máquina; quando a resposta chega dizendo que ninguém ouviu, a sessão já existe, o computador já está ocupado e o advogado(a) já está a caminho de uma tela que não abre. O painel só consegue reagir desfazendo — encerrar a sessão que acabou de criar — e mesmo o desfazer deixa rastro: a sessão fantasma de 0 min fica no histórico e passa a ser a **primeira sessão finalizada do dia** daquele advogado(a), que é justamente o registro de onde o `getDailyQuota` tira a cota (`dailyLimitMinutes`). Uma tentativa numa sala de fórum (120 min) desfeita passa a limitar o dia inteiro de quem depois vai usar um escritório compartilhado (180 min).

A informação que faltava sempre existiu no processo: o `computerConnections` sabe, a cada instante, quais estações estão no canal. Ela só nunca teve porta de saída em HTTP.

## What Changes

- **`GET /computers/online/:roomId?`**: lista os computadores atualmente conectados ao canal `/ws/computers`. Devolve **só os conectados** — quem não está na lista está desligado, sem rede ou com o Desktop fechado.
- **Escopo por papel igual ao das outras listagens de operação**: ADMIN vê qualquer sala (ou filtra por uma via `:roomId`), MEMBER só as salas em que está vinculado. É o que permite o painel — operado por MEMBER — usar a rota, ao contrário de `/computers/get-all`, que é ADMIN-only.
- **Fonte é o registro em memória, não o banco.** Nenhuma coluna nova, nenhuma migração: estar conectado é fato do processo. O banco entra só para traduzir `macCode` em computador e aplicar o escopo do papel.
- **Nenhuma mudança no `release-computer`.** A rota continua gravando a sessão e avisando depois; o `notified` continua na resposta. A checagem prévia é do cliente.

## Capabilities

### Modified Capabilities
- `computer`: o inventário passa a ter um segundo tipo de leitura — o estado **volátil** de conexão, ao lado do estado persistido (`inUse`, `maintenance`). É a primeira rota HTTP que responde a partir do registro do WebSocket.

## Impact

- Novos: `src/http/core/computers/get-online.ts`.
- Alterados: `src/http/routes/index.ts` (registro da rota).
- Banco: nenhuma migração.
- Configuração: nenhuma variável de ambiente nova.
- Rate limit: nenhum balde próprio — a rota entra no limite global por IP (300/min), suficiente para o polling do painel.
- Clientes: aditivo. O `web-fr` passa a marcar as máquinas offline na grade e a bloquear o botão "Liberar" nelas; o Desktop não é afetado.
- Documentação: `docs/DOC.md` (catálogo de rotas) e `docs/ROADMAP.md`.

## Behavior Change

O painel deixa de descobrir a estação muda pela resposta da liberação e passa a saber **antes de abrir o formulário**. Máquina offline aparece com o tom de aviso na grade, sai da contagem de "disponíveis" e não aceita liberação.

O `notified` não perde a função: entre a consulta e o clique de confirmar existe uma janela em que a estação pode cair. Ele continua sendo a última palavra, e o painel mantém o desfazer automático para essa corrida.

## Known Limitations

1. **A lista atrasa até um heartbeat.** O `ping` roda a cada 30s e só derruba quem não respondeu ao ciclo anterior, então um PC desligado na tomada pode aparecer como conectado por até ~60s. É o mesmo atraso que o canal já tinha para entregar mensagem; a rota herda, não cria.

2. **Conectado não é o mesmo que pronto.** A rota diz que existe socket aberto naquele `macCode`, não que a tela do Desktop está funcional. Uma estação travada entre receber e desenhar continua contando como online — a confirmação de verdade exigiria a estação responder ao `session_started`, o que continua fora deste ciclo.

3. **O `macCode` continua sendo afirmação do cliente.** Enquanto o handshake não tiver TOFU, quem se registrar com o MAC de outra máquina aparece nesta lista no lugar dela. A rota não piora a situação (não expõe nada além de quais máquinas da sala estão conectadas), mas herda a fraqueza do canal.

4. **Uma instância só.** O registro é memória de processo: com mais de uma réplica da API, cada uma responderia apenas pelas estações conectadas nela. Hoje a API roda em instância única; distribuir o canal (Redis, sticky session) é problema de quando isso mudar.

5. **Não resolve o rastro da sessão fantasma já criada.** Reduz a chance de ela existir, mas o desfazer do painel continua deixando sessão de 0 min no histórico quando a corrida acontece. Fazer a liberação só gravar mediante confirmação da estação — ou não deixar sessão de duração zero definir `dailyLimitMinutes` — é outro ciclo.
