## Why

A change `record-desktop-version-per-station` guardou **metade** da conta: `computers.appVersion` diz em que versão cada estação está. A outra metade — **qual é a versão que deveria estar lá** — nunca existiu do lado da API.

Sem ela, o painel só sabe comparar cada máquina com as vizinhas de sala (a régua que aquela change usou por não ter outra). Isso denuncia a estação que ficou para trás dentro de uma sala, mas é cego para o caso mais comum: **a sala inteira atrasada**. Se as quatro máquinas da Sala 1 estão na `1.0.6` e a publicada é a `1.0.9`, o painel de hoje pinta as quatro de verde.

E, mesmo enxergando o atraso, não havia o que fazer com ele. O cliente WPF consulta o manifesto no intervalo dele; quem está na frente do painel só podia esperar. "A máquina está atrasada e eu não consigo mandar ela atualizar" é a reclamação que fecha o ciclo aberto pela change anterior.

## What Changes

- **Tabela `app_versions`** e enum `AppVersionOrigins`: histórico das versões publicadas, uma linha por versão, com o envelope assinado guardado **como texto cru**.
- **`POST /app/version`**: o `publicar.ps1` avisa a API no instante da publicação. Token de serviço no `Authorization: Bearer`, **não** é login de funcionário.
- **Job `mirror-app-version.cron.ts`**: de 5 em 5 minutos lê o manifesto público com `If-None-Match`. É a rede de segurança para o dia em que o aviso acima não chegar.
- **`savePublishedVersion`**: porta de entrada única das duas fontes, com a guarda anti-regressão (número da versão e, no empate, `geradoEm` de dentro do conteúdo assinado).
- **`POST /computers/update-app/:id`** (ADMIN): manda **uma** estação consultar o manifesto agora.
- **Mensagem `update_now`** no protocolo do canal: um toque no ombro, sem URL, hash nem tamanho.
- **`GET /computers/get-all`**: cada máquina ganha `isOnline` e `updateStatus`; a resposta ganha `latestVersion`.
- **`src/utils/app-version.ts`**: comparação de versões por partes e leitura/conferência do envelope assinado.
- **Env**: `APP_MANIFEST_URL`, `APP_VERSION_PUBLISH_TOKEN`, `APP_MANIFEST_PUBLIC_KEY`.

## Capabilities

### Added Capabilities
- `app-version`: a API passa a saber qual é a versão publicada do Desktop, por duas fontes independentes, e a guardar o histórico do que foi publicado.

### Modified Capabilities
- `computer`: o inventário ADMIN passa a responder "esta máquina está atrasada?" e "ela está no ar agora?", e ganha a ação de mandar atualizar.
- `websocket-gateway`: o canal ganha a primeira mensagem servidor→estação que **pede uma ação** em vez de avisar de um fato consumado.

## Impact

- Banco: **uma migração** (`20260902120000_versao_publicada_do_desktop`). Aditiva, tabela nova, sem tocar em nada existente.
- Código: `prisma/schema.prisma`, `src/utils/app-version.ts`, `src/http/core/app-version/`, `src/http/core/computers/update-app.ts`, `src/http/core/computers/get-all.ts`, `src/http/jobs/mirror-app-version.cron.ts`, `src/http/websocket/{protocol,notifications}.ts`, `src/http/{env,rate-limit,routes/index,server}.ts`.
- Contrato HTTP: **aditivo** em `GET /computers/get-all` (três campos novos); duas rotas novas.
- Contrato do canal: **aditivo**. `update_now` é servidor→estação; cliente que não conhece o tipo ignora, como já faz com qualquer mensagem desconhecida.
- Rede: uma leitura de ~1 KB a cada 5 minutos, **por processo** — e `304` sem corpo na esmagadora maioria das rodadas.
- Operação: sem `APP_VERSION_PUBLISH_TOKEN` a rota de publicação responde `503` e o resto da API funciona igual. O espelho sozinho já sustenta o recurso inteiro.

## Behavior Change

O painel deixa de comparar máquina com máquina e passa a comparar máquina com o que foi publicado. Uma sala inteira atrasada — o caso que a régua anterior não via — aparece. E o funcionário que enxergou o atraso ganha o botão que faltava: mandar aquela estação buscar a versão agora, sem esperar o intervalo dela.

## Design Decisions

**Duas fontes, uma porta.** O aviso da publicação (`PUBLISHER`) e o espelho (`MIRROR`) escrevem na mesma tabela, mas passam os dois por `savePublishedVersion`. A regra de "o que pode sobrescrever o quê" mora num lugar só; duplicada nas duas pontas, ela divergiria na primeira correção.

**A ordem nunca é "quem escreveu por último".** O arquivo público tem `Cache-Control: max-age=300`. Publica-se a `1.0.9`, o `POST` avisa, e minutos depois o espelho pergunta à CDN — que **ainda entrega a `1.0.8` do cache**. Sem guarda, o espelho rebaixaria a versão publicada, o painel voltaria a dizer que o parque está em dia, e cinco minutos depois tudo se consertaria sozinho. Bug que aparece e some sozinho é bug que ninguém consegue reproduzir para reportar.

