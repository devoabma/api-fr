# Design

## 1. Por que o logout precisa ser uma rota, e não código no front

Cookie `httpOnly` é invisível para o `document.cookie`. Essa é a razão de ele existir: script injetado numa página não consegue ler nem roubar o token. O efeito colateral é que o front também não consegue **apagá-lo** — a única entidade capaz de remover um cookie é quem tem permissão de escrevê-lo no header `Set-Cookie`, ou seja, o servidor.

Então "sair" tem que ser uma requisição. O front pode limpar seu estado local (store, cache, rota), mas se o cookie continuar no navegador, a próxima carga da página se autentica sozinha e o usuário volta logado. O botão de sair vira decoração.

`clearCookie` não apaga nada de fato: manda um `Set-Cookie` com o mesmo nome, valor vazio e `Expires` no passado (`Thu, 01 Jan 1970`). É o navegador quem descarta o cookie ao ver a data vencida.

## 2. Os atributos precisam bater com os da gravação

O navegador identifica um cookie pela tripla **nome + domínio + caminho**. `Set-Cookie` com o mesmo nome mas `Path` ou `Domain` diferente não sobrescreve o original: cria um segundo cookie, já vencido, e o primeiro continua vivo e sendo enviado.

Por isso `logout.ts` repete `path`, `domain`, `httpOnly`, `secure` e `sameSite` exatamente como `authenticate.ts`. Um erro aqui não faz barulho nenhum — a API responde `200 Sessão encerrada com sucesso`, o front comemora, e o usuário segue logado. É a falha mais traiçoeira desta mudança e a razão de a limitação estar registrada no `proposal.md`.

O `maxAge` não é repetido porque `clearCookie` já escreve o vencimento no passado.

## 3. Logout sem exigir autenticação

A tentação é proteger a rota com o hook de autenticação. Mas pense no caso mais comum de alguém clicar em "sair": a sessão já expirou, o painel está mostrando erro, e a pessoa quer justamente limpar aquilo. Com autenticação obrigatória, a API responderia `401` — e o cookie inválido ficaria no navegador, exatamente o que se queria remover.

Logout é operação idempotente e sem leitura de dados: chamá-la sem sessão apaga um cookie que já não valia. Não há informação a proteger porque não há resposta variável — o corpo é o mesmo texto fixo em qualquer cenário.

O preço é CSRF de logout: um site malicioso aberto em outra aba pode disparar a chamada e derrubar a sessão de quem está logado. O ataque não lê nada, não escreve nada e não escala; o dano é um login a mais. Trocar isso pelo caso de "não consigo sair porque expirei" seria péssimo negócio.

## 4. O bug que apareceu no caminho: `Content-Type: application/json` sem corpo

`axios.post('/employees/session/logout')` — sem segundo argumento — envia `Content-Type: application/json` e corpo vazio. Não é bug do axios; é o comportamento padrão de praticamente todo cliente HTTP moderno em `POST`.

O Fastify lê esse header e chama o parser de JSON. String vazia não é JSON válido, então o parser lança `FST_ERR_CTP_EMPTY_JSON_BODY`. Esse erro não é nenhuma das classes de domínio do `errorHandler`, então caía no `catch`-all: **`500 Erro interno do servidor`**.

Duas escolhas possíveis:

**(a) Tratar `FST_ERR_CTP_EMPTY_JSON_BODY` no error handler.** Conserta o status, mas não conserta o diagnóstico — ver adiante por quê.

**(b) Substituir o parser para que corpo vazio vire `{}`.** Foi a escolhida.

O motivo é *onde* o parsing acontece: **antes do roteamento**. O Fastify precisa do corpo montado para entregar à rota, e faz isso sem saber ainda se a rota existe. Consequência direta:

```
POST /employees/nao-existe   Content-Type: application/json   (sem corpo)
  → antes:  erro de corpo vazio
  → agora:  404 { "message": "Rota não encontrada.", "route": "/employees/nao-existe" }
```

Com a opção (a), quem digitasse a URL errada receberia uma reclamação sobre o corpo da requisição. A pessoa iria mexer no corpo — que está certo — e nunca olharia para a URL. O erro apontava para o lugar errado, e é isso que a opção (b) conserta: o corpo vazio deixa de ser um evento, e o roteamento volta a ser a primeira coisa a falhar quando é ele que está errado.

O mesmo vale para validação. Em rota que exige corpo, com o parser antigo o Zod nunca chegava a rodar. Agora recebe `{}` e devolve a lista de campos faltando:

```json
{ "message": "Erro na validação, verifique os dados enviados.",
  "errors": [{ "field": "cpf", "message": "..." }, { "field": "password", "message": "Senha obrigatória" }] }
```

JSON malformado (`{"cpf":`) continua sendo erro — vira `BadRequestError` com mensagem em pt-BR, `400`. Só o corpo **vazio** deixou de ser.

## 5. A rede de segurança dos 4xx, e por que ela não é redundante

O parser resolve o caso concreto. Mas ele resolve **um** erro do framework, e o Fastify tem outros que também são culpa do cliente: corpo maior que o limite (`413`), mídia não suportada (`415`), `Content-Length` inconsistente. Todos caíam no mesmo `catch`-all e viravam `500`.

Isso é errado em duas frentes ao mesmo tempo:

- **Para o cliente**, `500` diz "o problema é meu, tente de novo mais tarde" — e a pessoa tenta de novo, com o mesmo arquivo grande demais, indefinidamente.
- **Para quem opera**, cada um desses erros ia para o `console.error` como se fosse defeito da API. Ruído no log é pior do que log nenhum, porque ensina a ignorar.

Daí o bloco final antes do `500`: se o erro já traz `statusCode` entre 400 e 499, a API responde com esse status.

**A mensagem não é repassada.** A do Fastify vem em inglês (`"Request body is too large"`) e descreve o framework, não o domínio. Numa API cuja resposta o front exibe direto para o usuário, isso vazaria inglês no meio do português. Então o `code` é traduzido por um mapa e há um texto genérico para o que não estiver mapeado.

Repassar mensagem interna também é hábito ruim por outro motivo: a mensagem é detalhe de implementação da biblioteca. Ela muda numa atualização de patch e leva junto o texto que o usuário lê.

Nenhum código da própria API define `statusCode` em erro — as falhas de domínio usam as classes de `_errors/`, tratadas antes por `instanceof`. Então este bloco captura exclusivamente erro de framework, e não há risco de ele engolir um `500` legítimo.

## 6. O que o logout deliberadamente não faz

Não invalida o token. O JWT é autocontido: a API confere assinatura e validade sem consultar nada. Quem tivesse copiado o token antes da saída continuaria usando-o até o `expiresIn` de 1 dia.

Fechar isso exige lista de revogação — tabela ou Redis — consultada **a cada requisição autenticada**. Isso troca a maior vantagem do JWT (verificação sem I/O) por uma proteção contra um cenário que hoje não está no modelo de ameaça: o token vive em cookie `httpOnly`, invisível ao JavaScript, e não transita por header nem por corpo.

A hora de reavaliar é quando aparecer necessidade de "derrubar todas as sessões deste funcionário" pelo painel — aí a lista de revogação deixa de ser defesa hipotética e vira funcionalidade pedida.
