## ADDED Requirements

### Requirement: Criação atômica de funcionário com e-mail de boas-vindas

O sistema SHALL persistir o funcionário e enviar o e-mail de boas-vindas dentro de uma única transação. O funcionário MUST ser persistido somente quando o e-mail de boas-vindas for enviado com sucesso. Caso o envio do e-mail falhe, a persistência do funcionário MUST sofrer rollback, garantindo que nenhuma conta de funcionário exista sem o respectivo e-mail enviado.

#### Scenario: Cadastro e e-mail bem-sucedidos

- **WHEN** uma requisição válida de criação é recebida e o envio do e-mail de boas-vindas é concluído com sucesso
- **THEN** o funcionário é persistido no banco
- **AND** a API responde `201` com mensagem de sucesso

#### Scenario: Falha no envio do e-mail

- **WHEN** o provedor de e-mail (Resend) retorna erro ou lança exceção durante o envio
- **THEN** a transação sofre rollback e nenhum funcionário é persistido
- **AND** a API responde `400` informando que o funcionário não foi cadastrado e que a operação deve ser repetida

### Requirement: Validação de unicidade de CPF e e-mail

O sistema SHALL rejeitar a criação quando já existir funcionário com o mesmo CPF ou o mesmo e-mail, antes de iniciar a persistência.

#### Scenario: CPF já cadastrado

- **WHEN** o CPF informado já pertence a um funcionário existente
- **THEN** a API responde `400` com mensagem de CPF duplicado
- **AND** nenhum novo funcionário é criado e nenhum e-mail é enviado

#### Scenario: E-mail já cadastrado

- **WHEN** o e-mail informado já pertence a um funcionário existente
- **THEN** a API responde `400` com mensagem de e-mail duplicado
- **AND** nenhum novo funcionário é criado e nenhum e-mail é enviado
