## MODIFIED Requirements

### Requirement: Identificação da estação por macCode

Após conectar, o cliente SHALL se identificar enviando `{ "type": "register", "macCode": "<mac>" }`.

A API MUST normalizar o `macCode` com `formattedCodeMac` e MUST recusar o registro cujo valor normalizado não tenha 17 caracteres, de modo que a chave da conexão seja idêntica ao valor gravado em `computers.macCode`.

Registrada a estação, a API MUST responder `{ "type": "registered", macCode, connectedAt }` e MUST manter o socket em um registro em memória, localizável pelo `macCode`.

Uma conexão já registrada que tentar registrar um `macCode` diferente MUST ser recusada com o código `already_registered`, sem alterar o registro existente.

Uma conexão que não se identificar em até 10 segundos MUST ser encerrada com o close code `4408`.

A mensagem `register` MAY trazer campos que a API ainda não conhece, e a API MUST aceitá-los sem recusar a mensagem, de modo que uma evolução do cliente nunca custe o canal da estação. Essa tolerância MUST ser tratada como contrato, e não como efeito colateral da validação.

O campo opcional `version` SHALL identificar a versão do Desktop instalado. Por ser o único texto de cliente que este módulo escreve em log, ele MUST ser saneado antes do registro em log, de modo que quebra de linha não forje entrada falsa. Valor inválido MUST NOT recusar a mensagem: sanear é obrigatório, recusar é proibido.

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

#### Scenario: Cliente envia campo que a API não conhece

- **WHEN** o Desktop envia `register` com campos além do `macCode`
- **THEN** o registro acontece normalmente e os campos desconhecidos são ignorados
- **AND** a API não responde `error` nem encerra a conexão

#### Scenario: Versão com caractere de controle

- **WHEN** o cliente envia `version` contendo quebra de linha
- **THEN** o registro acontece normalmente
- **AND** o log do servidor recebe uma única linha, sem o conteúdo forjado

## ADDED Requirements

### Requirement: Rótulo da estação devolvido no registro

A confirmação `registered` SHALL incluir `roomName` (nome da sala) e `number` (número do computador dentro da sala), lidos do cadastro do computador identificado pelo `macCode`.

O Desktop SHALL preferir esses valores a qualquer configuração local, de modo que a instalação de uma estação não exija saber em que sala ela está e que um remanejamento feito no painel alcance a tela na conexão seguinte.

Quando o `macCode` não corresponder a nenhum computador cadastrado, ou a consulta ao cadastro falhar, a API MUST registrar a estação assim mesmo e MUST omitir os dois campos. A ausência SHALL ser o sinal para o Desktop usar a configuração local.

A consulta ao cadastro MUST acontecer depois de a conexão já estar no registro em memória. Consultar antes MUST ser tratado como defeito: a latência do banco entraria na janela de 10 segundos do timeout de identificação e fecharia estações legítimas com `4408` durante um cold start.

A confirmação MUST ser enviada apenas se o socket ainda for o que consta no registro para aquele `macCode`, de modo que uma reconexão ocorrida durante a consulta não receba o ack da conexão anterior.

#### Scenario: Estação de computador cadastrado

- **WHEN** o Desktop de um computador cadastrado em uma sala, com número definido, envia `register`
- **THEN** a API responde `registered` com o nome da sala em `roomName` e o número em `number`
- **AND** o Desktop exibe esses valores em vez dos que estiverem na configuração local

#### Scenario: MAC não cadastrado

- **WHEN** o `macCode` normalizado não corresponde a nenhum computador cadastrado
- **THEN** a API responde `registered` sem `roomName` e sem `number`
- **AND** a estação permanece conectada e localizável pelo `macCode`
- **AND** o caso é registrado em log como aviso

#### Scenario: Cadastro indisponível no instante do registro

- **WHEN** a consulta ao cadastro falha
- **THEN** a API responde `registered` sem `roomName` e sem `number`
- **AND** a estação permanece registrada e apta a receber eventos
- **AND** a falha é registrada em log

#### Scenario: Computador remanejado de sala

- **WHEN** um computador é movido para outra sala no painel e a estação reconecta
- **THEN** o `registered` traz o nome da sala nova
- **AND** nenhuma alteração no arquivo local da máquina é necessária
