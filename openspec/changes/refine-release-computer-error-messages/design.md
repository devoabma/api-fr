## Contexto

A rota de liberação é a superfície pública do sistema. Quem lê suas mensagens não é funcionário treinado nem desenvolvedor com acesso a log: é o advogado(a) diante de um computador numa sala compartilhada, tentando trabalhar. Esse contexto de leitura — em pé, com pressa, possivelmente com gente ao redor — deveria ter guiado a redação desde o início, e não guiou. As mensagens antigas foram escritas junto com as validações, cada uma descrevendo a condição que acabara de ser codificada.

## Decisões

### 1. A recusa por inadimplência não diz o motivo

Esta é a única decisão desta entrega que troca uma coisa boa por outra.

O texto anterior — `"Advogado(a) inadimplente. Regularize sua situação financeira na OAB."` — é excelente por um critério: diz exatamente o que houve e o que fazer. E é ruim por outro: anuncia uma pendência financeira pessoal num monitor que outras pessoas enxergam.

Os dois critérios não podem ser satisfeitos ao mesmo tempo na mesma tela. A escolha foi privacidade, porque os custos são assimétricos:

- **Mensagem genérica, causa financeira.** O advogado(a) liga para o Setor Financeiro, descobre a pendência em canal privado, resolve. Custo: uma ligação.
- **Mensagem específica, alguém por perto lendo.** A informação já saiu, não volta. Custo: irreversível, e não é do sistema — é da pessoa.

A mensagem nomeia o **Setor Financeiro**, que é a pista suficiente: quem tem pendência entende de imediato; quem estiver lendo por cima do ombro vê uma recusa administrativa qualquer.

### 2. "Sua Seccional", não "a OAB"

"OAB" é uma instituição federada. Dizer "entre em contato com a OAB" para alguém cujo registro está irregular não informa **onde** — e a sala é usada por advogados(as) de outras Seccionais, para quem a OAB/MA não resolve nada de registro.

"Sua Seccional" é sempre correto, seja quem for o advogado(a), sem o sistema precisar saber de qual Seccional ele é.

A exceção é `"Entre em contato com a administração"`, usada nos erros de **computador** (inexistente, em manutenção). Esses não são problemas de registro: são problemas da máquina naquela sala, e quem resolve é quem tem acesso físico a ela. Manter os dois destinatários distintos é o que faz a mensagem valer alguma coisa — se tudo apontasse para "a administração", a orientação viraria ruído.

### 3. Toda mensagem termina com o próximo passo

`"Computador não encontrado."` é uma constatação. `"Computador não encontrado. Tente novamente mais tarde."` é uma instrução.

A diferença importa mais do que parece nos erros que **não são culpa do advogado(a)**. Consulta ao Protheus indisponível e `macCode` não cadastrado são falhas de infraestrutura; sem orientação, o advogado(a) tende a repetir a tentativa imediatamente, várias vezes — e a rota tem rate limit de 10 req/min por IP + macCode. A frase "tente novamente mais tarde" é, além de cortesia, a instrução que evita o `429` em cima do erro que já aconteceu.

### 4. Por que "não ativo" e não "inativo"

`SITUACOES_LIBERADAS` cobre mais de um estado válido; o complemento inclui cancelado, suspenso, licenciado. `"Advogado(a) inativo"` afirma um status específico que pode não ser o real. `"Advogado(a) não ativo"` é verdadeiro em todos os casos e continua compreensível — e a Seccional, que tem o dado exato, informa qual é.

## Alternativas descartadas

**Código de erro estruturado no payload** (`{ message, code: 'LAWYER_DEFAULTING' }`). Permitiria ao cliente escolher o texto e até esconder o motivo na tela mostrando-o só em relatório. Descartado agora: exigiria mudar o schema de resposta da rota e coordenar com dois clientes (app desktop e front) para um ganho que a mensagem já entrega. Fica anotado como o caminho natural caso os clientes precisem reagir diferente por tipo de recusa — hoje eles só exibem o texto.

**Catálogo central de mensagens.** Um módulo `messages.ts` com todas as strings da rota. Descartado por ora: com uma rota envolvida, a indireção custa mais legibilidade do que ganha. Passa a valer quando a segunda rota pública precisar da mesma política.

## Riscos

**Cliente comparando `message` por string.** Se o app desktop ou o front tiverem qualquer `if (message === '...')` ou `includes('inadimplente')` para decidir o que renderizar, essa lógica deixa de funcionar — silenciosamente, sem erro. O acoplamento é frágil de origem: o contrato é o status code, não o texto. Vale um `grep` nos dois clientes antes de considerar a entrega concluída de ponta a ponta.

**Documentação com o texto antigo.** `openspec/changes/suspend-defaulting-lawyer-block/design.md` citava a mensagem de advogado(a) inativo entre aspas. A citação foi atualizada junto com esta entrega, para que a change não descreva um comportamento que deixou de existir.
