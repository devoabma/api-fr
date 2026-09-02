## ADDED Requirements

### Requirement: Mensagem `update_now` do servidor para a estação

O canal SHALL suportar a mensagem servidor→estação `update_now`, que pede à estação que consulte o manifesto **agora**, em vez de esperar o intervalo dela.

A mensagem MUST carregar `macCode` no formato normalizado, e a estação MUST descartar o que não for dela — mesma disciplina do `session_closed`. Pedido sem `macCode` MUST NOT ser interpretado como "para todas as estações"; ele MUST ser descartado.

A mensagem MAY carregar `version`, e esse campo MUST ser apenas informativo: a estação **não** instala nada por causa dele, e o pedido continua válido quando ele está ausente.

A mensagem MUST NOT carregar URL de download, hash ou tamanho de arquivo, e MUST NOT ser capaz de apontar um executável para a estação baixar. O que a estação instala vem exclusivamente do manifesto assinado que ela mesma busca e confere com a chave embutida no próprio executável — é isso que impede que um servidor comprometido vire um programa arbitrário instalado em todas as salas.

"Atualizar agora" SHALL significar **antecipar**, e MUST NOT significar atropelar: numa máquina ocupada o pacote fica pronto e espera a sessão terminar. Nenhuma versão interrompe sessão aberta, nem quando a atualização é obrigatória.

O envio SHALL devolver a quem chamou se a mensagem foi entregue. Diferente dos avisos de sessão, aqui o retorno **importa**: nada foi gravado no banco antes do envio, então "não entregue" é a informação que o painel precisa mostrar ao funcionário.

O canal MUST NOT ter um evento de confirmação de atualização. A prova de que deu certo é o `register` seguinte chegando com a versão nova — quem aplica a atualização reinicia.

#### Scenario: Estação conectada recebe o pedido

- **WHEN** a API envia `update_now` para uma estação com o canal aberto
- **THEN** a estação recebe a mensagem e o envio é reportado como entregue

#### Scenario: Estação fora do canal

- **WHEN** a API tenta enviar `update_now` para um `macCode` sem conexão aberta
- **THEN** o envio é reportado como não entregue
- **AND** nada é enfileirado para envio posterior

#### Scenario: Mensagem endereçada a outra estação

- **WHEN** uma estação recebe `update_now` com `macCode` diferente do seu
- **THEN** ela descarta a mensagem