**Empate de versão se desfaz por `geradoEm`, não por percentual.** A onda sobe republicando o **mesmo** número (`1.0.8` a 0%, 10%, 50%, 100%), e conter uma versão ruim é o mesmo movimento ao contrário — republicar com percentual **menor**. Comparar percentual pareceria natural e quebraria justamente o freio de mão. `geradoEm` vem de dentro do `conteudo` assinado, então não é falsificável sem invalidar a assinatura.

**Envelope guardado como texto, nunca como objeto.** A fase 2 (`GET /app/version`) vai devolver este campo byte a byte às estações, e a estação recusa em silêncio o que não confere. Guardar objeto e remontar na saída reordena chaves e reindenta o JSON. Daí o parser de content type próprio — encapsulado no plugin da rota, sem afetar nenhuma outra.

**`update_now` não carrega o que instalar.** Nem URL, nem hash, nem tamanho. É um toque no ombro: a estação busca o manifesto assinado por conta própria e confere com a chave embutida no executável. É isso que garante que uma invasão do servidor **não** vire um programa arbitrário instalado em todas as salas.

**A conferência de assinatura na API é rede, não muralha.** Quem protege o parque é cada estação. A conferência aqui cobre dois casos que a estação cobriria tarde demais: alguém de posse do token empurrando lixo pela rota, e arquivo corrompido em trânsito virando "versão publicada" no painel. Sai desligada por padrão (`APP_MANIFEST_PUBLIC_KEY` vazia).

**`updateStatus` tem três estados, nunca dois.** `unknown` cobre "nunca informou", "informou algo ilegível" e "a API ainda não sabe qual é a publicada". Confundir "não sei" com "está em dia" é como uma máquina desatualizada some do radar — e é por isso que `parseVersion` devolve `null` em vez de chutar número: `Number("8-beta")` é `NaN`, e `NaN` perde toda comparação.

**O caminho é `/computers/update-app/:id`, não `/computers/update/:id`.** Este último já é o `PATCH` que edita o cadastro. Duas operações sem nada em comum na mesma URL, separadas só pelo verbo, é um erro esperando acontecer: quem digitasse `POST` querendo editar mandaria uma estação baixar 60 MB.

**Sessão aberta bloqueia; manutenção, não.** Máquina em manutenção é o melhor momento possível para trocar o executável. Máquina com advogado(a) na frente, nunca — e a checagem é aqui, antes de gastar o canal, porque a API é quem enxerga o parque.

**Rate limit por máquina, não por funcionário.** Cada disparo aceito manda uma estação baixar ~60 MB: o que satura o link da unidade é a mesma sala baixando junto, não o mesmo crachá clicando. Um teto por usuário travaria quem acabou de atualizar a Sala 1 na hora de atualizar a Sala 2.

**`APP_VERSION_PUBLISH_TOKEN` vazio é "não configurado", não "token inválido".** O `.env.example` nasce com a chave presente e sem valor. Se vazio reprovasse no `min(32)`, copiar o arquivo de exemplo derrubaria o boot — exatamente o ambiente que o `optional` existe para proteger. Mesma regra para `APP_MANIFEST_PUBLIC_KEY`, onde `" "` é pior ainda: truthy, passaria pelo desligamento e faria `createPublicKey` lançar em **todo** manifesto, virando `invalid_signature` silencioso.

## Known Limitations

1. **`GET /app/version` não existe (fase 2).** A API guarda o envelope byte a byte preparada para servi-lo, mas hoje as estações continuam lendo o arquivo público direto. Enquanto for assim, a tabela é só leitura de painel.

2. **A `implantacao` é guardada e não interpretada.** Quem filtra a onda é o cliente. `POST /computers/update-app/:id` **fura** a onda de propósito — é um pedido nominal do suporte para uma máquina específica —, mas a API não sabe dizer quais máquinas a onda atual alcança.

3. **A resposta confirma o envio do recado, jamais a atualização.** Não existe "deu certo" separado: quem aplica reinicia. A prova é o `register` seguinte chegando com a versão nova, e ela pode demorar minutos.

4. **Não há disparo em lote.** Uma máquina por chamada. "Atualize a Sala 3 inteira" é o front repetindo a chamada — e o teto de 10 em 5 minutos é por máquina justamente para isso não travar.

5. **O `origin` de uma linha é sempre o da última escrita.** Se o aviso trouxe a versão e o espelho depois confirmou o mesmo arquivo, a linha fica `MIRROR`. O campo responde "por onde esta versão chegou por último", não "por onde foi descoberta".

6. **O token de publicação é único e não rotaciona sozinho.** Trocar exige mexer no `.env` da API e no cofre de quem publica, nessa ordem, com uma janela em que a publicação falha com `401`. Aceitável para uma publicação por mês.
