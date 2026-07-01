-- DropForeignKey
ALTER TABLE "computer_sessions" DROP CONSTRAINT "computer_sessions_computer_id_fkey";

-- AddForeignKey
ALTER TABLE "computer_sessions" ADD CONSTRAINT "computer_sessions_computer_id_fkey" FOREIGN KEY ("computer_id") REFERENCES "computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
