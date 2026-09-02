# Deploy — Coolify + Nginx Proxy Manager

> Runbook de como a API vai pro ar em produção. Servidor Coolify roda na rede
> interna da OAB (`192.168.1.49`) e é exposto ao público no domínio
> `api-fr.oabma.org.br`, com DNS na Locaweb e TLS terminado no Nginx Proxy
> Manager.

---

## Arquitetura

```
Internet → DNS Locaweb (A: api-fr.oabma.org.br → 177.54.133.139)
         → NAT do roteador (80/443)
         → Nginx Proxy Manager (host 192.168.1.49:80/443, TLS Let's Encrypt)
         → host 192.168.1.49:3333 (porta publicada pelo container)
         → container da API (porta 3333)
```

- **Quem termina o TLS e roteia por `Host` header é o Nginx Proxy Manager**
  (`nginx.oabma.org.br:81` é o painel dele). Ele ocupa as portas `80`/`443` do
  host.
- **O Traefik do Coolify não participa deste caminho.** Como o NPM já tomou as
  portas `80`/`443`, os labels Traefik que o Coolify gera para a aplicação são
  inertes. Por isso a API **precisa publicar a porta no host** (`Port Mappings`)
  — é assim que o NPM alcança o container. Ver a seção de configuração abaixo.
- O dashboard do Coolify (`coolify.oabma.org.br`) roda com porta própria mapeada
  (`8000:8080`) e também é publicado via NPM.

> Arquitetura anterior (Cloudflare Tunnel → Traefik → rede interna `coolify`,
> em `hit.dev.br`) foi substituída. Se voltar a usar o Traefik, `Port Mappings`
> volta a ser vazio — as duas coisas são mutuamente exclusivas.

---

## Dockerfile

Build multi-stage (`node:24-slim`), 3 estágios:

1. **base** — instala `openssl` (Prisma precisa disso presente *antes* do
   `pnpm install` pra detectar o engine certo — senão cai no fallback
   `openssl-1.1.x`, incompatível) e fixa `pnpm@11.18.0` via Corepack.
2. **deps** — `pnpm install --frozen-lockfile` (dev + prod) e `prisma generate`
   (via `postinstall`).
3. **build** — roda `pnpm build` (tsup), gera `build/http/server.js` (ESM).
4. **runtime** — imagem final. Copia `node_modules`, `generated/` (Prisma
   Client), `build/`, **e também** `prisma.config.ts`, `tsconfig.json` e `src/`.

### Por que `src/`, `tsconfig.json` e `prisma.config.ts` também vão pro runtime

O `build/` (bundle tsup) só cobre o **servidor**. O entrypoint roda
`pnpm db:deploy` (`prisma migrate deploy && prisma db seed`) **antes** de subir
o servidor, e isso depende de:

- **`prisma.config.ts`** — desde o Prisma 7, `schema.prisma` não tem mais
  `url` no bloco `datasource` (só `provider = "postgresql"`). Quem resolve a
  URL é `prisma.config.ts` via `env('DATABASE_URL')`. Sem esse arquivo na
  imagem, `prisma migrate deploy` falha com
  `The datasource.url property is required in your Prisma config file`.
- **`tsconfig.json` + `src/`** — `prisma db seed` roda `tsx prisma/seed.ts`
  direto do TypeScript fonte (não do bundle), e `seed.ts` importa via alias
  `@/*` (`@/http/env`, `@/lib/resend` etc.), resolvido pelo `paths` do
  `tsconfig.json`. Sem `src/` na imagem, o `tsx` não acha os módulos.

Isso deixa a imagem de runtime maior do que um Node "puro" rodando só o
bundle, mas é o trade-off de reaproveitar `tsx` para migrations/seed em vez de
compilar o script de seed separadamente.

### `docker-entrypoint.sh`

```sh
pnpm run db:deploy   # prisma migrate deploy && prisma db seed
exec "$@"             # CMD: pnpm start → node build/http/server.js
```

