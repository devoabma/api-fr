## Contexto

Duas bases de código, dois repositórios, duas linguagens, um contrato — e nada verificando que as duas pontas concordam sobre ele. O `api-fr` declara o response com Zod; o `app-fr` declara o mesmo response com um `record` C#. Os dois são escritos à mão, e divergiram sem que ninguém percebesse, porque cada lado testa contra a sua própria versão da verdade.

O que torna o caso instrutivo é que **os dois lados estavam individualmente corretos**. O schema Zod da API era um schema válido, com os campos que a rota de fato enviava. Os testes do cliente eram testes legítimos, verificando desserialização, tratamento de erro e formato do corpo enviado. Nenhuma revisão de qualquer um dos arquivos isoladamente encontraria o problema — ele só existe no espaço entre eles.

## Decisões

### 1. A API se ajusta ao cliente, não o contrário

Havia duas correções possíveis: fazer a API devolver os campos que o cliente espera, ou fazer o cliente parar de esperar campos que a API não devolve.

A segunda seria mais simples e estava errada. O cliente precisa de `remainingTime` para desenhar o cronômetro, e precisa distinguir "liberado com 175 minutos" de "sua sessão anterior estourou e foi encerrada" — duas respostas `200` com `sessionId` que significam coisas opostas. Sem o campo, essa distinção teria que ser feita **comparando o texto de `message`**, exatamente o antipadrão que a change `refine-release-computer-error-messages` proibiu explicitamente.

Ou seja: o cliente estava certo sobre o que precisava. Faltava o servidor cumprir.

### 2. `expiresAt` é instante absoluto, não duração

`remainingTime` sozinho já destravaria a liberação. `expiresAt` foi adicionado junto porque a alternativa envelhece mal.

Um cliente que recebe "175 minutos" precisa somar isso no relógio dele para saber quando a sessão acaba. Esse relógio é uma máquina Windows numa sala de fórum: pode estar com a hora errada, pode ser suspensa e retomada, pode ter o horário alterado pelo próprio usuário. Nenhuma dessas coisas afeta o job do servidor, que compara `startedAt` com o horário **dele**. As duas contagens divergem e a do servidor vence sem aviso — o quiosque simplesmente para de valer.

Com um instante absoluto em UTC, o cliente tem um alvo que não depende de quando ele recebeu a mensagem nem de quanto tempo levou para processá-la. O erro de relógio continua existindo, mas passa a ser **mensurável e corrigível** (comparando o horário do servidor com o local), em vez de acumulável.

O formato é ISO 8601 com sufixo `Z`, produzido por `.toISOString()`. O servidor opera em `America/Fortaleza` via dayjs, mas nada disso vai para o fio: horário local num contrato entre máquinas é ambiguidade gratuita. Do lado .NET, `DateTimeOffset` desserializa isso sem configuração adicional e sem depender do fuso da máquina.

### 3. `expiresAt` é `null` quando não há sessão nova, não `startedAt`

A rota responde `200` em dois casos, e o segundo é contraintuitivo: quando o advogado(a) já tinha uma sessão ativa que estourou o tempo, a rota **encerra essa sessão** e responde `200` com o `sessionId` dela. Não é uma liberação — é um encerramento comunicado com status de sucesso.

Poderia-se preencher `expiresAt` com o instante em que essa sessão foi encerrada. Seria factualmente verdadeiro e praticamente uma armadilha: um cliente que lesse `expiresAt` sem olhar `remainingTime` calcularia uma duração negativa e cairia em qualquer ramo que o autor não previu.

`null` força a leitura correta. Não existe sessão a expirar, então não existe instante de expiração. A distinção entre os dois `200` continua sendo `remainingTime`, e `expiresAt` apenas não contradiz.

### 4. A mudança é aditiva, e isso é o que a torna segura

Nenhum campo foi removido ou renomeado. O front web, que consome a mesma rota, não lê os campos novos e não é afetado — continua recebendo `message` e `sessionId` nos mesmos lugares.

Isso importa porque o `serializerCompiler` do `fastify-type-provider-zod` descarta em silêncio o que não está no schema: adicionar um campo ao schema é seguro, mas **remover ou renomear** um quebraria clientes sem produzir erro nenhum no servidor. A mesma propriedade que causou este bug protege esta correção.

### 5. O parâmetro `expiraEm` de `Autorizar` é opcional

Do lado C#, `ResultadoDeLiberacao.Autorizar` ganhou um quinto parâmetro com valor padrão `null`. Um parâmetro obrigatório teria sido mais honesto — obrigaria cada chamador a decidir o que fazer com o campo — ao custo de quebrar toda chamada existente por um campo que, nesta entrega, ninguém ainda consome.

A escolha foi pelo opcional porque o custo do erro é baixo e reversível: o pior caso é um chamador futuro esquecer de passar o valor e receber `null`, que é justamente o caso já previsto no contrato ("nulo quando o servidor não informou"). Quando o `SessaoViewModel` passar a depender do campo, vale reconsiderar.

## Alternativas consideradas

**Persistir `expiresAt` como coluna em `ComputerSessions`.** Tornaria o valor consultável e dispensaria recalcular a conta em cada lugar que precisa dela. Foi descartado porque criaria uma segunda fonte da verdade sobre quando a sessão acaba: hoje o job deriva o limite de `startedAt` + saldo, e uma coluna que pudesse divergir disso é um bug esperando alguém alterar a cota sem atualizar as duas. Enquanto a conta for uma linha, derivar é mais seguro que armazenar.

**Gerar os DTOs do cliente a partir do OpenAPI.** A API já publica o schema em `/docs` via `@fastify/swagger`; um gerador produziria os `record` C# a partir dele e a divergência que causou este bug seria impossível por construção. É a solução certa para a causa-raiz e está fora do escopo desta entrega — que precisa destravar a liberação, não reformar o pipeline dos dois repositórios. Fica registrado como limitação conhecida.

**Fazer o cliente tolerar a ausência dos campos.** Trocar `conteudo.RemainingTime ?? 0` por um default otimista faria a liberação passar sem tocar na API. Resolveria o sintoma e apagaria o sinal: o cliente deixaria de conseguir distinguir os dois `200`, e a próxima divergência de contrato passaria igualmente despercebida — só que sem nada quebrado para denunciá-la.
