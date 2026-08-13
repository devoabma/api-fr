## Why

A `notify-session-closed-over-websocket` ensinou o canal a dizer que a sessão **acabou**. Falta o outro lado: quem pode dizer que ela **começou**.

Hoje só existe um jeito de um advogado(a) usar um computador — ele digitar CPF, OAB e nascimento no próprio quiosque. É o Desktop que chama `POST /lawyers/release-computer` e, porque foi ele quem chamou, é ele quem sabe abrir a tela. Toda a liberação depende de a pessoa estar de pé na frente da máquina.

Isso deixa de fora o atendimento que a sala realmente faz: o funcionário no balcão resolvendo pelo painel. Ele já vê as salas, os computadores e as sessões — mas não consegue **liberar**, porque gravar a sessão no banco não destrava máquina nenhuma. O computador ficaria `inUse: true` com a tela trancada: o pior dos dois mundos, ocupado no sistema e inútil na sala.

O que falta não é rota. É a API conseguir mandar a estação abrir.

Há ainda um buraco menor no mesmo caminho: quando alguém tenta liberar em cima de uma sessão que já estourou o tempo, a rota encerra a sessão no banco e **não avisa ninguém** — só o cron `auto-close-sessions` avisava. A máquina fica com a tela do advogado anterior de pé sobre uma sessão morta, exatamente o sintoma que a change passada existiu para eliminar.

## What Changes

- **Mensagem `session_started` no protocolo** (`protocol.ts`), como novo membro da união `ServerMessage`:

  ```json
  {
    "type": "session_started",
    "macCode": "AA-BB-CC-DD-EE-01",
    "sessionId": "clx8f2k9c0000abcd1234efgh",
    "lawyerName": "FULANO DE TAL",
    "startedAt": "2026-08-13T13:02:00.000Z",
    "expiresAt": "2026-08-13T15:02:00.000Z",
    "remainingTime": 120
  }
  ```

- **`notifySessionStarted`** em `notifications.ts`, disparado por `release-computer.ts` depois do `$transaction`. As duas notificações passam a compartilhar um `deliver` interno — mesmo log, mesma promessa de nunca lançar.

- **Campo `notified` na resposta `200` do `release-computer`**: diz se o aviso chegou à estação. É o único campo desta change que existe para o painel e não para o quiosque.

- **`reason: expired` no ramo da sessão estourada** do `release-computer`, que encerrava sem avisar. O `update` da sessão vira `updateMany` filtrando `endedAt: null`, para o `count` distinguir quem realmente encerrou — mesma trava que o cron já usa para não notificar duas vezes.

- **Nenhuma rota nova.** O painel usa a mesma `POST /lawyers/release-computer` do quiosque, informando o `macCode` da máquina escolhida.

## Capabilities

### Modified Capabilities
- `websocket-gateway`: o canal deixa de só encerrar sessão e passa a abrir uma. É a primeira vez que um evento do servidor **cria** estado na tela da estação em vez de desfazê-lo.

## Impact

- Alterados: `src/http/websocket/protocol.ts` (nova mensagem), `src/http/websocket/notifications.ts` (`notifySessionStarted` + `deliver` compartilhado), `src/http/websocket/index.ts` (reexport), `src/http/core/lawyers/release-computer.ts` (disparo, `notified`, guarda do `updateMany`).
- Contrato HTTP: **nenhuma rota nova**. A resposta do `release-computer` ganha um campo — mudança aditiva; cliente que ignora campo desconhecido não percebe.
- Banco: nenhuma migração.
- Configuração: nenhuma variável de ambiente nova.
- Documentação: `docs/DOC.md` (contrato que o Desktop implementa) e `docs/ROADMAP.md`.

## Behavior Change

O Desktop passa a receber uma ordem que antes não existia: **abrir**. Até aqui todo evento do servidor pedia para desfazer algo já visível na tela; este pede para criar sessão do nada, e a estação precisa tratá-lo como fonte da verdade — sem chamar `release-computer` de volta.

O eco vale aqui como valia no encerramento, e pelo mesmo motivo: quando é o quiosque que libera, o `session_started` chega pelo socket **antes** da resposta HTTP. Se o Desktop abrir a tela nos dois caminhos sem comparar o `sessionId`, reinicia a contagem ou duplica a janela para o advogado(a) que acabou de digitar os dados.

## Known Limitations

1. **Estação offline não abre sessão nenhuma, nem depois.** É a limitação que mais dói nesta change, porque a liberação pelo painel é feita justamente por quem não vê a máquina. Sem snapshot no `register`, o PC que estava desligado volta trancado com o banco dizendo `inUse: true`. O `notified: false` na resposta HTTP é paliativo: transfere o problema para o funcionário, que precisa ir até lá. O snapshot continua sendo o próximo ciclo, e agora é o item mais urgente do canal.

2. **O `lawyerName` é o primeiro dado pessoal a trafegar pelo canal.** Até aqui só circulavam identificadores opacos. Quem se registrar como `AA-BB-CC-DD-EE-01` recebe o nome de quem foi liberado naquela máquina — enquanto o `macCode` for afirmação do cliente (sem TOFU), isso é assumido conscientemente: é o mínimo para a tela de boas-vindas, e CPF, OAB e e-mail ficam de fora de propósito.

3. **Liberação pelo painel não tem autoria registrada.** A rota é a mesma do quiosque e não exige JWT — o banco não sabe se quem liberou foi o advogado(a) na máquina ou o funcionário no balcão. Auditoria de quem liberou exige coluna nova e autenticação na rota; ficou fora desta change de propósito, para não misturar o transporte com o modelo.

4. **`notified: true` não prova que a tela abriu.** Prova que o frame saiu por um socket aberto. Uma estação travada entre receber e desenhar continua trancada. Confirmação de verdade exigiria a estação responder — outro ciclo.

5. **A corrida com o cron ficou coberta só no ramo de expiração.** O `count` do `updateMany` impede o aviso duplicado ali. Na abertura não existe corrida equivalente: a sessão é criada por esta requisição e o `sessionId` nasce único.
