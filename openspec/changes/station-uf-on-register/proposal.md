## Why

A change `station-label-on-register` tirou a sala e o número do arquivo local do quiosque: o servidor passou a responder quem é a máquina no próprio `register`. Sobrou uma pergunta no instalador do Desktop — a **UF**, um campo de duas letras pré-preenchido com `MA` e sem validação nenhuma. É a última coisa que alguém digita à mão em cada instalação, e a que menos aparece quando erra.

A UF não é rótulo de tela. O atualizador do Desktop usa o estado da máquina para decidir se ela entra numa publicação de versão dirigida a um estado. Sigla errada no quiosque significa máquina que **não recebe a atualização que deveria** — e não falha em lugar nenhum, ninguém percebe.

O servidor não sabia responder: não havia estado em lugar nenhum do modelo. `Rooms` guardava nome, slug, tempo padrão e descrição. Este é o campo que faltava para o `registered` fechar a identidade da estação.

## What Changes

- **`rooms.uf`**: coluna nova, `CHAR(2)`, **NOT NULL e sem default no banco**. A migração cria a coluna com `DEFAULT 'MA'` só para preencher as salas existentes (todas do Maranhão) e derruba o default em seguida.
- **`POST /rooms/create`**: corpo aceita `uf`, validada contra as 27 siglas do Brasil, com padrão `MA` **no schema Zod**. O painel que ainda não envia o campo continua cadastrando sala normalmente — não exige deploy casado.
- **`PATCH /rooms/update/:id`**: `uf` opcional e **sem padrão**. Campo ausente mantém o estado atual, para que editar o nome de uma sala de outro estado não a devolva para `MA`.
- **`GET /rooms/get-all`**: cada sala devolve `uf`, para o painel exibir e editar.
- **`registered` do WebSocket**: passa a incluir `uf`, lida da sala do computador identificado pelo `macCode`.
- **`ufSchema`** (`src/utils/validations/uf.ts`): lista fechada das 27 UFs, normalização de caixa e espaços, e a lista de valores no `describe` para o Swagger.

## Capabilities

### Modified Capabilities
- `room`: a sala passa a ter estado. O campo é obrigatório no modelo e opcional nos dois contratos HTTP, com padrão só na criação.
- `websocket-gateway`: o rótulo devolvido no registro deixa de ser só "onde na OAB" e passa a ser "onde no país" — a primeira informação do cadastro que o Desktop **persiste** em vez de só exibir.

## Impact

- Banco: **uma migração** (`20260825120000_adicionada_uf_na_sala`). Aditiva, com backfill; nada é reescrito além da coluna nova.
- Código: `prisma/schema.prisma`, `src/utils/validations/uf.ts` (novo), `rooms/create.ts`, `rooms/update.ts`, `rooms/get-all.ts`, `websocket/protocol.ts`, `websocket/handler.ts`.
- Contrato HTTP: **aditivo nos dois sentidos**. Cliente antigo não manda `uf` e a criação assume `MA`; cliente antigo ignora o `uf` que passa a vir na listagem.
- Contrato do canal: **aditivo**. Desktop antigo ignora a chave nova; nenhum tipo de mensagem, rota ou versão de protocolo mudou.
- Documentação: `docs/DOC.md` (contrato do `registered`), `docs/DATABASE.md` (campo em `rooms`), `docs/ROADMAP.md`.

## Behavior Change

O instalador do Desktop perde a página "Ajustes da estação". Cadastrar a sala no painel passa a ser suficiente para a máquina saber sala, número e estado.

Como a coluna é `NOT NULL`, o `registered` ganha uma garantia que o Desktop pode assumir em código: `roomName`, `number` e `uf` **vêm juntos ou não vem nenhum**. "Veio a sala mas não veio o estado" deixa de ser um caso possível, e a ausência passa a significar uma coisa só — MAC fora do cadastro ou banco indisponível.

## Known Limitations

1. **A UF só chega na conexão seguinte.** Corrigir o estado de uma sala no painel não alcança as estações já conectadas. Vale o mesmo raciocínio do rótulo: empurrar na hora exige um evento novo (`station_updated`), que só se paga quando isso virar rotina.

2. **Máquina que nunca conectou não tem UF.** Ela não casa com publicação dirigida a estado até o primeiro registro bem-sucedido; segue recebendo as ondas por percentual. É consequência aceita, não defeito — do lado do Desktop a UF vale a partir da execução seguinte à que a recebeu, porque a decisão de atualizar acontece no arranque, antes de o canal conectar.

3. **O padrão `MA` na criação é conveniência, não verdade.** Uma seccional de outro estado que use esta instância precisa mandar `uf` explicitamente; esquecer significa sala marcada como Maranhão. O default vive no Zod justamente para poder sair sem migração quando isso deixar de ser verdade.

4. **A UF sai por um canal sem identidade verificada.** Quem afirmar um `macCode` recebe a sala e o estado daquela máquina. Informação de baixo valor, mas soma na conta que o canal já devia: a credencial de estação (TOFU) continua pendente.

5. **A `version` continua sem ser persistida.** O `register` a recebe e só escreve em log. O painel de "qual versão em cada sala" segue esperando coluna em `computers` — de fora desta change de propósito.
