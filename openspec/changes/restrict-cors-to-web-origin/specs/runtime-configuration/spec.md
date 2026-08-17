## MODIFIED Requirements

### Requirement: Origem do front web validada e normalizada

O sistema SHALL obter da variável de ambiente `WEB_URL` a origem do front web, usada em dois pontos com exigências distintas:

- **Política de CORS** — o valor é comparado byte a byte com o header `Origin` enviado pelo navegador.
- **Links de e-mail** — cadastro, recuperação e confirmação de troca de senha montam `${WEB_URL}/<caminho>`.

O schema do `env` MUST validar `WEB_URL` como URL absoluta. Um valor sem esquema (ex.: `app.exemplo.com`) MUST derrubar o boot, seguindo o tratamento já dado às demais variáveis inválidas — subir com CORS quebrado é pior do que não subir.

O schema MUST remover as barras finais do valor antes de expô-lo em `env`. O header `Origin` é composto apenas por esquema, host e porta, e nunca traz barra final ou caminho: um `WEB_URL` terminado em `/` nunca casaria com origem alguma. Essa falha MUST ser tratada por normalização, e não por erro de boot, por ser sintaticamente uma URL válida e um engano trivial de digitação.

Quando `WEB_URL` não for informada, o sistema MUST assumir `http://localhost:3000`, a origem do front em desenvolvimento.

O valor errado MUST ser reconhecível pela documentação de deploy, porque o sintoma é silencioso do lado do servidor: o bloqueio acontece no navegador e nada é registrado no log da API.

#### Scenario: Valor informado com barra final

- **WHEN** a API sobe com `WEB_URL="https://app.exemplo.com/"`
- **THEN** `env.WEB_URL` contém `https://app.exemplo.com`
- **AND** o preflight do front responde com `access-control-allow-origin` idêntico à origem enviada pelo navegador
- **AND** os links de e-mail são montados sem barra dupla

#### Scenario: Valor sem esquema

- **WHEN** a API sobe com `WEB_URL="app.exemplo.com"`
- **THEN** a validação do ambiente falha
- **AND** a aplicação não inicia, registrando a variável inválida no console

#### Scenario: Variável ausente em desenvolvimento

- **WHEN** a API sobe sem `WEB_URL` definida
- **THEN** o valor assumido é `http://localhost:3000`
- **AND** o front local é autorizado pela política de CORS sem configuração adicional