Roda a cada boot do container. `migrate deploy` é idempotente (só aplica
migrations pendentes) e o seed do admin é idempotente por guard
(`prisma/seed.ts` — não recria se o e-mail já existir).

---

## Configuração no Coolify

1. **Resource** → repositório `devoabma/api-fr`, branch `main`.
2. **Build Pack**: `Dockerfile` (não Nixpacks).
3. **Ports Exposes**: `3333` (bate com `EXPOSE 3333` do Dockerfile).
4. **Port Mappings**: `3333:3333` — **obrigatório nesta arquitetura**. Sem isso
   o container fica só na rede Docker interna `coolify`, nada escuta em
   `192.168.1.49:3333` e o NPM devolve `504 Gateway Time-out`. Ver a armadilha
   abaixo.
5. **Domains**: pode ficar com o `sslip.io` gerado ou vazio — quem publica o
   domínio é o NPM, não o Traefik do Coolify.

> ⚠️ **`Port Mappings` vazio + NPM = 504.** É a armadilha mais cara desta
> configuração porque *tudo* parece certo: build passa, container fica
> `Running (healthy)`, o log mostra `Servidor iniciado com sucesso!`. O
> healthcheck do Dockerfile roda **dentro** do container (`localhost:3333`), então
> ele fica verde mesmo com a porta não publicada — o healthcheck verde não prova
> que alguém de fora alcança a API.
>
> Como confirmar em 5 segundos, de qualquer máquina da rede:
>
> ```sh
> curl -sI -m 5 http://192.168.1.49:3333/health   # tem que responder 200
> ```
>
> Se der timeout com o container `healthy`, é `Port Mappings`. Depois de
> preencher, use **Redeploy** e não `Restart`: publicar porta exige recriar o
> container.

### Environment Variables — Buildtime vs Runtime

O Dockerfile **não usa nenhuma env var no build** (só `pnpm install` +
`pnpm build`, sem `ARG` nenhum nos estágios `deps`/`build`). Por isso, **toda**
variável deve ficar marcada só como **"Available at Runtime"**, com
**"Available at Buildtime" desmarcado**.

> ⚠️ Se "Available at Buildtime" ficar marcado, o Coolify injeta a variável
> como `ARG` no Dockerfile gerado — e o valor fica **gravado em texto puro**
> nas camadas da imagem (visível em `docker history` / no próprio log de
> build do Coolify). Isso já aconteceu uma vez em deploy anterior com
> `JWT_SECRET`, `PASSWORD_ADMIN`, `RESEND_API_KEY`,
> `SUPABASE_SERVICE_ROLE_KEY` e a senha do `DATABASE_URL` expostos no log.
> Corrigido desmarcando o toggle pra cada variável.

Variáveis necessárias (mesmas do `.env.example`, com valores de produção):
`NODE_ENV`, `API_PORT`, `TIMEZONE`, `TRUST_PROXY`, `WEB_URL`, `DOMAIN_URL`,
`TOKEN_COOKIE_NAME`, `CPF_ADMIN`, `PASSWORD_ADMIN`, `EMAIL_ADMIN`,
`ALLOW_DEFAULTING_LAWYERS` (opcional — ver seção abaixo),
`APP_MANIFEST_URL`, `APP_VERSION_PUBLISH_TOKEN` e `APP_MANIFEST_PUBLIC_KEY`
(opcionais — ver seção abaixo),
`DATABASE_URL`, `RESEND_API_KEY`, `JWT_SECRET`, `PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `API_PROTHEUS_DATA_URL`.

`TIMEZONE` é o fuso da seccional (IANA, ex: `America/Fortaleza`). Ele governa o
cálculo de tempo das sessões e o horário dos jobs agendados — não o fuso do
servidor. Se não for definido, cai no default `America/Fortaleza`; se vier um
valor inválido, a API não sobe (falha no boot em vez de errar horário calado).

`WEB_URL` é a **origem exata do front web** — esquema + host + porta, sem
caminho e **sem barra no fim** (ex: `https://app.oabma.org.br`). Ela governa
duas coisas: os links dos e-mails e a política de CORS. No CORS o valor é
comparado byte a byte com o header `Origin` que o navegador envia, e esse
header nunca tem barra final; uma barra sobrando bloqueia o front inteiro
**sem gerar uma linha de log na API**, porque quem barra é o navegador. A API
corta barras finais por conta própria e recusa subir se o valor vier sem
esquema, mas o host errado ela não tem como adivinhar — confira no primeiro
deploy.

