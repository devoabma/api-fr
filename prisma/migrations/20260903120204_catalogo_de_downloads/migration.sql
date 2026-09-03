-- CreateEnum
-- O tipo é o que o front usa para saber qual link vai em cada botão. Enum, e não texto livre, porque
-- um "INSTALADOR" digitado errado não daria erro em lugar nenhum: o botão simplesmente ficaria vazio.
CREATE TYPE "DownloadKinds" AS ENUM ('INSTALLER', 'UNINSTALLER');

-- CreateTable
-- Onde os links do instalador e do desinstalador passam a morar. Antes disso eles circulavam por
-- mensagem e eram colados à mão, sem nada na aplicação sabendo qual era o vigente.
--
-- `inactive` é o soft delete da casa (nulo = ativo). Aqui ele também é histórico: o link antigo
-- continua na tabela e responde "para onde o instalador apontava em agosto" quando alguém reclamar
-- de ter baixado um binário errado.
CREATE TABLE "downloads" (
    "id" TEXT NOT NULL,
    "kind" "DownloadKinds" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "version" VARCHAR(40),
    "inactive" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- As duas colunas que toda leitura filtra: o painel separando ativo de inativo, e a checagem de
-- "já existe um ativo deste tipo?" procurando o concorrente antes de cadastrar ou reativar.
--
-- Índice comum, e não `UNIQUE` parcial (`WHERE inactive IS NULL`), que seria a garantia de verdade
-- para um ativo por tipo: o schema do Prisma não sabe expressar índice parcial, e um índice criado
-- só aqui no SQL sumiria no primeiro `prisma migrate dev` de quem alterasse a tabela — a regra
-- ficaria valendo em produção e não no banco de quem desenvolve. A regra mora em
-- `helpers/ensure-single-active.ts`, num lugar só.
CREATE INDEX "downloads_kind_inactive_idx" ON "downloads"("kind", "inactive");
