## Why

`POST /lawyers/release-computer` é a única rota do sistema cuja mensagem de erro é lida **pelo advogado(a), em pé, na tela do computador da sala** — não por um desenvolvedor no log nem por um funcionário no painel. As mensagens atuais foram escritas do ponto de vista de quem implementou a regra, e isso aparece em três lugares:

1. **Expõem o motivo financeiro em tela pública.** `"Advogado(a) inadimplente. Regularize sua situação financeira na OAB."` aparece num monitor dentro de uma sala compartilhada, com fila atrás. É uma informação pessoal anunciada para quem estiver por perto.
2. **Apontam para o lugar errado.** As mensagens mandam falar com "a OAB", termo que não identifica ninguém em concreto: quem atende registro é a Seccional do advogado(a), e pendência financeira é o Setor Financeiro dela. Advogado(a) de outra Seccional que use a sala recebia orientação que não se aplica a ele.
3. **Terminam sem saída.** `"Computador não encontrado."`, `"Computador em manutenção."` e `"Consulta indisponível..."` descrevem o estado e param aí. Quem está na frente do computador não sabe se espera, se muda de máquina ou se procura alguém.

Esta entrega é de **texto**: nenhuma validação, status code ou regra muda.

## What Changes

Reescrita das mensagens de erro voltadas ao advogado(a) em `src/http/core/lawyers/release-computer.ts`:

| Situação | Antes | Depois |
| --- | --- | --- |
| Consulta ao Protheus falhou / payload fora do schema (`404`) | `Consulta indisponível ou advogado(a) não encontrado.` | `Consulta indisponível ou advogado(a) não encontrado. Tente novamente mais tarde.` |
| `situacao` fora das liberadas (`400`) | `Advogado(a) inativo, entre em contato com a OAB.` | `Advogado(a) não ativo. Para mais informações, entre em contato com a sua Seccional.` |
| Inadimplência com bloqueio vigente (`400`) | `Advogado(a) inadimplente. Regularize sua situação financeira na OAB.` | `Não foi possível prosseguir com a liberação. Para mais informações, entre em contato com o Setor Financeiro da sua Seccional.` |
| CPF/OAB/nascimento divergentes (`400`) | `Dados informados não conferem com os dados junto a OAB.` | `Informações fornecidas não conferem com os dados junto a sua Seccional. Por favor, verifique e tente novamente.` |
| Computador inexistente (`404`) | `Computador não encontrado.` | `Computador não encontrado. Tente novamente mais tarde.` |
| Computador em manutenção (`400`) | `Computador em manutenção.` | `Computador em manutenção. Entre em contato com a administração.` |

Três princípios, aplicados de forma consistente:

- **Toda mensagem termina com o próximo passo** — tentar de novo, conferir os dados, ou procurar quem resolve.
- **O destinatário é nomeado** — "sua Seccional", "Setor Financeiro da sua Seccional", "a administração" (esta última é a sala/OAB local, quem tem acesso físico à máquina).
- **A mensagem de inadimplência não diz o motivo.** A recusa é informada; a causa fica com quem pode tratá-la. O advogado(a) que ligar para o Setor Financeiro descobre em canal privado; quem está atrás dele na fila não descobre nada.

## Capabilities

### Modified Capabilities
- `lawyer`: as recusas da liberação de computador passam a seguir um padrão explícito de mensagem — sem exposição do motivo financeiro em tela pública, com destinatário nomeado e próximo passo. Os status codes e as condições que os disparam permanecem idênticos.

## Impact

- Alterado: `src/http/core/lawyers/release-computer.ts` (somente literais de string).
- Contrato HTTP: mesmos status codes, mesmo formato de resposta (`{ message }`), mesmas condições. Muda apenas o conteúdo de `message`.
- Banco: nenhuma migração.
- Clientes: **o app desktop e o front devem exibir `message` como veio da API.** Qualquer cliente que hoje compare a `message` com string fixa para decidir o que mostrar quebra silenciosamente — o tratamento correto é por status code (`400`/`404`/`429`), nunca por texto.
- `docs/DOC.md` e `docs/ROADMAP.md`: nada a alterar, nenhum dos dois cita o texto das mensagens.

## Behavior Change

Nenhuma. Uma requisição que hoje recebe `400` continua recebendo `400`, no mesmo ponto da rota, com o mesmo efeito no banco (nenhum). O que muda é o que o advogado(a) lê na tela.

## Known Limitations

1. **A mensagem de inadimplência ficou genérica o suficiente para confundir.** `"Não foi possível prosseguir com a liberação"` também descreveria outras falhas. Foi uma troca deliberada — privacidade em tela pública vale mais que precisão de diagnóstico — mas significa que, se um dia o suporte receber "não consigo liberar e não sei por quê", o log da API passa a ser a única fonte do motivo real. Hoje esse `400` não é logado com o CPF consultado; se a dúvida virar recorrente, vale registrar a recusa no servidor.

2. **"Sua Seccional" não é clicável.** A mensagem nomeia o destinatário, mas não dá telefone nem endereço. O passo seguinte natural seria a mensagem trazer o contato da Seccional do advogado(a) consultado — o payload do Protheus não devolve esse dado, então ficaria dependente de uma tabela local de contatos por Seccional. Fora do escopo desta entrega.

3. **Os textos continuam embutidos na rota.** Não existe catálogo central de mensagens. Enquanto for uma rota, é o lugar certo; se a política de copy se espalhar por outras rotas públicas (`close-computer`, `send-to-print`), o próximo passo é extrair para um módulo de mensagens e revisar todas de uma vez.