`DATABASE_URL` aponta pra um Postgres externo, então não depende de rede
interna do Docker — funciona igual em dev e em produção.

### `$` em variável de ambiente é engolido pelo Docker Compose

O Coolify grava as variáveis num `.env` e sobe a stack com `docker compose`, que
**interpola `$`**. Um valor com cifrão é lido como referência a outra variável,
não como texto:

```
PASSWORD_ADMIN=@#$oabMA2k26
                 └────────┘ Compose procura a variável "oabMA2k26",
                            não encontra, substitui por string vazia

container recebe:  PASSWORD_ADMIN=@#
```

**A correção é duplicar o cifrão** — `$$` produz um `$` literal:

```
PASSWORD_ADMIN=@#$$oabMA2k26
```

Vale para qualquer variável: senhas, `JWT_SECRET`, a senha dentro do
`DATABASE_URL`, chaves de API.

O que torna isso perigoso é que **nada falha**. Não há erro de boot, o container
sobe saudável e a API funciona — só que com o valor errado. O único vestígio fica
no log do deploy, uma linha fácil de perder no meio do build:

```
level=warning msg="The \"oabMA2k26\" variable is not set. Defaulting to a blank string."
```

Sempre que aparecer `variable is not set. Defaulting to a blank string` com um
pedaço reconhecível de um segredo seu, é este bug.

> **Caso real (12/ago/2026):** o `PASSWORD_ADMIN` do primeiro deploy em
> `oabma.org.br` chegou no container como `@#`. O seed gerou o hash bcrypt de
> `@#`, o e-mail de boas-vindas imprimiu `@#`, e o login com a senha "real"
> retornava credenciais inválidas — corretamente, porque essa senha nunca
> existiu no banco.

#### Corrigir a env não conserta um admin já criado

O seed é idempotente por e-mail ([`prisma/seed.ts`](../prisma/seed.ts)): se já
existe alguém com o `EMAIL_ADMIN`, ele imprime `> Administrador já cadastrado.
Nenhuma ação necessária.` e **ignora o novo valor de `PASSWORD_ADMIN`**. Redeploy
sozinho não troca senha nenhuma.

Duas saídas, depois de corrigir a variável:

| Saída | Como | Quando |
| --- | --- | --- |
| Trocar pela API | Autenticar com a senha truncada (o valor que chegou de fato) e chamar `PATCH /change-password` | ambiente com dados; não toca no banco |
| Re-seedar | Apagar a linha do admin em `employees` e dar **Redeploy** | ambiente ainda vazio; reenvia o e-mail com a senha certa |

No caminho do re-seed, corrija a variável **antes** de apagar o registro — senão
o seed recria o admin com o mesmo valor truncado.

### `ALLOW_DEFAULTING_LAWYERS` — liberação geral por determinação da OAB

Normalmente **não existe** nas variáveis do Coolify (ausente = `false` = só
adimplente libera computador). Ela só entra em cena quando a diretoria
determina liberação geral, adimplentes e inadimplentes.

Para ligar: criar a variável com o valor `true` e **reiniciar** o container
(ela é lida uma única vez, no boot). Não precisa de build nem de migração.
Para desligar: apagar a variável (ou pôr `false`) e reiniciar de novo.

| Valor | Efeito |
| --- | --- |
| ausente / `false` | ✅ operação normal — inadimplente recebe `400` |
| `true` | ⚠️ inadimplente libera computador |
| `1`, `sim`, `yes`, `on` | ✅ tratado como `false` — só a string `true` liga |

