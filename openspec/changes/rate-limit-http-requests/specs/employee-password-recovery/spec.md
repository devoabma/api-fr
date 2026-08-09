## MODIFIED Requirements

### Requirement: Geração de código de recuperação

O sistema SHALL gerar o código de recuperação por meio de `generateRecoveryCode(length = 6)`, produzindo uma sequência alfanumérica (A–Z, 0–9) de tamanho configurável (padrão 6). O código MUST compor tanto o conteúdo do e-mail quanto o link de redefinição (`${WEB_URL}/employees/reset-password?code=...`).

O sorteio de cada caractere MUST usar fonte criptograficamente segura (`crypto.randomInt`) e MUST NOT usar `Math.random()`.

A exigência passou a valer com a entrada do rate limit: enquanto a rota de reset era ilimitada, o que segurava a adivinhação era o espaço de busca (36⁶). Com teto de tentativas, o gargalo do atacante deixa de ser a força bruta e passa a ser a previsibilidade do gerador — e o PRNG não criptográfico do `Math.random()` permite reconstruir o estado interno a partir de saídas observadas, que o atacante obtém à vontade pedindo recuperação para contas próprias. `crypto.randomInt` também elimina o viés de módulo de `Math.floor(Math.random() * n)`.

#### Scenario: Código padrão de 6 caracteres

- **WHEN** `generateRecoveryCode()` é chamada sem argumentos
- **THEN** retorna uma string de 6 caracteres do conjunto `A–Z0–9`

#### Scenario: Código imprevisível

- **WHEN** um atacante coleta códigos de recuperação de contas que ele próprio controla
- **THEN** as saídas observadas não permitem prever o código gerado para outra conta
