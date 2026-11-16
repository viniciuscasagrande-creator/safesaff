import { prisma } from '../prisma.js'

export const SAC_CHAT_MAX_ACTIVE = 3
export const SAC_AGENT_FRESH_MS = 60_000
export const SAC_AGENT_ROLES = new Set(['sac-agent', 'sac-supervisor', 'admin', 'admin-master'])
export const isSacAgent = (role: string) => SAC_AGENT_ROLES.has(role)
export const isSacSupervisor = (role: string) => ['sac-supervisor', 'admin', 'admin-master'].includes(role)

// Every assignment and capacity count is serialized per producer by a PostgreSQL transaction lock.
// This also protects against multiple application instances racing to assign the same ticket.
export async function dispatchSacQueue(producerId: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(74231, ${producerId})`
    const now = new Date()
    const agents = await tx.sacAgentState.findMany({
      where: { producerId, status: 'available', lastSeenAt: { gte: new Date(now.getTime() - SAC_AGENT_FRESH_MS) }, user: { status: 'ativo', role: { in: [...SAC_AGENT_ROLES] } } },
      orderBy: [{ lastAssignedAt: 'asc' }, { id: 'asc' }],
    })
    const queued = await tx.sacChatConversation.findMany({ where: { producerId, status: 'queued', assignedAgentId: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
    const activeCounts = await tx.sacChatConversation.groupBy({ by: ['assignedAgentId'], where: { producerId, status: 'active', assignedAgentId: { not: null } }, _count: { _all: true } })
    const loads = new Map<number, number>(activeCounts.map((x) => [x.assignedAgentId!, x._count._all]))
    const assigned: number[] = []
    for (const conversation of queued) {
      const eligible = agents.filter(a => (loads.get(a.userId) || 0) < SAC_CHAT_MAX_ACTIVE)
      if (!eligible.length) break
      eligible.sort((a, b) => (loads.get(a.userId) || 0) - (loads.get(b.userId) || 0) || (a.lastAssignedAt?.getTime() || 0) - (b.lastAssignedAt?.getTime() || 0) || a.id - b.id)
      const agent = eligible[0]
      const updated = await tx.sacChatConversation.updateMany({ where: { id: conversation.id, status: 'queued', assignedAgentId: null }, data: { status: 'active', assignedAgentId: agent.userId, assignedAt: now } })
      if (!updated.count) continue
      await tx.sacAgentState.update({ where: { id: agent.id }, data: { lastAssignedAt: now } })
      await tx.sacAssignmentEvent.create({ data: { conversationId: conversation.id, producerId, agentUserId: agent.userId, action: 'automatic' } })
      loads.set(agent.userId, (loads.get(agent.userId) || 0) + 1)
      agent.lastAssignedAt = now
      assigned.push(conversation.id)
    }
    return assigned
  }, { timeout: 15000 })
}

export async function claimSacConversation(producerId: number, conversationId: number, agentUserId: number, action: 'manual' | 'transfer' = 'manual') {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(74231, ${producerId})`
    const state = await tx.sacAgentState.findUnique({ where: { producerId_userId: { producerId, userId: agentUserId } } })
    if (!state || state.status !== 'available' || state.lastSeenAt.getTime() < Date.now() - SAC_AGENT_FRESH_MS) return { ok: false, reason: 'Atendente não está disponível.' }
    const current = await tx.sacChatConversation.count({ where: { producerId, assignedAgentId: agentUserId, status: 'active' } })
    if (current >= SAC_CHAT_MAX_ACTIVE) return { ok: false, reason: 'Limite de três conversas simultâneas atingido.' }
    const changed = await tx.sacChatConversation.updateMany({ where: { id: conversationId, producerId, assignedAgentId: null, status: 'queued' }, data: { status: 'active', assignedAgentId: agentUserId, assignedAt: new Date() } })
    if (!changed.count) return { ok: false, reason: 'Conversa já assumida ou indisponível.' }
    await tx.sacAgentState.update({ where: { id: state.id }, data: { lastAssignedAt: new Date() } })
    await tx.sacAssignmentEvent.create({ data: { producerId, conversationId, agentUserId, action } })
    return { ok: true }
  })
}
