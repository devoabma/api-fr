## ADDED Requirements

### Requirement: Confiança em proxy definida por ambiente

O sistema SHALL obter da variável de ambiente `TRUST_PROXY` a política de confiança no header `x-forwarded-for`, usada para descobrir o IP real do cliente. O valor MUST NOT estar fixo no código — ele depende da topologia de rede de cada ambiente, que difere entre desenvolvimento e produção.

O schema do `env` MUST aceitar quatro formas, convertendo cada uma para o tipo esperado pelo Fastify:

- `"false"` — não confia em proxy; usa o IP da conexão TCP. Valor padrão.
- `"true"` — confia em qualquer proxy. MUST ser tratado como inseguro quando a porta da API for alcançável fora do túnel, pois o header passa a ser forjável pelo cliente.
- número inteiro positivo (`"1"`, `"2"`) — quantidade de proxies à frente da API.
- lista de faixas confiáveis (ex.: `"loopback,uniquelocal"`, `"10.0.0.0/8"`) — lê a cadeia da direita para a esquerda descartando as faixas indicadas.

Quando `TRUST_PROXY` não for informada, o sistema MUST assumir `false`, por ser o valor correto em desenvolvimento e o mais restritivo.

Um valor inadequado para a topologia MUST NOT impedir o boot — não há como a aplicação validar a rede à sua frente. Por isso a documentação de deploy MUST registrar o valor esperado em produção, o sintoma observável de configuração errada e como validá-lo com tráfego real, já que a falha é silenciosa: a API sobe normalmente e passa a contar todos os clientes como um único IP.

#### Scenario: Desenvolvimento sem proxy

- **WHEN** a API sobe sem `TRUST_PROXY` definida, com acesso direto
- **THEN** o IP considerado é o da conexão TCP e a aplicação inicia normalmente

#### Scenario: Produção atrás de proxy reverso

- **WHEN** a API sobe com `TRUST_PROXY` descrevendo as faixas privadas confiáveis da topologia
- **THEN** o IP considerado é o primeiro IP público da cadeia `x-forwarded-for`, lida da direita para a esquerda
- **AND** um `x-forwarded-for` forjado pelo cliente não altera o IP considerado

#### Scenario: Configuração incorreta em produção

- **WHEN** a API sobe atrás de proxy com `TRUST_PROXY` em `false`
- **THEN** a aplicação inicia sem erro
- **AND** todos os clientes passam a compartilhar o mesmo balde de rate limit, sintoma documentado no runbook de deploy
