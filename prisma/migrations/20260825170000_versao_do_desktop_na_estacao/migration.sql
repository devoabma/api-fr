-- AlterTable
-- Aditiva e sem backfill: as máquinas que já existem passam a valer como "nunca informou a
-- versão" até o primeiro `register` depois deste deploy. Diferente da UF, aqui não há valor
-- razoável para chutar — inventar uma versão seria exatamente o erro que este campo existe
-- para expor.
--
-- `app_version` é VARCHAR e não numérico de propósito: "1.0.7" é texto, e o rollback do
-- cliente faz o valor legitimamente diminuir.
ALTER TABLE "computers" ADD COLUMN "app_version" VARCHAR(40);

-- Carimbo de quando a estação INFORMOU, não de quando esteve online: o `register` só acontece
-- na conexão, então uma máquina meses no ar mantém um carimbo antigo enquanto está funcionando.
ALTER TABLE "computers" ADD COLUMN "app_version_reported_at" TIMESTAMP(3);