A última linha é proposital: um valor ambíguo lido como `true` liberaria
inadimplentes sem ninguém ter pedido e passaria meses despercebido, enquanto
lido como `false` alguém reclama no mesmo dia que a determinação não pegou.

A exceção suspende **apenas** a pendência financeira. Advogado(a) com registro
fora das situações liberadas (inativo, cancelado) continua barrado, e as demais
regras — conferência de CPF/OAB/nascimento, cota diária, sala ativa,
computador livre — seguem valendo.

Enquanto estiver ligada, todo boot imprime um aviso vermelho nos logs do
container. É o único ponto do sistema que anuncia a exceção: vale marcar no
calendário a data em que a determinação vence, porque a variável não expira
sozinha.

### `APP_MANIFEST_URL`, `APP_VERSION_PUBLISH_TOKEN` e `APP_MANIFEST_PUBLIC_KEY` — versão publicada do Desktop

As três são **opcionais**, e a API sobe normalmente sem nenhuma delas. Cada uma
liga uma parte diferente, e vale saber o que fica desligado:

| Variável | Ausente / vazia | Configurada |
| --- | --- | --- |
| `APP_MANIFEST_URL` | cai no default `https://salalivre.app/versao.json` | o job de espelho lê deste endereço |
| `APP_VERSION_PUBLISH_TOKEN` | `POST /app/version` responde **`503`** e não aceita nada | o `publicar.ps1` consegue avisar a API no instante da publicação |
| `APP_MANIFEST_PUBLIC_KEY` | conferência de assinatura **desligada** | manifesto com assinatura inválida é recusado na entrada |

**Sem o token, o recurso continua funcionando.** O job de espelho sozinho
descobre a versão publicada em até 5 minutos — o token só antecipa isso para o
instante da publicação. O `503` é padrão seguro deliberado: o contrário seria
comparar segredo vazio com segredo vazio e aceitar qualquer manifesto que
batesse à porta.

O token precisa de **no mínimo 32 caracteres** e é gerado com
`openssl rand -hex 32`. Vazio ou só com espaços vale como "não configurado", e
não como erro de boot — o `.env.example` copiado não pode derrubar a API. Já um
valor **curto** reprova na validação e a API não sobe: segredo pela metade é
pior do que segredo nenhum, porque parece configurado.

Trocar o token exige mexer no `.env` da API **e** no cofre de quem publica,
nessa ordem, com uma janela em que a publicação falha com `401`. Não há
rotação automática.

`APP_MANIFEST_PUBLIC_KEY` é a chave **pública** do publicador, em DER/SPKI
base64. **Não é segredo** — ela já viaja dentro de todo executável instalado no
parque, e publicá-la não abre nada. A privada, que assina, nunca chega perto da
API: a API não assina manifesto em hipótese alguma.

E a conferência aqui **não é o que protege o parque**. Quem protege é cada
estação, que valida o mesmo envelope com a chave embutida no próprio executável
antes de instalar qualquer coisa. Esta é uma rede a mais, contra token vazado
empurrando lixo e contra arquivo corrompido virando "versão publicada" no
painel.

### `TRUST_PROXY` — o valor muda entre dev e produção

**Em produção precisa ser `loopback,uniquelocal`.** É a única variável cujo
valor local (`false`) está errado aqui, e o erro é silencioso: não quebra o
boot, não gera log — só faz o rate limit contar todo mundo junto.

O motivo é a arquitetura do topo deste documento. Quem abre a conexão TCP com o
container é sempre o **Nginx Proxy Manager**, num IP privado. O IP real do
cliente vem no header `X-Forwarded-For`, que é uma **lista** onde cada proxy
anexa à direita quem falou com ele:

```
X-Forwarded-For: 203.0.113.50, 172.18.0.9
                 └─ cliente     └─ NPM
                    (posto pelo NPM via
                     $proxy_add_x_forwarded_for)
```

O que cada valor faz, com essa cadeia (`req.ip` que o rate limit enxerga):

