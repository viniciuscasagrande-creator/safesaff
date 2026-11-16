# Modelo de dados proposto (não aplicado)

## Preservar
- `ServiceTicket` (ticket único e SLA), `TicketMessage` (histórico), `SlaPolicy` (políticas), `SacChatConversation` (fila/canal chat), `SacAgentState` (presença), `SacAssignmentEvent` (auditoria).
- Não sobrescrever/alterar registros históricos. Migrações aditivas e versionadas em homologação.

## Adicionar (nomes indicativos Prisma)

| Modelo | Campos principais | Índices/restrições |
|---|---|---|
| `SacSkill` | id, producerId, code, name, category, active, createdAt | `unique(producerId,code)` |
| `SacAgentSkill` | id, producerId, userId, skillId, level, enabled, validatedBy, updatedAt | `unique(producerId,userId,skillId)`, FKs coerentes ao tenant |
| `SacTicketSkill` | id, producerId, ticketId, skillId, required, source, confidence | `unique(ticketId,skillId)`; source `manual|rule|ai` |
| `SacQueueSnapshot` | id, producerId, observedAt, channel, queuedCount, oldestWaitSeconds, activeCount | `unique(producerId,observedAt,channel)`; snapshots por minuto |
| `SacAlertRule` | id, producerId, type, threshold, windowMinutes, severity, cooldownMinutes, enabled | índice tenant+tipo |
| `SacAlertEvent` | id, producerId, ruleId, startedAt, severity, evidenceJson, acknowledgedAt, acknowledgedBy, dedupeKey | `unique(producerId,dedupeKey)` |
| `SacExternalInteraction` | id, producerId, ticketId, channel, provider, externalEventId, externalThreadId, eventAt, payloadHash | `unique(producerId,provider,externalEventId)`; nunca armazenar credenciais |
| `SacHandlingSession` | id, producerId, ticketId, agentUserId, startedAt, endedAt, pausedSeconds | base para TMA ativo; check timestamps |
| `SacSlaEvent` | id, producerId, ticketId, eventType, effectiveAt, policyVersion, metadataJson | índice tenant+ticket+evento |
| `SacAiSession` | id, producerId, ticketId, mode, state, providerCode, startedAt, endedAt | índice tenant+ticket |
| `SacAiInteraction` | id, producerId, aiSessionId, messageId?, decision, knowledgeVersion, modelCode, tokensIn?, tokensOut?, latencyMs?, costEstimate?, createdAt | índice tenant+criação; conteúdo sensível minimizado |
| `SacAiHandoff` | id, producerId, aiSessionId, ticketId, reason, summaryRedacted, createdAt, acceptedAt? | índice tenant+ticket |
| `SacKnowledgeArticle` | id, producerId, title, body, version, approvedAt?, approvedBy?, status | consulta somente itens aprovados por tenant |
| `SacDashboardDailyAggregate` (opcional) | producerId, localDate, channel, opened, resolved, breached, generatedAt | agregado para performance, não fonte da verdade |

## Regras de integridade e migrações
1. Todas as tabelas de negócio possuem `producerId`; validar tenant nas consultas além das foreign keys.
2. Ao relacionar usuários e tickets, conferir `producerId` de ambos em código/transação; não confiar em IDs enviados pelo navegador.
3. Guardar `occurredAt` (evento), `receivedAt` (webhook) e timestamps UTC; filtros locais com `America/Sao_Paulo`.
4. Não normalizar três canais como três chamados se se referirem ao mesmo protocolo; manter origem e interações separadas.
5. Configuração de SLA deve ter versão estável por ticket; calendário de feriados e política de pausa precisam ser definidos.
6. Scripts SQL/Prisma só devem ser criados e executados após análise do esquema atualizado, migrações existentes e estratégia de deploy/baseline.

## Ordem de migração
M1 skills/atribuições + eventos; M2 snapshots/alertas; M3 conectores/eventos externos; M4 eventos SLA e sessões; M5 IA/knowledge; M6 agregados opcionais. Cada migração deve ter rollback planejado, backup e verificação de índices.
