## MODIFIED Requirements

### Requirement: Rótulo da estação devolvido no registro

A confirmação `registered` SHALL incluir `roomName` (nome da sala), `number` (número do computador dentro da sala) e `uf` (sigla do estado da sala, em maiúsculas), lidos do cadastro do computador identificado pelo `macCode`.

O Desktop SHALL preferir esses valores a qualquer configuração local, de modo que a instalação de uma estação não exija saber em que sala nem em que estado ela está, e que uma correção feita no painel alcance a máquina na conexão seguinte.

A `uf` SHALL ser persistida pelo Desktop, e não apenas exibida. O motivo é que ela decide se a máquina entra em uma publicação de versão dirigida a um estado, e essa decisão é tomada no arranque do aplicativo, **antes** de o canal conectar: uma UF que só existisse em memória nunca estaria disponível na hora em que é consultada. Gravada, ela vale a partir da execução seguinte.

Quando o `macCode` não corresponder a nenhum computador cadastrado, ou a consulta ao cadastro falhar, a API MUST registrar a estação assim mesmo e MUST omitir os três campos. A ausência SHALL ser o sinal para o Desktop usar a configuração local, e a API MUST NOT substituí-la por string vazia.

Como `rooms.uf` é obrigatório no banco, os três campos MUST ser entregues juntos: uma confirmação com `roomName` e sem `uf` MUST ser tratada como defeito. A ausência tem uma causa só — MAC fora do cadastro ou cadastro indisponível.

A consulta ao cadastro MUST acontecer depois de a conexão já estar no registro em memória. Consultar antes MUST ser tratado como defeito: a latência do banco entraria na janela de 10 segundos do timeout de identificação e fecharia estações legítimas com `4408` durante um cold start.

A confirmação MUST ser enviada apenas se o socket ainda for o que consta no registro para aquele `macCode`, de modo que uma reconexão ocorrida durante a consulta não receba o ack da conexão anterior.

#### Scenario: Estação de computador cadastrado

- **WHEN** o Desktop de um computador cadastrado em uma sala, com número definido, envia `register`
- **THEN** a API responde `registered` com o nome da sala em `roomName`, o número em `number` e a sigla do estado em `uf`
- **AND** o Desktop exibe esses valores em vez dos que estiverem na configuração local

#### Scenario: Estado da sala entregue à estação

- **WHEN** a estação de uma sala cadastrada no Maranhão se registra
- **THEN** a confirmação traz `"uf": "MA"`
- **AND** o Desktop grava a sigla em disco, para que ela esteja disponível no arranque seguinte

#### Scenario: MAC não cadastrado

- **WHEN** o `macCode` normalizado não corresponde a nenhum computador cadastrado
- **THEN** a API responde `registered` sem `roomName`, sem `number` e sem `uf`
- **AND** a estação permanece conectada e localizável pelo `macCode`
- **AND** o caso é registrado em log como aviso

#### Scenario: Cadastro indisponível no instante do registro

- **WHEN** a consulta ao cadastro falha
- **THEN** a API responde `registered` sem `roomName`, sem `number` e sem `uf`
- **AND** a estação permanece registrada e apta a receber eventos
- **AND** a falha é registrada em log

#### Scenario: Computador remanejado de sala

- **WHEN** um computador é movido para outra sala no painel e a estação reconecta
- **THEN** o `registered` traz o nome e o estado da sala nova
- **AND** nenhuma alteração no arquivo local da máquina é necessária

#### Scenario: Estado da sala corrigido no painel

- **WHEN** a `uf` de uma sala é alterada enquanto uma estação daquela sala está conectada
- **THEN** a estação continua com o valor anterior até reconectar
- **AND** o valor novo chega no registro seguinte, sem visita à máquina
