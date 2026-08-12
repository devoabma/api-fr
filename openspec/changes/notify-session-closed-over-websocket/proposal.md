## Why

O canal `/ws/computers` existe desde a `websocket-server-foundation`, mas só sabe dizer "estou aqui": a estação se registra e o socket fica guardado no mapa sem que nada trafegue por ele. O transporte está pronto e vazio.

O primeiro evento que precisa dele é o **fim da sessão**, e por um motivo concreto: hoje quem decide que a sessão acabou é sempre o servidor — a rota `POST /lawyers/close-computer/:sessionId` (painel ou o próprio quiosque) e o cron `auto-close-sessions` — mas **o Desktop só descobre quando tenta agir**. Enquanto isso ele mantém a tela de sessão de pé em cima de uma sessão que não existe mais no banco.

Duas consequências que já dá para prever na sala:

- **O funcionário encerra pelo painel e a máquina não obedece.** A sessão morre no banco, o computador volta a `inUse: false`, mas a tela do advogado continua lá até ele mesmo fechar. O painel diz uma coisa, a máquina mostra outra.
- **Relógio atrasado vira sessão fantasma.** O corte de tempo do cron é feito com o relógio do servidor; o Desktop conta com o dele. Uma máquina alguns minutos atrasada segue exibindo tempo restante depois de o servidor já ter fechado tudo.

O `TODO: Lançamento do WebSocket para notificar o Desktop Client`, que existia em `auto-close-sessions.cron.ts` desde que o job foi escrito, é exatamente este buraco.

## What Changes

- **`src/http/websocket/notifications.ts` (novo)**: a camada por onde rotas e jobs falam com as estações. `notifySessionClosed(input)` monta a mensagem, entrega e **nunca lança**; devolve `boolean` só para o log distinguir entregue de estação offline.
- **Mensagem `session_closed` no protocolo** (`protocol.ts`), como novo membro da união `ServerMessage`:

  ```json
  {
    "type": "session_closed",
    "macCode": "AA-BB-CC-DD-EE-01",
    "sessionId": "clx8f2k9c0000abcd1234efgh",
    "reason": "manual",
    "closedAt": "2026-08-12T18:32:10.114Z",
    "remainingTime": 95
  }
  ```

- **`SESSION_CLOSED_REASONS`** como objeto `as const` com dois motivos: `manual` (rota `close-computer`) e `expired` (cron). O motivo muda **só o texto na tela** do Desktop — a ação é a mesma nos dois casos.
- **Dois disparos**:

  | Origem | `reason` | `remainingTime` |
  | --- | --- | --- |
  | `src/http/core/lawyers/close-session.ts` | `manual` | saldo calculado na própria rota |
  | `src/http/jobs/auto-close-sessions.cron.ts` | `expired` | `0` — o job zera a cota junto com o encerramento |

- **`macCode` e `sessionId` viajam na mensagem de propósito**, mesmo sendo redundantes com o roteamento: são as duas conferências que o Desktop faz antes de fechar a tela (máquina certa, sessão certa).
- **`macCode` passa a ser selecionado** nas consultas da rota e do job — é a chave do mapa de conexões.
- **`closeSession` do cron passa a receber um objeto** (`ExpiredSession`) em vez de quatro posicionais: com `computerId`, `macCode` e `lawyerId` seguidos, trocar dois de lugar não quebraria o build.

## Capabilities

### Modified Capabilities
- `websocket-gateway`: o canal deixa de ser só registro e passa a transportar o primeiro evento de negócio — o encerramento de sessão, empurrado para a estação dona da máquina.

## Impact

- Novo: `src/http/websocket/notifications.ts`.
- Alterados: `src/http/websocket/protocol.ts` (mensagem e motivos), `src/http/websocket/index.ts` (reexport), `src/http/core/lawyers/close-session.ts`, `src/http/jobs/auto-close-sessions.cron.ts`.
- Contrato HTTP: **nenhuma rota nova nem alterada**. A resposta do `close-computer` continua idêntica.
- Banco: nenhuma migração.
- Configuração: nenhuma variável de ambiente nova.
- Documentação: `docs/DOC.md` (protocolo que o Desktop implementa) e `docs/ROADMAP.md`.

## Behavior Change

Para quem consome a API por HTTP, nada muda. Para quem está conectado no canal, aparece um `type` que antes não existia — por isso o Desktop precisa tratar `type` desconhecido ignorando, e não quebrando.

Um efeito de ordem que vale destacar porque surpreende: **o evento costuma chegar antes da resposta HTTP** de quem pediu o encerramento. Quando o próprio Desktop chama `close-computer`, o socket já está aberto e entrega na hora, enquanto a resposta ainda está voltando pela requisição. Se ele tratar todo `session_closed` como "encerrado pela administração", vai mostrar esse aviso ao advogado que acabou de clicar em "Encerrar" na própria máquina.

## Known Limitations

1. **Entrega não é garantida e não há repetição.** Estação offline no momento do encerramento perde o evento para sempre — o `register` ainda não devolve o retrato do estado atual (`snapshot`, próximo ciclo). A rede de segurança continua sendo o relógio do Desktop: quando ele zera, o `close-computer` responde `400` dizendo que a sessão já acabou, e esse `400` deve ser tratado como sucesso.

2. **A entrega não participa da transação.** O aviso sai depois do commit, de propósito: falha de socket não pode transformar em erro 500 uma operação que já foi gravada. O preço é o caso oposto — encerramento gravado e aviso não entregue — que é justamente o que o item 1 cobre.

3. **O `macCode` continua sendo afirmação do cliente.** Quem se registrar como `AA-BB-CC-DD-EE-01` recebe os eventos daquela máquina. O `session_closed` não carrega dado sensível (o `sessionId` é um cuid opaco e não abre nada sozinho), então o canal segue dentro do limite aceito na fundação, mas a credencial de estação (TOFU) continua sendo pré-requisito para eventos com dados do advogado.

4. **Um evento atrasado poderia encerrar a sessão seguinte.** É por isso que o `sessionId` viaja na mensagem: a conferência local do Desktop é o que impede o estrago. O servidor não tem como resolver isso sozinho enquanto não houver `seq` monotônico por estação.

5. **No cron, uma falha entre o `updateMany` e o `$transaction` deixa o aviso sem sair.** A sessão fica encerrada, o `catch` do laço registra o erro, e o Desktop cai no caminho do item 1. Não vale compensar aqui: reenviar sem saber o estado final mandaria informação errada.
