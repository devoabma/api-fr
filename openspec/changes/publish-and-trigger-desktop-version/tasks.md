## 1. Versão publicada no modelo

- [x] 1.1 Enum `AppVersionOrigins` (`PUBLISHER` / `MIRROR`) — diagnóstico de "por onde esta versão chegou"
- [x] 1.2 Modelo `AppVersions` com `version` único, `envelope` (texto cru), `generatedAt`, `notes`, `rollout` (Json), `origin`, `etag`
- [x] 1.3 Índice `createdAt` desc — a leitura mais quente da tabela é "qual é a vigente", e ela roda a cada listagem de computadores
- [x] 1.4 Migração `20260902120000_versao_publicada_do_desktop`, aditiva e sem backfill
- [x] 1.5 Aplicar e conferir (`prisma migrate status`: schema em dia)

## 2. Regra pura de versão (`src/utils/app-version.ts`)

- [x] 2.1 `parseVersion` devolve `null` para o que não é versão — `Number("8-beta")` é `NaN`, e `NaN` perde toda comparação, deixando a máquina "em dia" para sempre
- [x] 2.2 `compareVersions` por partes, para `"1.0.10"` não ficar abaixo de `"1.0.9"`
- [x] 2.3 `getUpdateStatus` com três estados — `unknown` jamais colapsa em `up-to-date`
- [x] 2.4 `isSignedEnvelope` / `readManifestContent`: nunca lançam, porque as duas origens do envelope são externas
- [x] 2.5 `isEnvelopeSignatureValid` sobre os **bytes decodificados do `conteudo`**, com chave vazia = conferência desligada
- [x] 2.6 Verificado com par ECDSA P-256 real: assinatura válida passa, conteúdo adulterado é recusado, sem chave devolve `true`

## 3. Porta de entrada única (`savePublishedVersion`)

- [x] 3.1 As duas fontes passam pela mesma função — a regra de sobrescrita mora num lugar só
- [x] 3.2 Guarda anti-regressão por número de versão (`older`)
- [x] 3.3 Desempate de mesma versão por `geradoEm` (`stale_rollout`), e não por percentual — o freio de mão **precisa** poder baixar a fatia
- [x] 3.4 Sem `geradoEm` comparável, o desempate vai para a origem (publicação vence, espelho perde) **com aviso no log**: é sinal de manifesto entrando fora do processo
- [x] 3.5 `Prisma.DbNull` no `rollout` — `undefined` significaria "não mexe", e um manifesto sem onda herdaria a onda anterior
- [x] 3.6 Data impossível em `geradoEm` vira ausência, não `Invalid Date`
- [x] 3.7 Nunca lança por conteúdo ruim (vira `ignored` com motivo); falha de banco sobe para quem chamou decidir

## 4. Aviso da publicação (`POST /app/version`)

- [x] 4.1 Parser de content type próprio, para ficar com o corpo **como texto** — a fase 2 devolve o envelope byte a byte
- [x] 4.2 Encapsulado no plugin da rota (`removeContentTypeParser` antes, senão `FST_ERR_CTP_ALREADY_PRESENT`)
- [x] 4.3 Comprovado que nenhuma outra rota da API foi afetada (smoke com `app.inject`: a rota vizinha segue recebendo `body` parseado e sem `rawBody`)
- [x] 4.4 Token por `Authorization: Bearer`, comparado com `timingSafeEqual` sobre digests SHA-256 (comprimento igual mesmo com entrada de tamanho escolhido por quem chama)
- [x] 4.5 Sem token configurado, `503` — padrão seguro, em vez de comparar segredo vazio com segredo vazio
- [x] 4.6 `409` distingue `older` de `stale_rollout`: são conferências diferentes do lado de quem publica

## 5. Espelho do manifesto público (job)

- [x] 5.1 `node-cron` a cada 5 minutos com `noOverlap`, alinhado ao `max-age` do próprio arquivo
- [x] 5.2 `If-None-Match` com o `ETag` guardado — `304` sem corpo na esmagadora maioria das rodadas
- [x] 5.3 Timeout de 10s via `AbortSignal.timeout`, para o job não ficar pendurado até a próxima rodada
- [x] 5.4 **Falha nunca vira "não há versão"**: timeout, `5xx` e DNS oscilando mantêm o valor conhecido
- [x] 5.5 `older` e `stale_rollout` viram log informativo, não aviso de defeito — é a CDN servindo cache, e é o comportamento esperado
- [x] 5.6 Uma leitura no arranque, para o painel não passar os primeiros 5 minutos em "não sei" depois de cada deploy

