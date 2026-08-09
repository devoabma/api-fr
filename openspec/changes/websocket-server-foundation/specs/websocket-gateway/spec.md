## ADDED Requirements

### Requirement: Canal WebSocket na própria aplicação

A API SHALL expor um servidor WebSocket em `GET /ws/computers`, dentro da mesma aplicação Fastify, no mesmo processo e na mesma porta das rotas HTTP.

O canal MUST NOT ser uma aplicação separada e MUST NOT depender de tabela ou migração: a lista de conexões é estado volátil do processo.

O plugin MUST ser registrado antes das rotas da aplicação e exportado via `fastify-plugin`, para que a rota não nasça em escopo encapsulado.

A rota MUST ser omitida da documentação OpenAPI, por não ser uma rota REST.

O servidor MUST recusar frames maiores que 4KB.

#### Scenario: Aplicação sobe com o canal disponível

- **WHEN** a API inicia
- **THEN** o endpoint aceita upgrade para WebSocket em `/ws/computers`
- **AND** as rotas HTTP continuam atendendo normalmente na mesma porta

#### Scenario: Documentação não expõe o canal

- **WHEN** a documentação OpenAPI é gerada
- **THEN** `/ws/computers` não aparece entre as rotas

### Requirement: Identificação da estação por macCode

Após conectar, o cliente SHALL se identificar enviando `{ "type": "register", "macCode": "<mac>" }`.

A API MUST normalizar o `macCode` com `formattedCodeMac` e MUST recusar o registro cujo valor normalizado não tenha 17 caracteres, de modo que a chave da conexão seja idêntica ao valor gravado em `computers.macCode`.

Registrada a estação, a API MUST responder `{ "type": "registered", macCode, connectedAt }` e MUST manter o socket em um registro em memória, localizável pelo `macCode`.

Uma conexão já registrada que tentar registrar um `macCode` diferente MUST ser recusada com o código `already_registered`, sem alterar o registro existente.

Uma conexão que não se identificar em até 10 segundos MUST ser encerrada com o close code `4408`.

#### Scenario: Registro bem-sucedido

- **WHEN** o Desktop conecta e envia `{ "type": "register", "macCode": "aabbccddee01" }`
- **THEN** a API responde `{ "type": "registered", "macCode": "AA-BB-CC-DD-EE-01", ... }`
- **AND** o socket passa a ser localizável pelo `macCode` normalizado

#### Scenario: macCode fora do padrão

- **WHEN** o cliente envia `register` com um `macCode` que não normaliza para 17 caracteres
- **THEN** a API responde `error` com código `invalid_mac_code`
- **AND** a conexão permanece aberta e não registrada
- **AND** o valor recebido não é escrito em log

#### Scenario: Conexão que não se identifica

- **WHEN** um cliente abre a conexão e não envia `register` em 10 segundos
- **THEN** a API encerra a conexão com o close code `4408`

### Requirement: Uma conexão por computador

O registro SHALL manter no máximo uma conexão por `macCode`.

Quando um `macCode` já registrado registrar de novo, a conexão nova MUST prevalecer e a anterior MUST ser encerrada com o close code `4409`.

Recusar a conexão nova MUST NOT ser adotado: numa queda de rede o servidor pode levar horas para perceber que o socket anterior morreu, e a estação ficaria impedida de voltar justamente enquanto tenta.

#### Scenario: Desktop reconecta após queda de rede

- **WHEN** um `macCode` já registrado envia `register` por uma conexão nova
- **THEN** a conexão anterior é encerrada com o close code `4409`
- **AND** o registro passa a apontar para a conexão nova
- **AND** continua existindo exatamente um registro para aquele `macCode`

### Requirement: Remoção da conexão ao encerrar

A API SHALL remover a estação do registro quando o socket for encerrado.

A remoção MUST acontecer somente se o socket que fechou for o mesmo que está registrado. O `close` de uma conexão substituída chega depois que a nova assumiu a chave; remover sem essa checagem MUST ser tratado como defeito, pois apagaria a conexão viva e faria a API considerar offline uma estação conectada.

No encerramento da aplicação, todas as conexões MUST ser fechadas com o close code `4503` e o registro MUST ser esvaziado.

#### Scenario: Desktop desconecta

- **WHEN** o Desktop encerra a conexão
- **THEN** a estação deixa de constar no registro de conexões

#### Scenario: Close atrasado da conexão substituída

- **WHEN** chega o `close` de uma conexão que já havia sido substituída por outra do mesmo `macCode`
- **THEN** o registro da conexão nova permanece intacto

#### Scenario: API encerrando

- **WHEN** a aplicação é encerrada
- **THEN** todas as conexões são fechadas com o close code `4503`

### Requirement: Detecção de estação morta

A API SHALL enviar ping de controle a cada 30 segundos para as estações registradas e MUST descartar a conexão que não responder ao ping anterior.

O mecanismo MUST usar frames de controle do protocolo, respondidos pela pilha do WebSocket, de modo que a detecção não dependa de o cliente implementar mensagem de aplicação.

O intervalo MUST NOT impedir o encerramento do processo.

#### Scenario: Computador desligado na tomada

- **WHEN** uma estação registrada para de responder aos pings
- **THEN** a conexão é encerrada e a estação é removida do registro no ciclo seguinte

### Requirement: Protocolo extensível e tolerante a mensagem inválida

Toda mensagem SHALL ser um objeto JSON com o campo discriminador `type`, validado por schema.

Mensagem malformada, sem `type` ou de tipo não suportado MUST ser respondida com `{ "type": "error", code, message }` e MUST NOT encerrar a conexão, para que um defeito de serialização do cliente não vire laço de reconexão.

O tratamento das mensagens MUST falhar em tempo de compilação quando um tipo novo for adicionado ao protocolo sem tratamento correspondente.

O conteúdo bruto dos frames MUST NOT ser escrito em log.

#### Scenario: JSON inválido

- **WHEN** o cliente envia um texto que não é JSON válido
- **THEN** a API responde `error` com código `invalid_payload`
- **AND** a conexão permanece aberta e o registro existente é preservado

#### Scenario: Tipo de mensagem não suportado

- **WHEN** o cliente envia uma mensagem com `type` que a API ainda não implementa
- **THEN** a API responde `error` com código `unknown_message_type`, citando o tipo recebido

### Requirement: Conexão não é confiável por ter conectado

A API MUST NOT tratar um cliente WebSocket como computador confiável apenas por ele ter estabelecido a conexão. Enquanto não houver credencial de estação, o `macCode` é uma afirmação do cliente e o canal MUST NOT transportar dado sensível.

A decisão de autorização do handshake MUST ficar concentrada em um único ponto (`authorization.ts`), aplicado antes do upgrade, de modo que a verificação futura entre sem alterar o handler.

Credencial de estação, quando existir, MUST trafegar no header `Authorization` e MUST NOT trafegar na query string, que aparece em log de proxy. Token e headers MUST NOT ser escritos em log.

#### Scenario: Handshake recusado

- **WHEN** a autorização do handshake recusar a conexão
- **THEN** a API responde `401` sem realizar o upgrade
