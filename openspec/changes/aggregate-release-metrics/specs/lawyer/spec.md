## ADDED Requirements

### Requirement: Agregação das liberações para a tela de métricas

A API SHALL expor `GET /lawyers/releases-metrics/:roomId?` devolvendo as liberações **já agregadas**, para que o painel não precise baixar o histórico bruto. A rota MUST exigir autenticação de funcionário (JWT). A resposta MUST ser um objeto `{ metrics: { ... } }`.

**Motivação:** a única rota de sessões existente devolve a lista completa sem paginação. Desenhar um gráfico "por ano" sobre ela transferiria o histórico inteiro para o navegador a cada visita — dezenas de milhares de registros para produzir quatro números.

O param `roomId` (opcional, cuid2) MUST recortar `kpis`, `byYear` e `byMonth` para uma sala. A querystring MAY conter `year` (inteiro); quando ausente, a API MUST usar o ano corrente no fuso configurado em `env.TIMEZONE`.

A visibilidade MUST respeitar o papel: ADMIN MUST ver todas as salas; MEMBER MUST ver apenas as salas em que está vinculado (`employeesRooms`). Se um MEMBER informar `roomId` de sala à qual não está vinculado, a resposta MUST ser `200` com os contadores zerados — nunca um erro. A rota MUST NOT ser restrita a ADMIN.

O agrupamento por ano e por mês MUST ser feito no fuso de `env.TIMEZONE`, convertendo `started_at` (que é `TIMESTAMP` sem timezone, gravado em UTC) com dupla conversão. A API MUST NOT agrupar em UTC.

#### Scenario: ADMIN consulta sem filtro de sala

- **WHEN** um funcionário ADMIN chama `GET /lawyers/releases-metrics` sem `roomId`
- **THEN** a API responde `200` com os indicadores de todas as salas no ano corrente

#### Scenario: MEMBER só enxerga as suas salas

- **WHEN** um funcionário MEMBER chama `GET /lawyers/releases-metrics` sem `roomId`
- **THEN** a API responde `200` agregando apenas liberações de salas em que o funcionário está vinculado

#### Scenario: MEMBER filtra por sala à qual não pertence

- **WHEN** um funcionário MEMBER informa `roomId` de uma sala à qual não está vinculado
- **THEN** a API responde `200` com os contadores zerados

#### Scenario: Liberação na virada do ano

- **WHEN** uma sessão começou às 23h do dia 31 de dezembro no fuso da Seccional
- **THEN** ela é contada no mês de dezembro daquele ano, e não em janeiro do ano seguinte

### Requirement: Ranking entre salas independente do filtro de sala

A lista `byRoom` MUST ignorar o `roomId` informado e sempre trazer todas as salas visíveis ao funcionário, ordenadas por total decrescente. Salas sem nenhuma liberação no período MUST aparecer com `total: 0`.

**Motivação:** `byRoom` é um ranking de utilização entre salas. Aplicar nele o filtro de sala reduziria o ranking a uma única barra em 100%, que não informa nada; e omitir as salas sem movimento esconderia justamente a sala ociosa que o gestor precisa enxergar.

#### Scenario: Ranking com uma sala filtrada

- **WHEN** o funcionário informa `roomId` de uma sala específica
- **THEN** `kpis`, `byYear` e `byMonth` refletem apenas aquela sala, mas `byRoom` continua listando todas as salas visíveis

#### Scenario: Sala sem liberações no período

- **WHEN** uma sala visível ao funcionário não teve nenhuma liberação no ano consultado
- **THEN** ela aparece em `byRoom` com `total` igual a zero

### Requirement: Tempo médio de sessão calculado apenas sobre sessões encerradas

O indicador de tempo médio MUST considerar apenas sessões com `ended_at` preenchido, e MUST descartar durações não-positivas ou superiores a 24 horas.

**Motivação:** uma sessão em andamento ainda não tem duração final — incluí-la mediria o relógio, não o atendimento. E embora o job `auto-close-sessions` encerre sessões expiradas a cada minuto, uma indisponibilidade do serviço faz com que ele as feche depois com `endedAt = now`, gravando durações infladas que permanecem no banco e distorceriam a média para sempre.

#### Scenario: Sessão em andamento durante a consulta

- **WHEN** existe uma sessão sem `ended_at` no período consultado
- **THEN** ela conta no total de liberações, mas não entra no cálculo do tempo médio

#### Scenario: Registro com duração implausível

- **WHEN** uma sessão encerrada tem duração superior a 24 horas
- **THEN** ela é desprezada no cálculo do tempo médio

## MODIFIED Requirements

### Requirement: Listagem de sessões de liberação

A listagem `GET /lawyers/get-all-releases/:roomId?` MUST incluir, além de `id` e `name`, a inscrição `oab` do advogado em cada sessão retornada.

**Motivação:** o ranking de advogados do painel identifica cada pessoa pelo número de inscrição — homônimos são comuns, e o nome sozinho não distingue.

#### Scenario: Sessão retornada com a inscrição

- **WHEN** um funcionário autenticado lista as liberações
- **THEN** cada item traz `lawyer.oab` junto de `lawyer.id` e `lawyer.name`
