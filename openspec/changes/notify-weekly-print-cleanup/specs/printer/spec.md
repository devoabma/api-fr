## ADDED Requirements

### Requirement: Relatório por e-mail da limpeza semanal

Toda execução agendada do expurgo semanal SHALL enviar um relatório por e-mail ao administrador da instância, **inclusive quando não havia impressões a remover** — a chegada regular da mensagem é o que torna a ausência dela um sinal de problema.

O relatório MUST informar o total encontrado na fila, quantas impressões foram removidas, quantas não foram e o instante da execução no fuso da instância (`TIMEZONE`), além de distinguir visualmente o desfecho: conclusão integral, conclusão parcial ou falha da execução.

Quando um ou mais lotes não puderem ser removidos, o relatório MUST identificar os lotes afetados e a mensagem de erro correspondente, limitando a quantidade de mensagens exibidas para não transformar o e-mail em despejo de log.

O envio MUST ser não-fatal: falha ao enviar o relatório MUST ser registrada no log e MUST NOT interromper nem reverter a limpeza, que já ocorreu e é irreversível.

O destinatário MUST ser o administrador configurado da instância (`EMAIL_ADMIN`) em produção, e um endereço de desenvolvimento fora dela — para que a execução do job em ambiente local não dispare alerta operacional real.

#### Scenario: Limpeza concluída integralmente

- **WHEN** a execução agendada remove todas as impressões da fila
- **THEN** o administrador recebe um relatório de conclusão com o total encontrado, o total removido e o instante da execução

#### Scenario: Nenhuma impressão a limpar

- **WHEN** a execução agendada ocorre e a fila está vazia
- **THEN** o administrador recebe mesmo assim o relatório de conclusão, com as contagens zeradas

#### Scenario: Lote não removido do Storage

- **WHEN** a remoção de um ou mais lotes no Storage falha e os registros correspondentes são preservados
- **THEN** o relatório é enviado como conclusão parcial, informando quantas impressões ficaram para trás e o erro de cada lote afetado

#### Scenario: Execução interrompida por erro

- **WHEN** a execução agendada é interrompida por um erro antes de terminar
- **THEN** o administrador recebe um relatório de falha contendo a mensagem do erro

#### Scenario: Falha no envio do relatório

- **WHEN** o provedor de e-mail recusa o envio do relatório
- **THEN** o erro é registrado no log e a execução do job termina normalmente, sem reverter a limpeza já realizada

### Requirement: Alerta de limpeza semanal não executada

A API SHALL verificar, no boot, se a última janela agendada do expurgo (a sexta-feira 23:59:59 mais recente já vencida no fuso da instância) foi cumprida, e MUST alertar o administrador por e-mail quando não tiver sido.

A verificação MUST usar a própria fila como evidência: impressões com data de criação anterior à última janela vencida MUST ser tratadas como prova de que aquela limpeza não aconteceu ou não terminou. O alerta MUST informar o volume pendente e a janela perdida, e MUST NOT afirmar uma causa específica — a fila não distingue API fora do ar de falha de Storage.

O cálculo da janela MUST considerar que dias anteriores à sexta na semana corrente (domingo a quinta) têm como referência a sexta da semana anterior, e não a sexta ainda por vir.

A verificação MUST NOT bloquear a inicialização do servidor, e falha nela MUST ser registrada no log sem impedir o agendamento do job.

#### Scenario: API estava fora do ar no horário agendado

- **WHEN** a API sobe e encontra impressões anteriores à última sexta-feira 23:59:59 já vencida
- **THEN** o administrador recebe um alerta informando o volume pendente e a janela agendada que ficou sem limpeza

#### Scenario: Fila em dia

- **WHEN** a API sobe e não há impressões anteriores à última janela vencida
- **THEN** nenhum e-mail é enviado e o boot segue normalmente

#### Scenario: Boot no início da semana

- **WHEN** a API sobe num domingo, segunda ou qualquer dia anterior à sexta da semana corrente
- **THEN** a janela considerada é a sexta-feira da semana anterior, e impressões criadas depois dela não disparam alerta

#### Scenario: Falha ao verificar a fila no boot

- **WHEN** a consulta de verificação falha (banco indisponível, por exemplo)
- **THEN** o erro é registrado no log, o servidor termina de subir e o job semanal permanece agendado
