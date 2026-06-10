## MODIFIED Requirements

### Requirement: Criação de funcionário com e-mail de boas-vindas não-fatal

O sistema SHALL persistir o funcionário e, em seguida, enviar o e-mail de boas-vindas **fora de uma transação**. A persistência do funcionário MUST ser independente do envio do e-mail: caso o envio falhe, o cadastro NÃO sofre rollback e a falha MUST apenas ser registrada via `request.log.error`, sem impedir a resposta de sucesso. Esta requisito substitui o comportamento anterior, em que o e-mail era enviado dentro de um `$transaction` e a falha causava rollback.

#### Scenario: Cadastro e e-mail bem-sucedidos

- **WHEN** uma requisição válida de criação é recebida e o envio do e-mail de boas-vindas é concluído com sucesso
- **THEN** o funcionário é persistido no banco
- **AND** a API responde `201` com mensagem de sucesso

#### Scenario: Falha no envio do e-mail

- **WHEN** o provedor de e-mail (Resend) retorna erro durante o envio
- **THEN** o funcionário permanece persistido (sem rollback)
- **AND** a falha é registrada via `request.log.error`
- **AND** a API ainda responde `201` com mensagem de sucesso

### Requirement: Validação de unicidade de CPF e e-mail

O sistema SHALL rejeitar a criação quando já existir funcionário com o mesmo CPF ou o mesmo e-mail, antes de iniciar a persistência. A rejeição MUST ser sinalizada via `BadRequestError` (resposta `400`) tratado pelo error handler global.

#### Scenario: CPF já cadastrado

- **WHEN** o CPF informado já pertence a um funcionário existente
- **THEN** a API responde `400` com mensagem de CPF duplicado
- **AND** nenhum novo funcionário é criado e nenhum e-mail é enviado

#### Scenario: E-mail já cadastrado

- **WHEN** o e-mail informado já pertence a um funcionário existente
- **THEN** a API responde `400` com mensagem de e-mail duplicado
- **AND** nenhum novo funcionário é criado e nenhum e-mail é enviado
