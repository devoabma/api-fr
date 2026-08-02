## ADDED Requirements

### Requirement: Expurgo semanal das impressões

O sistema SHALL apagar automaticamente as impressões enviadas pelos advogados **toda sexta-feira às 23:59:59**, no fuso horário configurado da instância (`TIMEZONE`). O agendamento MUST usar o horário de parede da seccional, independente do fuso do servidor onde a API roda.

A limpeza MUST remover o arquivo do bucket `prints` no Supabase Storage **e** o registro correspondente na tabela `printers`. A remoção no Storage MUST ocorrer antes da exclusão no banco: se o Storage falhar, o registro MUST ser preservado para nova tentativa no disparo seguinte, evitando arquivo órfão sem rastreio.

O conjunto a apagar MUST ser delimitado por um instante de corte capturado no início da execução: impressões criadas durante a limpeza MUST sobreviver até o disparo da semana seguinte.

Quando a `file_url` de um registro não corresponder ao padrão de URL pública do bucket `prints`, o sistema MUST apagar apenas o registro e MUST registrar aviso no log — sem caminho válido não há objeto a remover, e manter o registro o faria ser reprocessado indefinidamente.

Execuções sobrepostas MUST ser descartadas: se uma limpeza ainda estiver em andamento no disparo seguinte, o novo disparo MUST ser ignorado em vez de executado em paralelo.

O expurgo MUST ser executado pelo próprio processo da API, sem endpoint HTTP associado.

#### Scenario: Limpeza semanal na sexta-feira

- **WHEN** o relógio da seccional atinge sexta-feira às 23:59:59 e existem impressões registradas
- **THEN** os arquivos são removidos do bucket `prints` e os registros correspondentes são apagados da tabela `printers`

#### Scenario: Nenhuma impressão a limpar

- **WHEN** o disparo ocorre e não há registros em `printers`
- **THEN** a execução termina sem erro e registra no log que não havia impressões para limpar

#### Scenario: Falha na remoção do arquivo no Storage

- **WHEN** a remoção de um lote no Supabase Storage retorna erro
- **THEN** os registros daquele lote permanecem na tabela `printers` e o erro é registrado no log, para nova tentativa na semana seguinte

#### Scenario: Impressão enviada durante a limpeza

- **WHEN** um advogado(a) envia um documento enquanto a limpeza está em execução
- **THEN** essa impressão não é apagada, permanecendo disponível até o disparo da semana seguinte

#### Scenario: Registro com URL fora do padrão do bucket

- **WHEN** um registro possui `file_url` que não contém o caminho público do bucket `prints`
- **THEN** apenas o registro é apagado e um aviso é registrado no log
