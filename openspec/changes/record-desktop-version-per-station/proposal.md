## Why

O Desktop já informa a versão instalada a cada conexão: o `register` carrega `version` desde sempre, o schema Zod a valida e saneia, e o `handler` a escreve no log. Ela morre ali. A change `station-uf-on-register` fechou listando isso como limitação conhecida ("A `version` continua sem ser persistida... o painel de qual versão em cada sala segue esperando coluna em `computers`").

A distribuição de versão do Desktop é feita em onda: publica-se para uma fatia do parque, observa-se, e só então sobe a fatia. A parte de **observar** não existe do lado da API — o cliente decide sozinho se atualiza, e não há como conferir o resultado a não ser ligando para as salas.

Com a versão guardada, três situações passam a ser visíveis e hoje não são:

1. **A onda chegou.** Publicou para 10%: dá para ver quais 10%.
2. **Uma máquina ficou para trás.** Todas as salas subiram e uma continua na versão velha — provavelmente a atualização falhou nela e ela se protegeu voltando atrás. É o sinal de que algo deu errado, e hoje ele é invisível.
3. **Uma versão precisa sair de campo.** Saber quantas máquinas ainda estão nela decide se dá para forçar a saída ou se é melhor esperar.

Vale inclusive para máquina desligada: fica registrado o que ela informou da última vez que esteve no ar, que é exatamente o que o suporte precisa saber **antes** de ligar para a unidade.

## What Changes

- **`computers.appVersion`** (`VARCHAR(40)`, nulo) e **`computers.appVersionReportedAt`** (`TIMESTAMP(3)`, nulo): a última versão informada e o carimbo de quando foi informada.
- **`register` do WebSocket**: passa a gravar o par, em paralelo com a busca do rótulo, sem atrasar o ack e sem poder derrubar o registro.
- **`GET /rooms/get-all`**: cada computador da sala devolve `appVersion` e `appVersionReportedAt` — é a rota que alimenta o painel (`/computers/get-all` é ADMIN-only e o painel roda como MEMBER).
- **`GET /computers/get-all`**: mesmos dois campos no inventário ADMIN, que é onde a pergunta "quantas máquinas ainda estão na 1.0.6" é respondida.
- **`registerMessageSchema`**: o saneamento passa a devolver `undefined` quando não sobra nada (`"###"` virava string vazia, que seria gravada como se fosse versão).
- **Painel (`web-fr`)**: o `ComputerCard` mostra `v1.0.7` no cabeçalho, com a data em tooltip, e destaca em âmbar a estação que está atrás das irmãs de sala.

## Capabilities

### Modified Capabilities
- `computer`: a máquina passa a guardar a versão do aplicativo instalado nela, e as duas listagens a devolvem.
- `websocket-gateway`: o registro deixa de ser só identificação e vira também coleta — o primeiro dado que o canal **escreve** no cadastro, e não apenas lê dele.

## Impact

- Banco: **uma migração** (`20260825170000_versao_do_desktop_na_estacao`). Aditiva, duas colunas nulas, **sem backfill** — diferente da UF, aqui não existe valor razoável para chutar: inventar uma versão seria exatamente o erro que o campo existe para expor.
- Código: `prisma/schema.prisma`, `websocket/protocol.ts`, `websocket/handler.ts`, `rooms/get-all.ts`, `computers/get-all.ts`.
- Contrato HTTP: **aditivo**. Cliente que ignora campos desconhecidos segue funcionando.
- Contrato do canal: **inalterado**. Nenhum campo novo trafega; o que já chegava passa a ser guardado.
- Escrita: uma `updateMany` por registro de estação — ou seja, por conexão e reconexão, não periodicamente. Em regime, é uma escrita por máquina por dia.
- Painel: `web-fr` (`server/rooms/get-all.ts`, `panel/_data/computer-view.ts`, `panel/_components/computer-card.tsx`).

## Behavior Change

