## MODIFIED Requirements

### Requirement: Criação de funcionário com e-mail de boas-vindas não-fatal

O sistema SHALL persistir o funcionário e, em seguida, enviar o e-mail de boas-vindas **fora de uma transação**. A persistência do funcionário MUST ser independente do envio do e-mail: caso o envio falhe, o cadastro NÃO sofre rollback e a falha MUST apenas ser registrada no log, sem impedir a resposta de sucesso.

A persistência MUST usar `select` explícito para trazer apenas o `id` do registro criado, de modo que o `passwordHash` não retorne do Prisma para o handler.

A resposta `201` SHALL conter, além da mensagem de sucesso, o campo `employeeId` com o `id` do funcionário recém-criado, validado como `cuid2` — o mesmo formato que `POST /employees/link-with-rooms` exige no body. Isso permite ao cliente encadear o vínculo com salas imediatamente após o cadastro, sem precisar varrer a listagem para redescobrir o registro por CPF ou e-mail.

#### Scenario: Cadastro e e-mail bem-sucedidos

- **WHEN** uma requisição válida de criação é recebida e o envio do e-mail de boas-vindas é concluído com sucesso
- **THEN** o funcionário é persistido no banco
- **AND** a API responde `201` com mensagem de sucesso e o `employeeId` do registro criado

#### Scenario: Falha no envio do e-mail

- **WHEN** o provedor de e-mail (Resend) retorna erro durante o envio
- **THEN** o funcionário permanece persistido (sem rollback)
- **AND** a falha é registrada no log
- **AND** a API ainda responde `201` com mensagem de sucesso e o `employeeId`

#### Scenario: Encadeamento com a vinculação de salas

- **GIVEN** um ADMIN que acabou de cadastrar um funcionário e recebeu `employeeId` no `201`
- **WHEN** ele envia esse mesmo `employeeId` em `POST /employees/link-with-rooms`
- **THEN** o vínculo é aceito sem nenhuma consulta intermediária à listagem de funcionários

#### Scenario: Falha de unicidade não devolve id

- **WHEN** o CPF ou o e-mail informado já pertence a um funcionário existente
- **THEN** a API responde `400` com a mensagem de duplicidade
- **AND** nenhum `employeeId` é devolvido, pois nenhum registro foi criado
