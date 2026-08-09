## ADDED Requirements

### Requirement: Mensagens de recusa da liberação de computador

As mensagens de erro de `POST /lawyers/release-computer` são lidas pelo advogado(a) na tela de um computador em sala compartilhada, e não por operador do sistema. Toda recusa da rota SHALL responder com `{ message }` redigida para esse leitor.

A recusa por inadimplência MUST NOT declarar a pendência financeira no texto. A mensagem MUST informar que a liberação não prosseguiu e MUST encaminhar ao Setor Financeiro da Seccional do advogado(a); o motivo é tratado em canal privado, não anunciado na tela.

Toda mensagem de recusa MUST terminar com o próximo passo do advogado(a): repetir mais tarde, conferir os dados informados, ou procurar quem resolve.

Recusas ligadas ao **registro** do advogado(a) — situação não liberada, pendência financeira, divergência de CPF/OAB/nascimento — MUST encaminhar à **Seccional** do advogado(a), nunca à "OAB" genérica: a sala atende advogados(as) de Seccionais distintas e a orientação precisa valer para qualquer um deles. Recusas ligadas ao **equipamento** — computador inexistente ou em manutenção — MUST encaminhar à **administração** local, que é quem tem acesso físico à máquina. Os dois destinatários MUST permanecer distintos.

A mensagem de situação não liberada MUST NOT afirmar um status específico do registro ("inativo"), já que o complemento de `SITUACOES_LIBERADAS` abrange também cancelado, suspenso e licenciado.

Os status codes e as condições que os disparam MUST permanecer inalterados: esta exigência governa apenas o conteúdo de `message`. Os clientes MUST tratar as recusas pelo status code (`400`/`404`/`429`), nunca comparando o texto de `message`.

#### Scenario: Recusa por inadimplência com o bloqueio vigente

- **WHEN** o advogado(a) não está adimplente e a instância NÃO está configurada para liberação geral
- **THEN** a API responde `400` informando que a liberação não prosseguiu e encaminhando ao Setor Financeiro da Seccional, **sem** citar inadimplência ou situação financeira

#### Scenario: Recusa por situação do registro

- **WHEN** a `situacao` consultada não está entre as situações liberadas
- **THEN** a API responde `400` informando que o advogado(a) não está ativo e encaminhando à sua Seccional

#### Scenario: Recusa por dados divergentes

- **WHEN** CPF, OAB ou data de nascimento informados divergem dos dados retornados pela API do Protheus
- **THEN** a API responde `400` encaminhando à Seccional e instruindo o advogado(a) a verificar os dados antes de nova tentativa

#### Scenario: Falha de infraestrutura na consulta

- **WHEN** a consulta à API do Protheus falha ou o payload não corresponde ao schema esperado
- **THEN** a API responde `404` orientando a tentar novamente mais tarde, e não a repetir a tentativa de imediato

#### Scenario: Recusa por problema no equipamento

- **WHEN** o `macCode` não corresponde a nenhum computador cadastrado, ou o computador está em manutenção
- **THEN** a API responde `404` orientando nova tentativa mais tarde, ou `400` encaminhando à administração local — nunca à Seccional
