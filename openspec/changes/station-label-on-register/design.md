# Design

## 1. A ordem entre o registro em memória e a consulta ao banco

Esta é a única decisão da change que pode quebrar produção, e ela é de **ordem**, não de conteúdo.

A tentação é natural: consultar o cadastro primeiro e só então registrar, para o ack já sair completo de uma vez. Seria errado. O `handler` mantém um timeout de 10 segundos para a conexão que não se identifica, e o Neon tem `scale-to-zero` — o `connectionTimeoutMillis` do adapter é de 15 segundos justamente porque um cold start pode passar de 10. Com a consulta antes do registro, uma estação legítima que conectasse no cold start seria fechada com `4408` **por causa da latência do banco**, e o log diria que ela não se identificou. Diagnóstico péssimo para um defeito autoinfligido.

A ordem implementada é:

1. Valida e normaliza o `macCode` (síncrono).
2. `clearTimeout`, registro no mapa, `registeredMacCode = macCode` (síncrono).
3. **Só então** `await` da consulta.
4. Confere que o socket ainda é o dono da chave e envia o `registered`.

Tudo que decide identidade acontece antes do primeiro ponto de suspensão. Isso não é só sobre o timeout: enquanto não há `await`, nenhuma segunda mensagem consegue se intrometer no meio do processo de registro, e o comportamento de concorrência continua idêntico ao que a `websocket-server-foundation` provou.

## 2. Por que conferir o dono da chave antes de responder

Entre o `await` e o `send`, uma reconexão do mesmo `macCode` pode ter assumido o mapa — é o cenário do close code `4409`, que a fundação já trata. Sem a conferência, o ack sairia por um socket que não é mais a estação corrente.

Na prática o `sendMessage` já ignora socket fora de `OPEN`, e a conexão substituída é fechada — então o efeito visível seria o mesmo. A conferência explícita existe porque o motivo é diferente: um dia o fechamento pode virar assíncrono, ou o `send` pode ganhar buffer, e aí a proteção acidental some. A regra que se quer preservar é "o ack pertence a quem está no mapa", e ela merece estar escrita.

## 3. Campos opcionais em vez de registro recusado

O caminho alternativo era tratar MAC desconhecido como erro: responder `error` e não registrar. Foi descartado por dois motivos.

O primeiro é operacional. A ordem real na sala é ligar a máquina e cadastrar depois — ou cadastrar errado e corrigir. Recusar o canal transformaria um cadastro pendente em máquina sem canal, e o sintoma (Desktop reconectando em laço) não aponta para a causa (falta cadastrar).

O segundo é de escopo: recusar seria mudança de **política de admissão** do canal, e a política que interessa é a credencial de estação (TOFU), que ainda não existe. Trocar "aceita todo mundo" por "aceita quem está cadastrado" agora criaria uma trava fraca — o `macCode` continua sendo afirmação do cliente — em troca de risco operacional real.

Falha de banco cai no mesmo tratamento pelo mesmo raciocínio, com um agravante: uma indisponibilidade momentânea do Neon não pode custar o canal de todas as estações que reconectarem naquela janela. O `findComputerLabel` engole a exceção, loga e devolve `null`.

## 4. Campos extras aceitos, e por que declarar o `version`

O `z.object` do Zod já ignora chaves desconhecidas — o `version` passaria calado hoje, sem nenhuma mudança. Isso responde ao pedido do cliente, mas responde por **acidente**: bastaria alguém apertar o schema para `.strict()` num ajuste de segurança para derrubar o canal de toda estação que já tivesse ligado o envio. E o sintoma seria brutal — não um campo ignorado, mas `invalid_payload` e a máquina sem canal.

Declarar `version` como opcional no schema transforma a tolerância em contrato, e o teste que a exercita passa a defender a decisão. O requisito no spec cobre o resto: campos desconhecidos são ignorados, nunca recusados.

## 5. Sanear a `version` em vez de recusar

A `version` é a primeira string de cliente que este módulo escreve em log — todo o resto (`macCode`) passa por `formattedCodeMac` e tem tamanho conferido, e o conteúdo bruto dos frames é proibido em log por requisito da fundação.

Um `version` com quebra de linha forja uma entrada falsa no log do servidor. Testado antes da correção: `"evil\n[WS] linha falsa de log"` produzia duas linhas, a segunda parecendo log da própria API.

A resposta poderia ser um `regex` no schema, mas recusar a mensagem por causa de um campo **acessório** é exatamente o medo que motivou o pedido do cliente — e o pior desfecho possível: a estação perde o canal por causa de um dado que não serve para nada essencial. Por isso o schema **transforma** em vez de validar: sobra `[\w.+-]`, versão em formato normal (`1.0.1`, `1.0.1-beta+2`) passa intacta, e lixo vira ruído inofensivo.

## 6. `roomName` e `number`, os nomes propostos pelo cliente

Sem contraproposta: são as palavras que o cadastro de computador já usa (`number`, `description`, `roomId`). `number` é `Int` não nulo no schema, então na prática ele só falta quando o computador inteiro falta — mas o protocolo o declara opcional junto com o `roomName`, porque os dois nascem da mesma consulta e somem juntos.