## 6. Mandar uma estação atualizar

- [x] 6.1 `update_now` no `ServerMessage`, com `macCode` obrigatório e `version` informativa
- [x] 6.2 Documentar no protocolo que a mensagem **não** carrega URL, hash nem tamanho — é o que impede o servidor invadido de instalar programa arbitrário
- [x] 6.3 `notifyUpdateNow` devolve `boolean`, e aqui o retorno **importa**: nada foi gravado antes, então `false` é "estação desconectada" para mostrar ao funcionário
- [x] 6.4 `POST /computers/update-app/:id`, ADMIN-only, por `cuid2` como as demais rotas do painel
- [x] 6.5 Caminho `/update-app/:id` e não `/update/:id` — o segundo já é o `PATCH` que edita o cadastro, e colidir os dois faria um `POST` distraído mandar a estação baixar 60 MB
- [x] 6.6 Recusa com `400` se em uso; manutenção **não** bloqueia, é o melhor momento para trocar o executável
- [x] 6.7 Recusa com `400` quem já está na versão publicada; `unknown` passa, porque é justamente a máquina sobre a qual não se sabe nada que precisa ser sacudida
- [x] 6.8 `409` para estação fora do canal, inclusive na corrida entre a checagem e o envio
- [x] 6.9 Rate limit por máquina (10 em 5 min), não por funcionário

## 7. Exposição no inventário

- [x] 7.1 `GET /computers/get-all` devolve `isOnline`, lido do mapa em memória — uma leitura serve a lista inteira
- [x] 7.2 `updateStatus` calculado no servidor, para a comparação por texto não ser reescrita em cada tela
- [x] 7.3 `latestVersion` (`version`, `notes`, `generatedAt`) ou `null` enquanto nenhuma versão chegou
- [x] 7.4 MAC normalizado dos dois lados, para linha antiga fora do padrão não aparecer offline estando conectada

## 8. Configuração

- [x] 8.1 `APP_MANIFEST_URL`, `APP_VERSION_PUBLISH_TOKEN` (mín. 32) e `APP_MANIFEST_PUBLIC_KEY` no `env.ts` e no `.env.example`
- [x] 8.2 Token e chave vazios ou em branco = **não configurado**, e não erro de validação: `.env.example` copiado não pode derrubar o boot
- [x] 8.3 Conferido nas bordas: `""` e `"   "` sobem com `undefined`, `"curto"` reprova, token válido passa

## 9. Verificação

- [x] 9.1 `npx tsc --noEmit` sem erros
- [x] 9.2 `npx biome check src/` sem issues
- [x] 9.3 `prisma migrate status`: schema em dia
- [x] 9.4 `app.ready()` real: `/app/version (POST)` e `/computers/update-app/:id (POST)` registradas, sem colisão com `/computers/update/:id (PATCH)`
- [x] 9.5 `POST /app/version` sem token responde `401` (e `503` quando a API está sem token configurado)
- [ ] 9.6 Validar em campo: publicar com o `publicar.ps1` e conferir a linha em `app_versions` com `origin = PUBLISHER`
- [ ] 9.7 Validar o espelho: derrubar o aviso de propósito e conferir a descoberta com `origin = MIRROR` na rodada seguinte
- [ ] 9.8 Validar a guarda: publicar a `N+1`, deixar o espelho ler o cache velho da CDN e conferir que a versão **não** regride
- [ ] 9.9 Validar o disparo com uma estação real: `update_now` chega, a máquina baixa e o `register` seguinte traz a versão nova

## 10. Documentação

- [x] 10.1 `docs/DATABASE.md`: tabela `app_versions` e por que o envelope é texto cru
- [x] 10.2 `docs/DOC.md`: as duas rotas novas, os três campos novos do inventário e a mensagem `update_now`
- [x] 10.3 `docs/ROADMAP.md`: seção de versão do Desktop
- [x] 10.4 `docs/DEPLOY.md`: as três variáveis novas e o que acontece quando não estão configuradas