| `TRUST_PROXY` | Normal | Se o cliente forjar o header | Veredito |
| --- | --- | --- | --- |
| `false` | `172.18.0.9` (NPM) | `172.18.0.9` | ❌ todos no mesmo balde |
| `true` | `203.0.113.50` | **`8.8.8.8`** | ❌ spoofável |
| `1` | `172.18.0.9` | `172.18.0.9` | ❌ hop errado |
| `2` | `203.0.113.50` | `203.0.113.50` | ⚠️ funciona, mas frágil |
| `loopback,uniquelocal` | `203.0.113.50` | `203.0.113.50` | ✅ |

- **`false`** ignora o header: toda requisição do planeta chega com o IP do
  NPM. O teto global de 300/min vira 300/min para a API inteira, e
  `password-recovery` vira 5 pedidos a cada 15 min **no total**. Pior: qualquer
  um de fora derruba o acesso de todos gastando o balde compartilhado.
- **`true`** confia na lista inteira e pega o item mais à esquerda — justamente
  a parte que o cliente escreve. O `$proxy_add_x_forwarded_for` do Nginx **não
  apaga** o que o cliente mandou, ele anexa o IP real depois
  (`8.8.8.8, 203.0.113.50, 172.18.0.9`). Trocando o header a cada requisição, o
  atacante ganha um balde novo sempre.
- **`2`** conta hops da direita pra esquerda e acerta hoje, mas quebra calado no
  dia em que entrar ou sair um proxy do caminho.
- **`loopback,uniquelocal`** lê da direita pra esquerda descartando faixas
  privadas (`10.x`, `172.16-31.x`, `192.168.x`, `127.x`) e para no primeiro IP
  público — o real. A mentira do cliente fica à esquerda e é ignorada, e o
  valor não depende de contar hops.

Em desenvolvimento fica `false`: sem proxy na frente, o IP da conexão já é o
verdadeiro. Efeito colateral local: tudo vem de `127.0.0.1`, então front,
Insomnia e app desktop dividem o mesmo balde (reiniciar a API zera os
contadores — o store é em memória).

> Como conferir no primeiro deploy: a tabela acima assume o comportamento
> padrão do Nginx. Para validar com tráfego real, estoure de propósito um
> limite barato (ex.: 61 chamadas em rotas inexistentes, teto de 60/min) de duas
> redes diferentes — celular no 4G e máquina na rede da OAB. Se as duas caírem
> no `429` juntas, o IP não está chegando e o `TRUST_PROXY` precisa de ajuste.
> Se cada uma tiver seu próprio contador, está correto.

> ⚠️ **A porta `3333` publicada no host enfraquece isso dentro da LAN.** Como o
> `Port Mappings` expõe a API em `192.168.1.49:3333`, quem já está na rede
> interna pode falar direto com o container, pulando o NPM, e forjar um
> `X-Forwarded-For` com IP público — que o `loopback,uniquelocal` vai aceitar.
> Contra a internet a proteção continua válida (o NAT só encaminha `80`/`443`),
> mas o rate limit não é uma defesa confiável contra quem está na rede da OAB.
> Se isso passar a importar, a saída é tirar a porta do host e colocar o
> container do NPM na rede Docker `coolify`, apontando o forward para o nome do
> serviço em vez de `192.168.1.49`.

### Health check

A API expõe **duas** rotas de saúde, que respondem a perguntas diferentes. Ler
uma achando que é a outra é a fonte de confusão mais comum aqui:

| Rota | Pergunta | Quem consome | Toca no banco |
| --- | --- | --- | --- |
| `GET /health` | **vivacidade** — o processo está atendendo? | `HEALTHCHECK` do container | não |
| `GET /ready` | **prontidão** — dá para atender de verdade? | selo do painel web | sim (`SELECT 1`) |

Ambas são públicas, sem auth.

#### `/health` — vivacidade (é o que o container lê)

Responde `200 {"status":"ok"}` sem tocar em nada. O Dockerfile define o
`HEALTHCHECK` usando o `fetch` nativo do Node (sem precisar de `curl`/`wget`
na imagem):

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=90s --retries=3 \
    CMD node -e "fetch('http://localhost:3333/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
