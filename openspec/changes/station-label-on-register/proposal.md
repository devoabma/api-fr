## Why

O canal já sabe quem é a estação — o `macCode` chega no `register`, é normalizado e bate com `computers.macCode`. O cadastro daquele MAC diz em que sala o computador está e que número ele tem. Nada disso volta para a máquina.

O resultado é que a sala e o número precisam ser **digitados à mão na instalação de cada quiosque** e ficam num arquivo local. São centenas de instalações previstas, e o custo aparece em dois lugares:

1. **Erro de digitação em escala.** Um rótulo errado não falha em lugar nenhum: a máquina sobe, conecta, funciona. O defeito só aparece quando um advogado(a) reclama que a tela mostra a sala errada.

2. **O rótulo envelhece sozinho.** Remanejar um computador de sala é operação de painel, dois cliques. A máquina continua exibindo a sala antiga até alguém ir presencialmente corrigir o arquivo — exatamente o deslocamento que o canal permanente existe para eliminar.

A informação certa já está no servidor, na hora certa (o `register` é a primeira coisa que acontece). Só falta devolvê-la.

Na mesma conversa veio um segundo pedido do cliente: confirmar que o `register` aceita campos que a API ainda não conhece, porque o Desktop está pronto para informar a versão instalada e o envio está **desligado** por medo de a validação recusar a mensagem e a estação perder o canal.

## What Changes

- **`registered` passa a devolver o rótulo da estação**, com dois campos novos:

  ```json
  {
    "type": "registered",
    "macCode": "AA-BB-CC-DD-EE-01",
    "connectedAt": "2026-08-14T14:14:30.974Z",
    "roomName": "SALA DA TRIBUNAL DO TRABALHO",
    "number": 3
  }
  ```

  Ambos **opcionais no protocolo**: MAC fora do cadastro ou banco indisponível não impedem o registro, e o Desktop cai na configuração local, como já faz.

- **Consulta ao cadastro no `handler.ts`**, por `macCode`, trazendo `number` e o `name` da sala. Roda **depois** de a conexão entrar no mapa em memória, e o ack só sai se o socket ainda for o dono da chave.

- **`version` opcional no `register`**, declarado no schema, saneado e escrito apenas no log do registro. Não há coluna nova nem exibição no painel — isso fica para quando houver pedido.

- **Nenhuma rota nova, nenhuma migração, nenhuma variável de ambiente.**

## Capabilities

### Modified Capabilities
- `websocket-gateway`: o `register` deixa de ser só identificação e passa a ser também **descoberta** — a estação pergunta quem ela é e o servidor responde. É a primeira informação que trafega do cadastro para a máquina fora de um evento de sessão.

## Impact

- Alterados: `src/http/websocket/protocol.ts` (campos no `registered`, `version` no `register`), `src/http/websocket/handler.ts` (consulta ao cadastro, ack com rótulo).
- Contrato do canal: **aditivo**. Desktop antigo ignora os campos novos; API nova com Desktop antigo não muda nada. Não exige deploy coordenado em nenhuma direção.
- Banco: nenhuma migração. Uma consulta a mais por conexão de estação — evento raro (reconexão), não caminho quente.
- Documentação: `docs/DOC.md` (contrato que o Desktop implementa).

## Behavior Change

O arquivo de configuração local do Desktop deixa de ser a fonte da verdade sobre onde a máquina está e vira **fallback**. Instalar um quiosque novo passa a não exigir que o instalador saiba a sala: basta cadastrar o computador no painel e rodar o instalador. Remanejamento feito no painel chega à tela na conexão seguinte, sem visita.

## Known Limitations

1. **O rótulo só se atualiza na reconexão.** Um remanejamento feito com a estação conectada não chega até ela reconectar (queda de rede, reinício da máquina ou da API). Empurrar a mudança na hora exigiria um evento novo disparado pelo `update-computer` — vale quando o remanejamento com máquina ligada virar rotina, não antes.

2. **O rótulo é entregue por um canal sem identidade verificada.** Quem se registrar como `AA-BB-CC-DD-EE-01` recebe a sala e o número daquela máquina. É informação de baixo valor (está na etiqueta física do equipamento), mas entra na mesma conta do `lawyerName`: o canal continua devendo a credencial de estação (TOFU).

3. **MAC não cadastrado continua conectando.** O canal não passou a exigir cadastro — só deixou de ter o que responder. Recusar seria uma mudança de política maior, que atropelaria a máquina ligada antes de alguém cadastrá-la; hoje o caso fica registrado em log como aviso.

4. **A `version` não é persistida.** Serve para o log e nada mais. Saber a distribuição de versões pelo painel exige coluna em `computers` e exibição na listagem — ficou de fora de propósito, para não misturar transporte com modelo.