A pergunta "em que versão está cada sala?" deixa de exigir uma ligação para a unidade. E uma estação que voltou sozinha para a versão anterior — o cliente faz rollback quando a nova falha três vezes seguidas — passa a se denunciar no card, em vez de ficar invisível até alguém reclamar.

## Design Decisions

**O nome do carimbo é a decisão mais importante desta change.** `appVersionReportedAt` significa *quando ela informou*, não *quando esteve viva*. A versão só viaja no `register`, isto é, a cada conexão: uma estação 30 dias no ar sem cair tem carimbo de 30 dias atrás e está **online agora**. Se a coluna se chamasse `lastSeenAt`, o painel mandaria ligar para uma unidade que está funcionando. Quem responde "está conectada?" continua sendo o mapa em memória do canal, exposto por `GET /computers/online/:roomId?` — são dois dados diferentes e nenhum se deriva do outro.

**Gravação crua, sem comparar.** O cliente guarda o executável anterior ao trocar de versão e volta para ele sozinho se a nova não subir em três tentativas, pondo a que falhou em quarentena naquela máquina. Uma estação pode legitimamente reportar `1.0.7` hoje e `1.0.6` amanhã. Qualquer lógica só-para-frente (`if (nova > antiga)`, `GREATEST`) transformaria o caso mais importante de enxergar em dado errado.

**Ausência preserva.** Existe um interruptor local (`enviarVersaoNoRegistro`), ligado por padrão e gravado ligado pelo instalador, mas editável à mão. Desligado, o campo sai fora do JSON — não vem vazio nem nulo. Zerar a coluna nesse caso apagaria a única pista que o suporte tem sobre a máquina, então registro sem versão sai do `recordReportedVersion` sem tocar em nada.

**`updateMany` e não `update`.** O canal aceita `macCode` que não está no cadastro (e a change do rótulo já tratava isso como caso normal). `update` responderia `P2025` ali; `updateMany` afeta zero linhas e cala.

**Em paralelo com o rótulo.** A versão é acessória e o ack é o que destrava a tela da estação. As duas idas ao banco correm num `Promise.all`, e nenhuma das duas rejeita — o padrão "nunca lança" que `findComputerLabel` já seguia.

**A régua da defasagem no painel é a própria sala.** O painel não sabe o que foi publicado, mas sabe o que as vizinhas estão rodando. Comparar cada estação com a maior versão da sala faz a máquina atrasada aparecer sozinha, sem a API precisar de um conceito de "versão oficial" que ninguém mantém.

## Known Limitations

1. **O parque só se descreve depois de reconectar.** Toda máquina fica `NULL` até o primeiro `register` posterior ao deploy. Como a troca de versão relança o aplicativo, isso se resolve na primeira publicação — mas na janela entre o deploy e ela, o painel mostra `v—` em tudo.

2. **Estação com envio desligado é indistinguível de estação que nunca conectou.** As duas ficam `NULL`. Separar exigiria o cliente mandar um sinal explícito de "não vou informar", o que contraria o próprio desenho do interruptor (o campo *sai fora* do JSON). O tooltip do painel diz os dois motivos possíveis em vez de afirmar um.

3. **A versão vem por um canal sem identidade verificada.** Quem afirmar um `macCode` pode gravar qualquer texto de 40 caracteres no cadastro daquela máquina. O saneamento limita o estrago a `[\w.+-]`, mas a garantia de verdade só chega com a credencial de estação (TOFU) — que segue pendente e agora protege uma escrita, não só uma leitura.

4. **Ordenação e agrupamento por versão são responsabilidade do cliente.** A coluna é texto: `ORDER BY app_version` mentiria (`'1.0.10' < '1.0.7'`). O painel usa comparador por segmento; qualquer relatório futuro precisa fazer o mesmo ou a API ganhar colunas numéricas — o que não se paga hoje.

5. **A leitura de parque inteiro ainda não existe.** Dá para ver a versão de cada máquina, sala por sala. "Quantas estações em cada versão, em todo o estado" exige um agregado que nenhuma rota faz — o `/computers/get-all` devolve tudo e deixa a conta para o cliente.
