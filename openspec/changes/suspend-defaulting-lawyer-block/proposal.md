## Why

O bloqueio por inadimplência em `POST /lawyers/release-computer` é uma regra **administrativa**, não técnica: a diretoria da OAB pode determinar, por decisão política, que a sala seja aberta a todos os advogados(as) — adimplentes e inadimplentes — por um período. Já aconteceu de a determinação chegar e a única saída ser **comentar o `if`** na rota.

Comentar código para isso é o pior caminho disponível:

- some do diff (a regra ativa deixa de ser legível no código);
- quebra o lint (`consultedLawyer.adimplente` vira leitura morta);
- exige build e deploy para ligar **e** para desligar;
- quando a determinação vence, ninguém lembra o que foi comentado nem por quê.

O objetivo desta entrega é transformar essa exceção em **configuração explícita**, reversível sem alterar código e visível no boot.

## What Changes

- **Nova variável de ambiente `ALLOW_DEFAULTING_LAWYERS`** (`src/http/env.ts`), padrão `false`:
  - `false` — comportamento atual: só advogado(a) adimplente libera computador;
  - `true` — o bloqueio por inadimplência é suspenso; adimplentes e inadimplentes liberam.
  - O parse é tolerante a espaço e caixa (`" TRUE "` vale), mas **qualquer outro valor é lido como `false`**. Um `"1"` ou `"sim"` digitado errado no deploy MUST NOT abrir a exceção por acidente.
- **`src/http/core/lawyers/release-computer.ts`**: a checagem passa a ser `if (!env.ALLOW_DEFAULTING_LAWYERS && !consultedLawyer.adimplente)`. Nenhuma outra validação muda.
- **`src/http/server.ts`**: quando a flag está ligada, o boot emite um aviso destacado em vermelho. A exceção é temporária por natureza e a flag é permanente — sem o aviso, ela sobrevive à determinação que a justificou.
- **`.env.example` e `docs/DOC.md`** passam a registrar a flag e a ressalva na regra de negócio.

## Capabilities

### Added Capabilities
- `runtime-configuration`: o bloqueio de liberação por inadimplência passa a ser governado por variável de ambiente, com padrão seguro (bloqueio ativo).

### Modified Capabilities
- `lawyer`: a liberação de computador deixa de exigir adimplência **incondicionalmente** — passa a exigi-la salvo quando a instância estiver configurada para liberação geral.

## Impact

- Alterados: `src/http/env.ts`, `src/http/core/lawyers/release-computer.ts`, `src/http/server.ts`, `.env.example`, `docs/DOC.md`, `docs/ROADMAP.md`.
- Contrato HTTP: nenhuma rota nova, nenhum campo novo. Com a flag desligada, as respostas são byte a byte as de hoje.
- Banco: nenhuma migração.
- Deploy: ambientes existentes continuam idênticos sem tocar em nada — a ausência da variável equivale a `false`.
- Ligar/desligar exige apenas alterar a variável e reiniciar o container: sem build, sem migração, sem alteração de código.

## Behavior Change

Com `ALLOW_DEFAULTING_LAWYERS=true`, advogado(a) inadimplente deixa de receber `400 "Advogado(a) inadimplente..."` e passa a abrir sessão normalmente. A exceção é **cirúrgica**: a validação de `situacao` (inativo, cancelado, suspenso fora das situações liberadas) continua valendo, assim como a conferência de CPF/OAB/nascimento, a cota diária e as regras de sala e computador.

## Known Limitations

1. **Ligar e desligar exige reinício do processo.** O `env` é lido e validado uma única vez no boot. Uma alternativa considerada foi persistir a decisão no banco (tabela de configuração + rota ADMIN), o que permitiria à diretoria acionar a exceção pela web, com auditoria de quem ligou e quando. Descartada nesta entrega: custaria migração, rota, autorização e cache, além de uma consulta a mais na rota pública mais quente do sistema — caro demais para um evento raro, num deploy Docker onde reiniciar leva segundos. Se a alternância virar rotina, a migração é barata: a decisão está isolada em uma única condição.

2. **A flag é invisível para os clientes.** Nem o app desktop nem o front sabem que a liberação geral está vigente — não há rota que exponha o estado da flag. Um aviso do tipo "liberação geral por determinação da OAB" na tela de login exigiria expor isso publicamente, o que fica para quando for pedido.

3. **Não há registro de quem ligou.** A rastreabilidade fica no histórico de configuração da plataforma de deploy, fora do repositório e fora do banco. Sessões abertas durante a vigência não ficam marcadas como "liberadas por exceção" — se um dia for preciso relatório dessas liberações, seria necessário um campo em `computerSessions`.
