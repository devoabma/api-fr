## ADDED Requirements

### Requirement: Fuso horário definido por ambiente

O sistema SHALL obter o fuso horário da instância da variável de ambiente `TIMEZONE`, aceitando qualquer identificador IANA (ex.: `America/Fortaleza`, `America/Sao_Paulo`). O fuso MUST NOT estar fixo no código — cada seccional da OAB roda a própria instância e define o seu fuso por configuração.

Quando `TIMEZONE` não for informada, o sistema MUST assumir `America/Fortaleza`, de modo que ambientes já existentes continuem funcionando sem alteração.

Quando `TIMEZONE` contiver um valor que não seja um identificador IANA válido, a aplicação MUST falhar no boot, junto das demais validações do `env`, com mensagem indicando fuso horário inválido. A aplicação MUST NOT iniciar com fuso inválido, pois o efeito seria silencioso: cálculo de tempo de sessão e jobs agendados disparando na hora errada.

O fuso configurado MUST governar todo cálculo de data/hora da aplicação — tempo restante e encerramento de sessões, cota diária, janelas de listagem — e MUST governar o horário de parede dos jobs agendados, independente do fuso do sistema operacional do servidor.

#### Scenario: Fuso informado por ambiente

- **WHEN** a API sobe com `TIMEZONE=America/Fortaleza`
- **THEN** os cálculos de data/hora e o agendamento dos jobs usam o horário local de Fortaleza, mesmo que o servidor esteja em UTC

#### Scenario: Fuso ausente

- **WHEN** a API sobe sem `TIMEZONE` definida
- **THEN** o fuso assumido é `America/Fortaleza` e a aplicação inicia normalmente

#### Scenario: Fuso inválido

- **WHEN** a API sobe com `TIMEZONE` contendo um identificador inexistente
- **THEN** a validação do `env` falha e a aplicação não inicia, informando que o fuso horário é inválido
