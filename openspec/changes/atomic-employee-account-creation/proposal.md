## Why

O endpoint de criação de funcionário gravava o registro no banco e só depois tentava enviar o e-mail de boas-vindas. Quando o envio falhava, o funcionário já ficava persistido sem nunca ter recebido suas credenciais de acesso, gerando contas órfãs e inconsistência operacional.

## What Changes

- O cadastro do funcionário e o envio do e-mail de boas-vindas (Resend) passam a ocorrer dentro de uma única transação Prisma (`prisma.$transaction`).
- Se o envio do e-mail falhar (erro retornado pelo Resend ou exceção), a criação do funcionário sofre **rollback** e nada é persistido.
- Nesse caso, a API responde `400` com mensagem explicando que o funcionário não foi cadastrado e que a operação deve ser repetida.
- A resposta `201` só é retornada quando o funcionário foi gravado **e** o e-mail foi enviado com sucesso.

## Capabilities

### New Capabilities
- `employee-account-creation`: Criação de conta de funcionário com garantia de atomicidade entre persistência e notificação por e-mail de boas-vindas.

### Modified Capabilities
<!-- Nenhuma capability existente é alterada (specs/ está vazio). -->

## Impact

- Código: `src/http/core/employees/create-account.ts`.
- Dependências: Prisma (transação), Resend (envio de e-mail).
- API: rota `POST /create-account` — novo cenário de resposta `400` para falha no envio do e-mail.
