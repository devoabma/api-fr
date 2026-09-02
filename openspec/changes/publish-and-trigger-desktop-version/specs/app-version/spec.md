## ADDED Requirements

### Requirement: Histórico das versões publicadas do Desktop

A API SHALL guardar as versões publicadas do Desktop na tabela `app_versions`, **uma linha por versão**, e não uma linha única sobrescrita.

Cada linha MUST conter: `version` (texto, único, até 40 caracteres), `envelope` (o manifesto assinado **como texto cru**), `origin` (`PUBLISHER` ou `MIRROR`), e MAY conter `generated_at`, `notes`, `rollout` e `etag`.

O `version` MUST ser texto, e a ordenação por versão MUST NOT ser feita pelo banco: `'1.0.10' < '1.0.7'` em comparação alfabética. A comparação MUST acontecer na aplicação, por partes numéricas.

O `envelope` MUST ser gravado exatamente como chegou, **sem reserializar**. Guardar o objeto parseado e remontá-lo na saída reordena chaves e reindenta o JSON, e a estação recusa em silêncio o envelope cuja assinatura não confere.

A **versão vigente** SHALL ser a linha de `created_at` mais recente. Isso só é verdade porque a gravação recusa o que é mais velho do que o já guardado (ver requisito da guarda anti-regressão).

#### Scenario: Mesma versão chegando pelas duas fontes

- **WHEN** o mesmo manifesto chega pelo aviso da publicação e depois pelo espelho
- **THEN** a API atualiza a linha existente daquela versão, com o `etag` novo e a origem que confirmou
- **AND** a API NÃO cria uma segunda linha para a mesma versão

#### Scenario: Nenhuma versão publicada conhecida

- **WHEN** nenhuma versão chegou por nenhuma das duas fontes
- **THEN** a versão vigente é `null`
- **AND** toda estação é classificada como `unknown`, jamais como `up-to-date`

### Requirement: Porta de entrada única com guarda anti-regressão

A API SHALL fazer as duas fontes de versão publicada — o aviso da publicação e o job de espelho — passarem pela mesma função de gravação. A regra de precedência MUST NOT ser duplicada nas duas pontas.

A ordem de precedência MUST NOT ser "quem escreveu por último". Ela SHALL ser:

1. **Número da versão**: manifesto com versão menor que a guardada MUST ser recusado com motivo `older`, sem alterar nada.
2. **`geradoEm`, no empate de versão**: com o mesmo número, o manifesto MUST ser recusado com motivo `stale_rollout` quando seu `geradoEm` for **anterior** ao da linha guardada. `geradoEm` igual MUST passar.
3. **Origem, quando `geradoEm` falta de um dos lados**: o aviso da publicação vence e o espelho perde, e a API MUST registrar um aviso no log — manifesto sem `geradoEm` é sinal de publicação feita fora do processo normal.

O desempate MUST NOT usar o percentual da `implantacao`: conter uma versão ruim é republicar o **mesmo** número com percentual **menor**, e uma regra baseada em percentual bloquearia exatamente esse freio de mão.

A função MUST NOT lançar por conteúdo ruim. Envelope quebrado, assinatura inválida e manifesto ilegível MUST virar um resultado `ignored` com motivo. Falha de banco MUST subir para quem chamou.

O campo `rollout` MUST ser gravado com `Prisma.DbNull` quando a `implantacao` não vem: `undefined` significa "não mexa neste campo" no Prisma, e um manifesto novo sem onda herdaria silenciosamente a onda do anterior.

#### Scenario: CDN entrega cópia em cache depois de uma publicação

- **GIVEN** que a `1.0.9` foi publicada e avisada por `POST /app/version`
- **WHEN** o job de espelho lê o arquivo público e a CDN ainda entrega a `1.0.8` do cache
- **THEN** a API recusa com motivo `older` e mantém a `1.0.9` como vigente
- **AND** o painel NÃO volta a dizer que o parque está em dia

#### Scenario: Onda antiga da mesma versão

- **GIVEN** que a `1.0.8` está guardada com `geradoEm` das 10h
- **WHEN** chega um manifesto da `1.0.8` com `geradoEm` das 9h
- **THEN** a API recusa com motivo `stale_rollout` e mantém a publicação mais recente

#### Scenario: Manifesto ilegível

- **WHEN** o envelope não é JSON válido, não tem as quatro chaves, ou o `conteudo` não traz uma `versao` comparável
- **THEN** a API responde `ignored` com o motivo correspondente
- **AND** a versão vigente permanece inalterada

### Requirement: Aviso da publicação por token de serviço

