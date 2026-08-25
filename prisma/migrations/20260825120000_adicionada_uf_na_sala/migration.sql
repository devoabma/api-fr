-- AlterTable
-- A coluna nasce NOT NULL com DEFAULT 'MA' só para preencher as salas que já existem — todas
-- são do Maranhão hoje. O DROP DEFAULT logo em seguida obriga todo cadastro novo a dizer o
-- estado, em vez de herdar 'MA' calado.
ALTER TABLE "rooms" ADD COLUMN "uf" CHAR(2) NOT NULL DEFAULT 'MA';
ALTER TABLE "rooms" ALTER COLUMN "uf" DROP DEFAULT;
