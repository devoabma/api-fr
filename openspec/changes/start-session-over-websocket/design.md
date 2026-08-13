# Design

## 1. A decisão principal foi não criar rota

O pedido era "liberar pelo painel". A leitura ingênua é uma rota nova, autenticada, para o funcionário — e ela duplicaria as ~200 linhas do `release-computer`: consulta à OAB, situação do registro, adimplência, conferência de CPF/OAB/nascimento, sala ativa, manutenção, computador livre, cota do dia. Duas cópias dessa regra divergem no primeiro ajuste que alguém fizer com pressa em uma delas.

A rota já aceita qualquer chamador: recebe `macCode` no corpo e não pergunta quem está do outro lado. O que faltava não era um jeito de o painel pedir a liberação — era o servidor conseguir **contar para a máquina** o que acabou de gravar. Por isso esta change inteira mora no canal, e a rota só ganhou o disparo.

O preço está anotado na limitação 3 do `proposal.md`: sem rota autenticada, o banco não registra quem liberou. É uma dívida de auditoria, não de funcionamento, e o dia em que ela for paga a regra continua num lugar só.

## 2. `session_started` e não `computer_released`

O roadmap previa os dois nomes. `computer_released` descreve o que aconteceu com o **equipamento**; `session_started` descreve o que aconteceu com a **sessão** — que é a entidade que o Desktop desenha na tela, conta o tempo e encerra.

Vale mais do que preferência de vocabulário: o par `session_started` / `session_closed` deixa explícito que os dois eventos falam do mesmo objeto e que um desfaz o outro. `computer_released` / `session_closed` pareceriam assuntos diferentes, e a primeira dúvida de quem implementa o cliente seria se ele precisa tratar os dois estados separadamente.

## 3. `expiresAt` como instante absoluto, não como duração

A mensagem leva `remainingTime` (minutos) e `expiresAt` (UTC). Parece redundante e não é: `remainingTime` é para exibir ("você tem 2 horas"), `expiresAt` é para contar.

Se o Desktop somasse `remainingTime` ao próprio relógio, ele e o servidor divergiriam por tudo que acontece numa sala de fórum: máquina com horário errado, PC que suspende, contagem parada enquanto a janela estava minimizada. Quem encerra é o cron, com o relógio do servidor — então a contagem na tela precisa nascer do mesmo instante que o servidor vai usar. É o mesmo `expiresAt` que a resposta HTTP já devolvia; aqui ele só passou a viajar também pelo socket.

## 4. O eco é aceito, não evitado

Quando o quiosque libera a si mesmo, ele recebe de volta um evento sobre a sessão que ele mesmo abriu — frequentemente antes da resposta HTTP chegar.

Dava para evitar: bastaria a rota saber qual conexão pediu a liberação e pular aquele socket. Não vale o preço. Isso exigiria amarrar requisição HTTP a conexão WebSocket (um identificador de conexão viajando no corpo, ou casar por `macCode` e torcer), e criaria dois caminhos de abertura de tela para testar em vez de um. Pior: a rota deixaria de ser indiferente a quem chamou, que é exatamente a propriedade que fez a decisão 1 funcionar.

O caminho mais barato é o cliente comparar o `sessionId` e ignorar o que já está em tela — a mesma conferência que ele já faz no `session_closed`. Uma regra, dois eventos.

## 5. `notified` na resposta, e por que só agora

O `close-computer` não devolve nada parecido, e está certo: encerrar tem rede de segurança dos dois lados (o relógio do Desktop zera, o `close-computer` responde `400` para sessão já encerrada). Abrir não tem nenhuma. Se o evento não chega, ninguém percebe — a máquina fica trancada com o banco dizendo que está em uso, e o advogado(a) está de pé na frente dela.

Quem precisa dessa informação é o painel, porque é o único chamador que não enxerga a máquina. O campo é `boolean` e não um objeto de status de propósito: a única decisão que ele habilita é "vá até a máquina ou não".

E ele diz menos do que parece — que o frame saiu por um socket aberto, não que a tela abriu (limitação 4). Prometer mais exigiria confirmação da estação, que é outro ciclo.

## 6. O ramo da expiração ganhou aviso e guarda

O `release-computer` tem um caminho que **encerra** sessão: chegou uma liberação para um advogado(a) cuja sessão em curso já passou do saldo do dia. Ele gravava o encerramento e voltava `200` sem avisar a estação — buraco que a change passada teria fechado se estivesse olhando para esta rota.

O aviso entrou com `reason: expired`, porque é a mesma natureza do corte do cron: a cota acabou. `manual` está reservado para alguém ter pedido o encerramento, e ninguém pediu — pediram uma liberação.

Junto veio a troca de `update` por `updateMany` com `endedAt: null`. Este ramo trata justamente a sessão vencida, que é a mesma que o cron está prestes a fechar no próximo minuto: a corrida não é teórica, é o caso típico. Sem o filtro, os dois caminhos gravariam `endedAt` e mandariam `session_closed` para o mesmo `sessionId`. Com ele, o `count` diz quem realmente encerrou e só esse avisa — a trava que o cron já usava, agora dos dois lados.

## 7. `deliver` compartilhado em vez de duas funções paralelas

`notifySessionStarted` e `notifySessionClosed` fazem a mesma coreografia: montar, entregar, distinguir no log estação offline (`warn`) de falha de transporte (`error`), nunca lançar. Com a segunda notificação a duplicação ficaria evidente — e a parte que se perde ao duplicar é justamente o `try/catch`, que é silencioso quando falta.

O `deliver` recebe a mensagem já pronta e uma descrição para o log. As funções públicas continuam sendo o vocabulário do domínio (`Date` na entrada, ISO na borda) e o `deliver` cuida da entrega. Quando a entrega mudar — várias instâncias, fila, Redis — é uma função que muda.

## 8. O que o `lawyerName` custa

Até aqui o canal só carregava identificador opaco. O nome do advogado(a) é a primeira informação pessoal que sai por um canal onde `macCode` ainda é afirmação do cliente: quem se registrar como uma estação recebe o nome de quem for liberado nela.

Foi aceito por ser o mínimo para a tela de boas-vindas — e o limite ficou escrito no próprio tipo, em `protocol.ts`: CPF, e-mail e OAB não passam por aqui. É também mais um argumento para a credencial de estação (TOFU) sair do gancho e virar código, agora que o canal transporta algo que não é só um cuid.