A API SHALL expor `POST /app/version` para o script de publicação registrar o manifesto assinado no instante em que a versão sai.

A rota MUST autenticar por `Authorization: Bearer <token>`, comparado com `APP_VERSION_PUBLISH_TOKEN`. **Não** é login de funcionário e MUST NOT exigir o plugin `auth`.

A comparação MUST ser em tempo constante, sobre digests SHA-256 dos dois valores — o `timingSafeEqual` exige buffers do mesmo tamanho, e o tamanho do que chega é escolhido por quem chama.

Sem `APP_VERSION_PUBLISH_TOKEN` configurado, a rota MUST responder `503` e MUST NOT aceitar nenhum manifesto. Token ausente ou incorreto MUST responder `401`.

A rota MUST ler o corpo **como texto**, por meio de um parser de content type próprio e **encapsulado no plugin da rota**, sem alterar o parser das demais rotas da API.

Em sucesso, a API MUST responder `201` com `{ message, version }`. Manifesto recusado por `older` ou `stale_rollout` MUST responder `409` com mensagens distintas entre si — são conferências diferentes do lado de quem publica. Envelope ou assinatura inválidos MUST responder `400`.

#### Scenario: Publicação aceita

- **WHEN** o `publicar.ps1` envia o envelope assinado com o token correto
- **THEN** a API responde `201` e grava a linha com `origin = PUBLISHER`

#### Scenario: API sem token configurado

- **WHEN** alguém chama `POST /app/version` e a API está sem `APP_VERSION_PUBLISH_TOKEN`
- **THEN** a API responde `503`
- **AND** o restante da API continua funcionando normalmente

### Requirement: Espelho do manifesto público como rede de segurança

A API SHALL rodar um job in-process que lê o manifesto público (`APP_MANIFEST_URL`) a cada 5 minutos, com `noOverlap`, e o grava pela mesma porta de entrada com `origin = MIRROR`.

O intervalo MUST estar alinhado ao `max-age` do próprio arquivo: perguntar mais rápido devolveria a mesma cópia da CDN.

O job MUST enviar `If-None-Match` com o `etag` da última leitura e MUST tratar `304` como caminho normal, sem log.

A leitura MUST ter timeout, para o job não ficar pendurado até a rodada seguinte.

**Falha de leitura MUST NOT apagar nem invalidar a versão conhecida.** Timeout, resposta não-`2xx`, DNS oscilando e corpo ilegível MUST manter o valor guardado e tentar de novo na próxima rodada.

O job MUST executar uma leitura no arranque da API, para o painel não passar os primeiros minutos após cada deploy sem saber a versão publicada.

A consulta MUST ser uma por processo, e MUST NOT ser disparada por usuário do painel: o painel lê da tabela.

#### Scenario: Manifesto inalterado

- **WHEN** a rodada do job encontra `304 Not Modified`
- **THEN** o job encerra sem escrever no banco e sem registrar log

#### Scenario: Bucket fora do ar

- **WHEN** a leitura do manifesto estoura o timeout ou responde `5xx`
- **THEN** a API registra o ocorrido e mantém a versão publicada que já conhecia
- **AND** o painel NÃO passa a considerar o parque inteiro em dia

### Requirement: Conferência opcional da assinatura do manifesto

A API SHALL conferir a assinatura do envelope contra `APP_MANIFEST_PUBLIC_KEY` antes de ler seu conteúdo, quando essa chave estiver configurada.

A verificação MUST ser feita sobre os **bytes decodificados do `conteudo`**, e não sobre o envelope inteiro — é o que permite conferir a origem sem ninguém depender de ordem de chaves, espaços ou escapes do JSON externo.

Envelope cujo `algoritmo` não seja o combinado MUST ser recusado de saída, em vez de conferido com o verificador errado.

Chave ausente, vazia ou só em branco MUST desligar a conferência, e a API MUST seguir transportando o envelope assinado. A chave MUST NOT ser tratada como segredo: ela já viaja dentro de todo executável instalado no parque.

A API MUST NOT assinar manifestos em nenhuma hipótese. A chave privada permanece no cofre de quem publica.

Esta conferência MUST NOT ser descrita como a proteção do parque: quem valida antes de instalar é cada estação, com a chave embutida no próprio executável.

#### Scenario: Envelope adulterado com conferência ligada

- **WHEN** o `conteudo` do envelope foi alterado depois da assinatura
- **THEN** a API recusa com motivo `invalid_signature` e não grava nada

#### Scenario: Conferência desligada

- **WHEN** `APP_MANIFEST_PUBLIC_KEY` está vazia ou só com espaços
- **THEN** a API não confere a assinatura e segue o fluxo normal de gravação
