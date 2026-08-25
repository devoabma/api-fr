## ADDED Requirements

### Requirement: Última versão do Desktop guardada no registro

A API SHALL persistir, no cadastro do computador identificado pelo `macCode`, a versão do Desktop informada no `register`, junto do instante em que ela foi informada.

O carimbo SHALL significar **quando a estação informou**, e MUST NOT ser lido como "quando a estação foi vista pela última vez". A versão só viaja no `register` — a cada conexão e reconexão, nunca periodicamente —, de modo que uma estação que permaneça semanas conectada sem cair MUST manter um carimbo antigo enquanto está em operação normal. Tratar ausência de mensagem como sinal de máquina indisponível MUST ser considerado defeito; quem responde por presença é o registro em memória exposto em `GET /computers/online/:roomId?`.

A API MUST gravar o valor recebido sem compará-lo com o valor anterior. O cliente volta por conta própria ao executável anterior quando uma atualização falha três vezes seguidas, de modo que uma versão **menor** que a última conhecida é informação legítima — e é justamente o sinal de que algo deu errado naquela máquina. Qualquer lógica que só aceite valores crescentes MUST ser considerada defeito.

Quando o campo `version` não vier na mensagem, a API MUST preservar o valor e o carimbo já guardados, e MUST NOT gravar nulo, string vazia ou carimbo novo. A ausência SHALL significar "esta estação foi configurada para não informar" — existe um interruptor local no Desktop —, e não falha. Uma versão que, depois do saneamento, não deixe nenhum caractere SHALL ser tratada como ausência.

Quando o `macCode` não corresponder a nenhum computador cadastrado, a gravação MUST não afetar nenhuma linha e MUST NOT produzir erro: o canal aceita estação fora do cadastro, e o registro segue normalmente.

A gravação MUST NOT atrasar nem impedir a confirmação `registered`, e uma falha ao gravar MUST ser registrada em log sem interromper o registro da estação. A versão é dado acessório; o ack é o que destrava a tela da máquina.

#### Scenario: Estação informa a versão ao conectar

- **WHEN** uma estação cadastrada envia `register` com `"version": "1.0.7"`
- **THEN** a API grava `1.0.7` como última versão daquela máquina, com o instante do registro
- **AND** a confirmação `registered` é enviada normalmente

#### Scenario: Estação volta para a versão anterior

- **WHEN** uma estação que havia informado `1.0.7` reconecta informando `1.0.6`
- **THEN** a API grava `1.0.6`, substituindo a versão maior
- **AND** o carimbo passa a ser o do registro mais recente

#### Scenario: Estação configurada para não informar

- **WHEN** uma estação envia `register` sem o campo `version`
- **THEN** a API mantém intactos a versão e o carimbo já guardados
- **AND** não trata a ausência como erro nem responde `error` por causa dela

#### Scenario: Versão que não sobrevive ao saneamento

- **WHEN** o `version` recebido não deixa nenhum caractere depois do saneamento
- **THEN** a API trata a mensagem como se o campo não tivesse vindo
- **AND** nada é gravado no cadastro da máquina

#### Scenario: MAC fora do cadastro

- **WHEN** uma estação cujo `macCode` não está cadastrado envia `register` com versão
- **THEN** nenhuma linha é atualizada
- **AND** a estação permanece registrada no canal e nenhum erro é produzido

#### Scenario: Cadastro indisponível no instante do registro

- **WHEN** a gravação da versão falha
- **THEN** a falha é registrada em log
- **AND** a estação é registrada e recebe a confirmação `registered` assim mesmo

#### Scenario: Estação conectada há semanas

- **WHEN** uma estação permanece conectada sem cair desde o registro anterior
- **THEN** o carimbo da versão continua sendo o daquele registro
- **AND** a máquina segue aparecendo como conectada na listagem de estações online
