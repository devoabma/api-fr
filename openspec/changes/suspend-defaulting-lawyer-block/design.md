# Design

## 1. Variável de ambiente em vez de tabela de configuração

A escolha real era entre `env` e uma tabela de configuração no banco com rota ADMIN para alternar.

A tabela ganharia em autonomia (a diretoria liga sozinha, sem o desenvolvedor) e em auditoria (quem ligou, quando). Custaria migração, rota, regra de autorização, cache e — o ponto decisivo — **uma consulta a mais em `release-computer`**, que é a rota pública mais chamada do sistema e já paga uma chamada HTTP ao Protheus antes de tocar no banco.

O evento que a flag atende é raro e vem por determinação formal da diretoria, não por operação do dia a dia. O deploy roda em container único: alterar a variável e reiniciar leva segundos. O custo permanente da tabela não se paga com essa frequência.

A decisão fica isolada em **uma condição**, num arquivo. Se a alternância virar rotina, trocar a origem do valor não espalha alteração pelo código.

## 2. Padrão seguro e parse intolerante a erro

O schema é `z.string().default('false').transform(v => v.trim().toLowerCase() === 'true')`.

Duas propriedades importam aqui, e ambas são deliberadas:

**A ausência da variável equivale a `false`.** Container novo, `.env` esquecido, deploy antigo redeployado: todos bloqueiam inadimplente. A regra de negócio normal nunca depende de alguém lembrar de configurar algo.

**Só a string `true` liga.** Qualquer outro valor — `"1"`, `"sim"`, `"yes"`, `"on"` — resulta em `false`. É o oposto da tolerância que normalmente se busca em parse de configuração, e é intencional: os dois erros possíveis não são simétricos. Ler `"1"` como `false` produz o comportamento normal do sistema e alguém reclama que a determinação não surtiu efeito — erro visível, corrigido em minutos. Ler um valor ambíguo como `true` libera inadimplentes sem que ninguém tenha pedido, e isso pode passar meses despercebido.

Não foi usado `z.stringbool()`: ele aceita `"1"`, `"yes"`, `"on"` como verdadeiro, exatamente o que se quer evitar aqui. Para `TRUST_PROXY` a tolerância faz sentido; para uma flag que suspende regra de negócio, não.

## 3. Aviso no boot

Toda flag de exceção temporária tem o mesmo modo de falha: a exceção acaba, a flag continua. Meses depois a OAB deixa de cobrar anuidade de quem passa pela sala e ninguém sabe por quê — porque não há nada no sistema informando que a exceção está vigente.

Por isso o `server.ts` emite um aviso destacado a cada boot quando a flag está ligada. Custa cinco linhas e cria o único ponto do sistema em que a exceção se anuncia. Não substitui um lembrete de calendário com a data em que a determinação vence, mas garante que qualquer restart traga o assunto de volta.

O aviso fica no `.then()` do `listen`, junto do banner de boot, e não no `env.ts`: validação de ambiente e comunicação operacional são coisas diferentes, e o `env` é importado por scripts (seed, CLI do Prisma) que não deveriam imprimir o aviso.

## 4. A exceção suspende adimplência e nada mais

A condição foi escrita como `!env.ALLOW_DEFAULTING_LAWYERS && !consultedLawyer.adimplente`, mantida **abaixo** da checagem de `SITUACOES_LIBERADAS`.

Seria tentador tratar as duas validações como "as checagens do Protheus" e envolver ambas na flag. Seria errado. Advogado(a) com registro cancelado, ou fora das situações liberadas, não é uma questão financeira — é ausência de habilitação. Nenhuma determinação de liberação geral pede para atender quem não está habilitado, e confundir as duas regras na pressa de um deploy político é justamente o tipo de erro que essa entrega existe para evitar.

Manter a ordem original também preserva a mensagem de erro correta: quem está inativo **e** inadimplente continua recebendo "Advogado(a) inativo, entre em contato com a OAB", que é a orientação útil, mesmo com a flag ligada.
