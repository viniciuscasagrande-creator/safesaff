-- PostgreSQL migration for the isolated SAC chat module. Existing support tables are preserved.
CREATE TABLE "SacChatConversation" (
    "id" SERIAL PRIMARY KEY,
    "producerId" INTEGER NOT NULL REFERENCES "Producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "ticketId" INTEGER NOT NULL UNIQUE REFERENCES "ServiceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "clientUserId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "assignedAgentId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "requiredSkill" TEXT,
    "assignedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SacChatConversation_status_check" CHECK ("status" IN ('queued','active','closed'))
);
CREATE INDEX "SacChatConversation_producerId_status_createdAt_idx" ON "SacChatConversation"("producerId","status","createdAt");
CREATE INDEX "SacChatConversation_assignedAgentId_status_idx" ON "SacChatConversation"("assignedAgentId","status");
CREATE INDEX "SacChatConversation_clientUserId_createdAt_idx" ON "SacChatConversation"("clientUserId","createdAt");
CREATE TABLE "SacAgentState" (
    "id" SERIAL PRIMARY KEY,
    "producerId" INTEGER NOT NULL REFERENCES "Producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "skills" TEXT NOT NULL DEFAULT 'N1,ERP',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAssignedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SacAgentState_status_check" CHECK ("status" IN ('available','busy','offline')),
    CONSTRAINT "SacAgentState_producerId_userId_key" UNIQUE ("producerId","userId")
);
CREATE INDEX "SacAgentState_producerId_status_lastSeenAt_idx" ON "SacAgentState"("producerId","status","lastSeenAt");
CREATE TABLE "SacAssignmentEvent" (
    "id" SERIAL PRIMARY KEY,
    "producerId" INTEGER NOT NULL REFERENCES "Producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "conversationId" INTEGER NOT NULL REFERENCES "SacChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "agentUserId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SacAssignmentEvent_conversationId_createdAt_idx" ON "SacAssignmentEvent"("conversationId","createdAt");
