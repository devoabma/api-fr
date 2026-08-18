## ADDED Requirements

### Requirement: Encerramento de sessão do funcionário

O sistema SHALL expor `POST /employees/session/logout`, que remove do navegador o cookie de sessão gravado pelo login.

A rota MUST responder `200` com `{ message }` e MUST emitir um `Set-Cookie` para `TOKEN_COOKIE_NAME` com valor vazio e vencimento no passado — a única forma de o servidor descartar um cookie `httpOnly`, invisível ao JavaScript do front.

Os atributos `path`, `domain`, `httpOnly`, `secure` e `sameSite` MUST ser idênticos aos usados na gravação do cookie. O navegador identifica o cookie por nome, domínio e caminho; divergência em qualquer um cria um segundo cookie já vencido e deixa o original ativo, com a API respondendo sucesso.

#### Scenario: Funcionário sai da conta

- **WHEN** o front chama `POST /employees/session/logout`
- **THEN** a API responde `200` com mensagem de sessão encerrada
- **AND** o `Set-Cookie` da resposta zera o cookie de sessão com `Max-Age=0` e `Expires` no passado
- **AND** a próxima requisição do navegador chega sem cookie de sessão

#### Scenario: Requisição sem corpo enviada por cliente HTTP comum

- **WHEN** a chamada chega com `Content-Type: application/json` e corpo vazio, como axios e fetch enviam por padrão
- **THEN** a API responde `200` normalmente

### Requirement: Logout acessível sem sessão válida

A rota de logout MUST NOT exigir autenticação. O caso mais comum de sair é justamente a sessão já ter expirado, e responder `401` deixaria no navegador o cookie inválido que se queria remover.

A operação MUST ser idempotente e MUST NOT expor informação: a resposta é a mesma com ou sem sessão ativa.

#### Scenario: Logout com sessão já expirada

- **WHEN** alguém chama a rota com cookie vencido ou sem cookie nenhum
- **THEN** a API responde `200` e emite a limpeza do cookie do mesmo jeito

### Requirement: Token permanece válido até expirar

O logout SHALL encerrar a sessão do navegador, mas MUST NOT invalidar o JWT em si — a autenticação é stateless e não há lista de revogação.

Um token copiado antes do logout MUST continuar aceito até seu `expiresIn`. Essa limitação MUST estar documentada, e a decisão de fechá-la MUST vir acompanhada de armazenamento de revogação consultado a cada requisição autenticada.

#### Scenario: Token capturado antes da saída

- **WHEN** um token válido é apresentado depois de a rota de logout ter sido chamada
- **THEN** a API o aceita normalmente até o vencimento do token
