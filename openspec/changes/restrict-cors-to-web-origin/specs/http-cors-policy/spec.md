## ADDED Requirements

### Requirement: Origem única e explícita para o front web

O sistema SHALL responder às requisições de navegador com `Access-Control-Allow-Origin` contendo a origem definida em `WEB_URL`. O valor `*` MUST NOT ser usado, porque a especificação de CORS proíbe o coringa em resposta a requisição com credenciais e o navegador descarta a resposta.

A origem MUST vir do ambiente e MUST NOT estar fixa no código: o host do front difere entre desenvolvimento e produção e não é derivável de nada disponível na aplicação.

#### Scenario: Preflight vindo do front configurado

- **WHEN** o navegador envia um `OPTIONS` de preflight com `Origin` igual a `WEB_URL`
- **THEN** a API responde `204` com `access-control-allow-origin` igual à mesma origem
- **AND** a requisição real prossegue normalmente

#### Scenario: Preflight vindo de origem não autorizada

- **WHEN** o navegador envia um preflight com `Origin` diferente de `WEB_URL`
- **THEN** a API responde com `access-control-allow-origin` apontando para a origem legítima
- **AND** o navegador identifica a divergência e MUST bloquear a requisição real, que nunca alcança a API

### Requirement: Credenciais habilitadas para autenticação por cookie

O sistema SHALL responder com `Access-Control-Allow-Credentials: true`, condição sem a qual o navegador não grava o cookie `httpOnly` de sessão emitido pelo login nem o reenvia nas requisições seguintes.

O cliente web MUST enviar suas requisições com credenciais (`credentials: 'include'` no fetch, `withCredentials: true` no axios). Sem isso o cookie não acompanha a requisição e a API responde `401`, ainda que o login tenha sido bem-sucedido.

#### Scenario: Front web autenticado entre origens

- **WHEN** o front faz login e, em seguida, chama uma rota autenticada enviando credenciais
- **THEN** o cookie de sessão acompanha a requisição
- **AND** a API identifica o funcionário sem exigir o token no corpo ou em header

### Requirement: Clientes fora do navegador não são afetados

O sistema MUST atender normalmente requisições que não trazem o header `Origin` — app desktop, `curl`, Insomnia e healthcheck do contêiner. CORS é uma regra aplicada pelo navegador ao consumir a resposta, não um controle de acesso do servidor, e a política MUST NOT ser tratada como barreira de segurança contra clientes automatizados.

A proteção efetiva da API contra acesso indevido MUST continuar sendo a autenticação, a autorização por papel e o rate limit.

#### Scenario: Requisição sem header Origin

- **WHEN** um cliente que não é navegador chama qualquer rota da API
- **THEN** a requisição é atendida segundo suas próprias regras de autenticação e limite
- **AND** a política de CORS não interfere na resposta

#### Scenario: Canal WebSocket

- **WHEN** um Desktop abre a conexão em `/ws/computers`
- **THEN** a política de CORS não se aplica ao handshake
- **AND** a autenticação da estação permanece a cargo da credencial de estação prevista no roadmap
