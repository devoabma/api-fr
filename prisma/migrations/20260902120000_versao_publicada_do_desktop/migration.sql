-- CreateEnum
-- Duas fontes escrevem na mesma tabela: a publicação avisa (`PUBLISHER`) e o job de espelho
-- descobre sozinho (`MIRROR`). O campo é diagnóstico — responde "por onde esta versão chegou"
-- quando alguém pergunta por que o painel demorou a mostrar o número novo.
CREATE TYPE "AppVersionOrigins" AS ENUM ('PUBLISHER', 'MIRROR');

-- CreateTable
-- A metade que faltava para responder "quais máquinas estão atrasadas": a outra já está em
-- `computers.app_version`, anunciada por cada estação no `register` do WebSocket.
--
-- Histórico, e não linha única sobrescrita: uma linha por versão publicada dá de graça o
-- "quando a 1.0.8 saiu e com que notas", que hoje só existe no terminal de quem publicou.
CREATE TABLE "app_versions" (
    "id" TEXT NOT NULL,
    -- Texto e não numérico, pelo mesmo motivo de `computers.app_version`: "1.0.10" não se
    -- ordena por comparação alfabética, e a conta é feita na aplicação, por partes.
    "version" VARCHAR(40) NOT NULL,
    -- O envelope assinado como chegou, sem reserializar. A fase 2 (`GET /app/version`) devolve
    -- este campo byte a byte às estações, e a estação recusa em silêncio o que não confere.
    "envelope" TEXT NOT NULL,
    -- `geradoEm` do manifesto: quando a versão foi publicada, não quando a API soube dela.
    "generated_at" TIMESTAMP(3),
    -- `notas` do manifesto, já em português, para o funcionário ler antes de mandar atualizar.
    "notes" TEXT,
    -- `implantacao` do manifesto (`{ percentual, macs }`), guardada como veio.
    "rollout" JSONB,
    "origin" "AppVersionOrigins" NOT NULL,
    -- `ETag` da última leitura do arquivo público, que faz o job perguntar com `If-None-Match`.
    "etag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- A versão vale por si: publicar a mesma duas vezes (o aviso e depois o espelho) atualiza a
-- linha, não cria outra.
CREATE UNIQUE INDEX "app_versions_version_key" ON "app_versions"("version");

-- CreateIndex
-- A leitura mais quente da tabela é sempre a mesma: "qual é a vigente", ou seja, a última
-- criada. Ela roda a cada listagem de computadores no painel.
CREATE INDEX "app_versions_created_at_idx" ON "app_versions"("created_at" DESC);
