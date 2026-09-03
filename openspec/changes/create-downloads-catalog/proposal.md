# Catálogo de downloads do Desktop

## Why

O Dev C# entrega dois links a cada versão do Sala Livre: o do instalador e o do desinstalador. Esses endereços não têm dono em lugar nenhum — circulam por mensagem e acabam colados à mão no front ou passados de boca em boca no suporte.

O efeito prático é o pior tipo de erro: alguém distribui um executável desatualizado e **ninguém percebe**, porque nada na aplicação sabe qual é o link vigente. Não há como responder "para onde o instalador apontava no mês passado", nem trocar um link quebrado sem mexer em código.

## What Changes

- **`prisma/schema.prisma`**: novo enum `DownloadKinds` (`INSTALLER`, `UNINSTALLER`) e novo modelo `Downloads` → tabela `downloads`, sem relação com nenhuma outra.
- **`downloads/create.ts`**: `POST /downloads/create` (ADMIN) — cadastra um arquivo. Recusa um segundo ativo do mesmo tipo.
- **`downloads/get-all.ts`**: `GET /downloads/get-all` (autenticado) — rota única com recorte por papel: ADMIN recebe também os inativos, MEMBER só os ativos.
- **`downloads/update.ts`**: `PATCH /downloads/update/:id` (ADMIN) — edita `name`, `url`, `description` e `version`. `kind` fora do body.
- **`downloads/deactivate.ts` e `activate.ts`**: `PATCH /downloads/deactivate/:id` e `/activate/:id` (ADMIN) — soft delete e volta atrás.
- **`downloads/helpers/ensure-single-active.ts`**: porta única da regra "um ativo por tipo", usada pelo create e pelo activate.
- **`utils/validations/download-url.ts`**: `downloadUrlSchema`, URL com protocolo fechado em `http`/`https`.
- **`routes/index.ts`**: registro das cinco rotas sob o prefixo `/downloads`.

### Mudanças incidentais

- Revertido um comentário `///` de `AppVersions.version` que estava apagado no working tree sem ter sido commitado.

## Capabilities

### Added Capabilities
- `downloads-catalog`: cadastro, edição, listagem e inativação dos arquivos que o funcionário baixa do painel.

## Impact

- **Banco**: uma tabela nova (`downloads`), um enum novo (`DownloadKinds`), um índice `(kind, inactive)`. Migration `20260903120204_catalogo_de_downloads`. Nenhuma tabela existente é tocada.
- **Código**: pasta nova `src/http/core/downloads/` (5 rotas + 1 helper), um util novo de validação, 5 linhas em `routes/index.ts`.
- **Contrato HTTP**: 5 rotas novas sob `/downloads`. Nenhuma rota existente muda.
- **Dependências**: nenhuma.
- **Documentação**: `docs/DATABASE.md` (enum, modelo 10, mapa de relacionamentos) e `docs/ROADMAP.md` (seção 8).
- **Operação**: nenhum passo novo de deploy além do `prisma migrate deploy` que o `pnpm db:deploy` já faz. Sem env var nova.

## Design Decisions

**Catálogo com tipo, e não um registro único com duas colunas de URL.** O pedido nasceu com dois links fixos, e um singleton (`installer_url`, `uninstaller_url`) resolveria hoje. Mas "cadastrar e editar links" é operação de CRUD, e a primeira necessidade nova — um manual em PDF, o driver de uma impressora — viraria migration de coluna mais alteração de rota mais alteração de tela. Com `kind`, é uma linha nova e um valor a mais no enum.

**Um ativo por tipo, garantido na aplicação.** Quem escolhe o link é o front, e ele escolhe pelo `kind`. Com dois instaladores ativos ele pegaria o primeiro da lista e ninguém perceberia que o botão passou a apontar para o arquivo errado. A garantia de verdade seria um `UNIQUE` parcial (`WHERE inactive IS NULL`), que o schema do Prisma não sabe expressar — criado só no SQL da migration, ele sumiria no primeiro `prisma migrate dev` de quem alterasse a tabela, e a regra passaria a valer em produção mas não no banco de quem desenvolve. Divergência silenciosa entre ambientes é pior do que a garantia mais fraca. A regra mora num arquivo só, pelo mesmo motivo de `savePublishedVersion`.

**A API guarda o endereço e devolve o endereço.** Foram consideradas duas alternativas: redirect com contador (`302` para a URL real) e proxy do binário. O proxy consumiria banda e memória do servidor a cada download de ~60 MB para entregar o que a origem já entrega. O redirect é barato, mas só se justifica pela telemetria — que ninguém pediu. Fica registrado como o caminho para o dia em que "quantas vezes baixaram" virar pergunta real.

**URL com protocolo fechado.** `z.url()` sozinho aceita `javascript:alert(1)` e `file:///C:/...` como URLs válidas, e este campo termina dentro de um `href` que o funcionário clica. Fechar em `http`/`https` na entrada é o que impede que um link colado errado vire execução de script no navegador de quem só queria baixar o instalador.

**`kind` não é editável.** Trocar o tipo de um registro é, na prática, cadastrar outro. Permitir a troca obrigaria a repetir a checagem de unicidade num terceiro lugar, para cobrir "mudei de UNINSTALLER para INSTALLER e agora há dois instaladores ativos".

**Sem relação com `app_versions`.** Aquela tabela responde "qual versão **deveria** estar rodando"; esta responde "de **onde** se baixa o arquivo". Amarrar as duas obrigaria a publicar uma versão inteira só para consertar um link quebrado.

## Known Limitations

1. **Não se sabe quem trocou o link.** Apontar o instalador para o binário errado é incidente, e o banco não registra autor. Exige relação com `employees` e fica para uma change própria.
2. **Sem contador de downloads.** Consequência direta de devolver a URL crua.
3. **A unicidade por tipo não resiste a duas requisições simultâneas.** Dois ADMINs cadastrando no mesmo instante poderiam, em tese, criar dois ativos. É uma tela de configuração usada por um punhado de pessoas, e o próprio `get-all` mostraria a duplicidade — mas está aqui como limitação conhecida, não como descuido.
4. **A API não verifica se o link responde.** Um endereço com erro de digitação é aceito e só falha na mão do funcionário. Um `HEAD` na hora do cadastro resolveria a maioria dos casos e é candidato natural a uma próxima iteração.