```

O `start-period` é generoso de propósito: `migrate deploy` + seed rodam no
entrypoint **antes** da porta 3333 abrir, e um período curto marcaria o
container como `unhealthy` no meio de uma migration longa.

Isso é o suficiente pro Coolify parar de mostrar `Running (unknown)` e passar
a reportar `Healthy`/`Unhealthy` de verdade — não precisa configurar nada a
mais na aba **Healthcheck** do Coolify, ele lê o `HEALTHCHECK` da imagem
automaticamente.

> 🚫 **Não aponte o `HEALTHCHECK` para `/ready`.** Parece um upgrade e é uma
> armadilha: para o orquestrador, "não saudável" significa uma coisa só —
> **reiniciar o container**. Reiniciar a API não conserta banco fora do ar; só
> derruba o WebSocket dos Desktops de **todas** as salas e, se a queda durar,
> vira laço de reinício. Com o Neon em scale-to-zero, um cold start já bastaria
> para disparar isso. `/health` responde ao container; `/ready` responde a
> gente.

> ⚠️ **`Healthy` não significa "acessível".** O comando roda de dentro do
> container, contra `localhost`. Ele fica verde mesmo se o `Port Mappings`
> estiver vazio, se o NPM estiver mal configurado ou se o DNS não resolver.
> Para saber se a API está de fato no ar, teste pelo domínio público.

#### `/ready` — prontidão (é o que o painel lê)

Sonda o banco com `SELECT 1` e responde:

| Situação | Resposta |
| --- | --- |
| banco respondeu | `200 {"status":"ok","database":"up"}` |
| banco não respondeu, ou levou mais de 3s | `503 {"status":"error","database":"down"}` |

O teto de **3s** é menor de propósito que o `connectionTimeoutMillis: 15_000`
do pool (`src/lib/prisma.ts`, dimensionado para o cold start do Neon). Numa
rota de dado, esperar 15s protege a leitura; numa sonda, atrapalha — a espera
seria maior justamente quando o banco está mal, e quem perguntou desistiria
antes por timeout do cliente, recebendo erro de rede genérico no lugar do
`503` legível. Aqui, estourar o tempo **é** a resposta.

Tem teto de **60 req/min por IP** — é rota pública que faz a API abrir conexão
com o banco, então não entra na lista de isentas junto com `/health` e
`/docs`. Para o painel é folga larga (2 perguntas por minuto por aba).

Para diagnosticar em produção:

```bash
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' https://api-fr.oabma.org.br/health
curl -s https://api-fr.oabma.org.br/ready
```

| O que você vê | O que significa | O que fazer |
| --- | --- | --- |
| `/health` 200 · `/ready` 200 | tudo no ar | nada |
| `/health` 200 · `/ready` 503 | API no ar, **banco fora** | olhar o Neon (scale-to-zero acordando? credencial? `DATABASE_URL`?) — **não** reiniciar o container |
| `/health` não responde | processo ou rota de rede fora | container, `Port Mappings`, NPM, DNS — nessa ordem |

> ⚠️ Quem escreve o selo do painel precisa distinguir **`503`** ("API no ar,
> banco fora") de **falha de rede** ("API fora"). São diagnósticos diferentes e
> levam a ações diferentes; exibir a mesma mensagem para os dois joga fora
> exatamente a informação que esta rota existe para dar.

> ℹ️ Nenhuma das duas rotas aparece no `/docs`. O `@fastify/swagger` descobre
> rotas por hook `onRoute`, que só enxerga o que é registrado depois dele — e
> as duas são registradas antes. Estão documentadas aqui, em prosa, de
> propósito.
---

## DNS e Nginx Proxy Manager

### DNS (Locaweb)

Registro na zona de `oabma.org.br`:

| Nome | Tipo | Valor |
| --- | --- | --- |
| `api-fr` | `A` | `177.54.133.139` (IP público da OAB) |

O roteador precisa encaminhar `80` e `443` para `192.168.1.49`. A porta `80` não
é opcional mesmo que só se use HTTPS: é por ela que o Let's Encrypt faz o
desafio HTTP-01 na emissão e na renovação a cada 90 dias.

### Proxy Host (`nginx.oabma.org.br:81`)

| Campo | Valor |
| --- | --- |
| Domain Names | `api-fr.oabma.org.br` |
| Scheme | `http` |
| Forward Hostname / IP | `192.168.1.49` |
| Forward Port | `3333` |
| Websockets Support | **ligado** |
| Block Common Exploits | ligado |
| SSL | certificado Let's Encrypt + **Force SSL** |

O `Websockets Support` é obrigatório: sem ele o Nginx não repassa o
`Upgrade: websocket` e o canal permanente dos Desktops
(`wss://api-fr.oabma.org.br/ws/computers`) nunca completa o handshake.

