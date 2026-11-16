-- Executar somente após a migração 20261116_sac_chat, em PostgreSQL.
CREATE TABLE "SacKnowledgeArticle" (
 "id" SERIAL PRIMARY KEY, "producerId" INTEGER NOT NULL,
 "title" TEXT NOT NULL, "content" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'draft', "updatedByUserId" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SacKnowledgeArticle_producerId_status_idx" ON "SacKnowledgeArticle"("producerId", "status");
CREATE TABLE "SacAiSuggestion" (
 "id" SERIAL PRIMARY KEY, "producerId" INTEGER NOT NULL,
 "conversationId" INTEGER NOT NULL, "agentUserId" INTEGER NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'suggested', "suggestion" TEXT NOT NULL,
 "sourceArticleIds" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "reviewedAt" TIMESTAMP(3)
);
CREATE INDEX "SacAiSuggestion_producerId_conversationId_createdAt_idx" ON "SacAiSuggestion"("producerId", "conversationId", "createdAt");
CREATE INDEX "SacAiSuggestion_agentUserId_status_idx" ON "SacAiSuggestion"("agentUserId", "status");
