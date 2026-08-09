## ADDED Requirements

### Requirement: Contrato de sucesso da liberação de computador

O response `200` de `POST /lawyers/release-computer` SHALL carregar tudo que o cliente precisa para conduzir a sessão sem consultar outra rota: a identidade do advogado(a), o saldo do dia e o instante em que a sessão expira.

A rota responde `200` em duas situações de significado oposto — uma liberação concedida e o encerramento de uma sessão anterior que estourou o tempo. As duas MUST permanecer distinguíveis por um campo estruturado, e os clientes MUST fazer essa distinção por `remainingTime`, nunca comparando o texto de `message`.

`remainingTime` MUST expressar o saldo do dia em minutos inteiros não negativos, e MUST ser `0` quando a resposta não concede uso.

`expiresAt` MUST ser o instante absoluto em que o servidor encerra a sessão, em ISO 8601 com indicador de UTC (`Z`). O valor MUST reproduzir a mesma conta aplicada pelo job de encerramento automático (`startedAt` somado ao saldo vigente), de modo que cliente e servidor expirem a sessão no mesmo instante. `expiresAt` MUST ser `null` quando a resposta não abre sessão nova — não existindo sessão a expirar, não existe instante de expiração a informar.

Horário local MUST NOT ser usado no contrato: o servidor opera em fuso configurado, mas o instante entregue é sempre UTC.

Alterações neste response MUST ser aditivas. Campos MUST NOT ser removidos nem renomeados sem tratar os clientes existentes, porque o serializador descarta silenciosamente o que não está declarado no schema — uma remoção não produz erro no servidor e chega ao cliente como campo ausente.

#### Scenario: Liberação concedida

- **WHEN** o advogado(a) é validado, o computador está livre e há saldo no dia
- **THEN** a API responde `200` com `sessionId` da sessão criada, `lawyerName`, `remainingTime` igual ao saldo em minutos e `expiresAt` igual a `startedAt` somado a esse saldo, em UTC

#### Scenario: Sessão anterior encerrada por tempo esgotado

- **WHEN** o advogado(a) já possuía sessão ativa no mesmo computador e o tempo decorrido alcançou o saldo do dia
- **THEN** a API encerra essa sessão e responde `200` com o `sessionId` dela, `remainingTime` igual a `0` e `expiresAt` nulo
- **AND** o cliente trata a resposta como recusa de uso, não como liberação

#### Scenario: Cliente antigo que lê apenas os campos originais

- **WHEN** um cliente consome o response lendo somente `message` e `sessionId`
- **THEN** o comportamento permanece o de antes, porque nenhum campo foi removido ou renomeado