O TLS termina no NPM e o tráfego segue em `http` na rede interna — por isso o
`Scheme` é `http`, não `https`. Apontar `https` para a porta `3333` (que fala
HTTP puro) resulta em erro de handshake.

#### Timeout do WebSocket

O padrão do Nginx é `proxy_read_timeout 60s`, e o heartbeat da API é um
ping/pong a cada 30s — passa, mas com pouca folga: um atraso de rede derruba a
conexão do Desktop. Na aba **Advanced** do proxy host:

```nginx
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

> ⚠️ **Não apontar o forward para a porta `8000`** — essa é a porta do dashboard
> do Coolify (`coolify` container, mapeado `8000:8080`). O domínio da API cairia
> na tela de login do Coolify.

---

## Checklist de um novo deploy

- [ ] Alterações commitadas e pushadas em `main`.
- [ ] No Coolify: **Deploy**.
- [ ] Acompanhar o log: build (se o commit mudou) → `docker-entrypoint.sh`
      (`No pending migrations` ou lista de migrations aplicadas + seed) →
      `Servidor iniciado com sucesso!`.
- [ ] Procurar no log do deploy por `variable is not set. Defaulting to a blank
      string` — se aparecer com um pedaço de algum segredo, é `$` não escapado
      (ver seção acima). O deploy **não falha** por causa disso.
- [ ] Conferir status do container: `Running`/`Healthy`, não `Restarting`.
- [ ] Testar de dentro da rede: `curl -sI http://192.168.1.49:3333/health` →
      `200`. Prova que a porta está publicada.
- [ ] Testar pelo domínio: `curl -s https://api-fr.oabma.org.br/health` →
      `{"status":"ok"}`. Prova que NPM, DNS e TLS estão de pé.
- [ ] Testar a prontidão: `curl -s https://api-fr.oabma.org.br/ready` →
      `{"status":"ok","database":"up"}`. Prova que o banco responde — é o
      único dos testes acima que sai do processo e encosta no Neon. Um `503`
      aqui com `/health` em `200` é banco fora, não API fora.
- [ ] Abrir `https://api-fr.oabma.org.br/docs` (Scalar).

## Troubleshooting

