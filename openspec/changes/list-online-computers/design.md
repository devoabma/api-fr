## Contexto

O canal `/ws/computers` mantém um `Map<macCode, ComputerConnection>` em memória (`websocket/connections.ts`), alimentado pelo `register` do Desktop e podado pelo heartbeat. Esse mapa é a única fonte que sabe quem consegue receber o `session_started` — e até aqui ele só era lido por dentro, pelo `notifySessionStarted`/`notifySessionClosed`.

O consumidor é o painel do balcão: precisa saber, por sala, quais máquinas aceitam liberação.

## Decisões

### 1. Rota nova em vez de campo em `/rooms/get-all`

Embutir um `online` no computador que já vem dentro da sala pouparia uma requisição ao painel. Foi recusado porque mistura tempos de vida diferentes: o inventário muda quando alguém cadastra ou dá manutenção numa máquina, e a conexão muda quando alguém liga um PC. Um campo volátil dentro de uma resposta estável obriga o cliente a tratar a resposta inteira como volátil — e o `/rooms/get-all` é a resposta mais reaproveitada do painel.

Rota separada mantém cada coisa com o próprio ciclo de revalidação e deixa a falha isolada: se a consulta de conexão cair, a grade continua de pé.

### 2. Só os conectados na resposta

A alternativa seria devolver todos os computadores da sala com um booleano. Devolver só os conectados deixa o significado explícito — a lista É o registro — e evita a pergunta "esse `false` é offline ou é máquina que não existe mais no mapa?". O cliente cruza por `id` com o inventário que já tem em mãos.

### 3. `/online/:roomId?` e não `?roomId=`

O módulo `computers` usa query string em `/get-all`, mas aquela rota é de inventário e ADMIN-only. Esta é listagem de operação com escopo por papel, exatamente como `/lawyers/get-all-releases/:roomId?` e `/printers/get-all/:roomId?` — segue o idioma dessas, que é o que o painel já consome.

### 4. Escopo por papel, não `checkIfEmployeeIsAdmin`

`/computers/get-all` é ADMIN-only e por isso o painel nunca pôde usá-la (o balcão é MEMBER). Repetir a trava aqui entregaria uma rota inútil para quem mais precisa dela. Vale o mesmo modelo da manutenção: ADMIN em qualquer sala, MEMBER nas suas — e sala de fora simplesmente não retorna nada, em vez de `401`, para não transformar a listagem em oráculo de existência de sala.

### 5. Curto-circuito com o mapa vazio

Fora do horário de atendimento (e logo após cada reinício da API) o mapa está vazio. Sem a guarda, cada polling do painel viraria um `WHERE macCode IN ()` no Postgres. Com ela, a resposta sai sem tocar no banco.

### 6. `connectedAt` na resposta

Custa nada — já está no registro — e responde a pergunta que aparece no balcão quando a máquina se comporta mal: "faz quanto tempo que ela está de pé?". É a conexão atual, não o uptime do PC: reconectou, zerou.

## Riscos

- **Falso positivo por até ~60s** (heartbeat de 30s + o ciclo de tolerância). O cliente não pode tratar a lista como garantia: o `notified` da liberação continua sendo a confirmação final.
- **Poll frequente numa rota que lê o banco.** É uma consulta por `macCode IN (...)` com índice único na coluna, e o resultado é pequeno (máquinas de uma sala). Se o painel apertar o intervalo, o custo é linear no número de estações conectadas — não no histórico.
