-- CreateIndex
CREATE INDEX "computer_sessions_started_at_idx" ON "computer_sessions"("started_at");

-- CreateIndex
CREATE INDEX "computer_sessions_computer_id_idx" ON "computer_sessions"("computer_id");

-- CreateIndex
CREATE INDEX "computer_sessions_lawyer_id_idx" ON "computer_sessions"("lawyer_id");