| Sintoma | Causa provável |
| --- | --- |
| Container em `Restarting` em loop | Ver `docker logs <container>` — geralmente erro do `prisma migrate deploy`/`db seed` no entrypoint. |
| `The datasource.url property is required...` | `prisma.config.ts` não está na imagem de runtime (ver seção Dockerfile acima). |
| `Cannot find module '@/...'` no seed | `src/` ou `tsconfig.json` faltando na imagem de runtime. |
| Domínio público cai na tela do Coolify em vez da API | Proxy host do NPM apontando pra porta `8000` em vez de `3333`. |
| `504 Gateway Time-out` com o container `Running (healthy)` | `Port Mappings` vazio no Coolify: nada escuta em `192.168.1.49:3333`. Preencher `3333:3333` e **Redeploy** (não `Restart`). Confirmar com `curl -sI http://192.168.1.49:3333/health`. |
| Página "Congratulations! You've successfully started the Nginx Proxy Manager" | O `Host` da requisição não bateu com nenhum proxy host — domínio digitado diferente do cadastrado, ou o proxy host ainda não foi salvo. |
| Senha do admin não funciona, mas o e-mail de boas-vindas chegou com ela truncada | `$` na variável interpolado pelo Docker Compose. Escapar com `$$` — e lembrar que o seed é idempotente, corrigir a variável não troca a senha de um admin já criado. Ver seção acima. |
| Links dos e-mails apontando pra `localhost` | `WEB_URL` com o valor de desenvolvimento. É usada na montagem dos links de cadastro e recuperação de senha. |
| Front web inteiro tomando erro de CORS, sem nada no log da API | `WEB_URL` diferente da origem real do front — tipicamente com **barra no fim** ou com o host de outro ambiente. O bloqueio é do navegador, então o servidor não registra nada. Conferir o valor no Coolify e comparar com o `Origin` que aparece no DevTools. |
| Leituras funcionam no front, mas toda edição/exclusão toma erro de rede sem corpo | Preflight sem o método na lista: `access-control-allow-methods` não inclui `PUT`/`PATCH`/`DELETE`. O bloqueio é do navegador antes de enviar, então não há log na API. Conferir a opção `methods` no registro do `@fastify/cors` em `src/http/app.ts`. |
| Front loga com sucesso e a chamada seguinte volta `401` | O front não está enviando credenciais: falta `credentials: 'include'` (fetch) ou `withCredentials: true` (axios). O cookie de sessão é `httpOnly` e só acompanha a requisição quando o cliente pede. |
| Desktop conecta no WebSocket e cai sozinho depois de ~1 min | `Websockets Support` desligado no proxy host, ou `proxy_read_timeout` curto demais. Ver seção do NPM. |
| Secrets aparecem em texto puro no log de build do Coolify | Variável marcada como "Available at Buildtime" — desmarcar, deixar só "Available at Runtime". |
| Usuários tomando `429` sem motivo / login e recuperação de senha bloqueados pra todo mundo ao mesmo tempo | `TRUST_PROXY` em `false` (ou ausente) em produção: o rate limit está contando todos os clientes como um IP só. Ver seção acima. |
| Determinação de liberação geral não pegou — inadimplente continua recebendo `400` | `ALLOW_DEFAULTING_LAWYERS` com valor diferente da string `true` (ex: `1`, `sim`), ou container não reiniciado depois de criar a variável. Confirmar o aviso vermelho nos logs do boot. |
| Inadimplente liberando computador sem determinação vigente | `ALLOW_DEFAULTING_LAWYERS=true` esquecida de uma determinação anterior. Apagar a variável e reiniciar. |
| API não sobe, log reclamando de `APP_VERSION_PUBLISH_TOKEN` | Token com menos de 32 caracteres. Vazio ou ausente sobe normal (a rota de publicação é que responde `503`); **curto** reprova de propósito, porque segredo pela metade parece configurado. Gerar com `openssl rand -hex 32`. |
| `publicar.ps1` recebendo `503` em `POST /app/version` | A API está sem `APP_VERSION_PUBLISH_TOKEN`. Criar a variável no Coolify e reiniciar o container. Enquanto isso, o job de espelho ainda descobre a versão em até 5 minutos. |
| `publicar.ps1` recebendo `401` | Token do cofre de publicação diferente do que está na API — tipicamente uma troca feita de um lado só. |
| Painel mostrando todas as estações como `unknown` | A API ainda não conhece nenhuma versão publicada. Conferir nos logs se o espelho está lendo (`[Espelho ...]`) e se `APP_MANIFEST_URL` aponta para o arquivo certo. |
| Versão nova publicada e o painel não mostra, sem erro em lugar nenhum | `APP_MANIFEST_PUBLIC_KEY` preenchida com valor errado (ou só espaços): todo manifesto é recusado como `invalid_signature`. Procurar `[Versão ⚠️ ]` / `[Espelho ⚠️ ]` no log. Para descartar, esvaziar a variável — a conferência desliga e a API volta a só transportar o que já vem assinado. |
