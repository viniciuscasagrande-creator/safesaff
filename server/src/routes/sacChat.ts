import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import {
  dispatchSacQueue,
  claimSacConversation,
  isSacAgent,
  isSacSupervisor,
  SAC_CHAT_MAX_ACTIVE,
  SAC_AGENT_FRESH_MS
} from '../services/sacDispatcher.js'
import { globalAdmin } from '../auth.js'

export const sacChatRouter = Router()
sacChatRouter.use(requireAuth)
const bad = (res: any, message: string, code = 400) => res.status(code).json({ message })
const producerOf = (req: AuthRequest) => {
  const requested = Number(req.query.producerId || req.body?.producerId || 0)
  return globalAdmin(req.auth!.role) ? (requested || req.auth!.producerId || null) : req.auth!.producerId
}
const staffScope = (req: AuthRequest, producerId: number) =>
  isSacAgent(req.auth!.role) && (globalAdmin(req.auth!.role) || req.auth!.producerId === producerId)
const idOf = (req: AuthRequest) => Number(req.params.id)

// RBAC/ABAC estrito (COD-09): cliente vê sua própria conversa; supervisor vê toda a produtora;
// atendente vê conversas da fila ('queued') ou conversas sob sua responsabilidade ('assignedAgentId === req.auth.id').
async function visible(req: AuthRequest, id: number) {
  if (!Number.isSafeInteger(id) || id < 1) return null
  const row = await prisma.sacChatConversation.findUnique({ where: { id } })
  if (!row) return null
  if (row.clientUserId === req.auth!.id && req.auth!.producerId === row.producerId) return row
  if (staffScope(req, row.producerId)) {
    if (isSacSupervisor(req.auth!.role)) return row
    if (row.status === 'queued' || row.assignedAgentId === req.auth!.id) return row
  }
  return null
}

// Resolução de SLA efetivo por SlaPolicy e prioridade (COD-03)
async function resolveSlaDeadlines(producerId: number, priority: 'P1' | 'P2' | 'P3', nowMs: number) {
  const policy = await prisma.slaPolicy
    .findFirst({ where: { producerId, priority, active: true }, orderBy: { id: 'asc' } })
    .catch(() => null)
  const fallbackMap: Record<'P1' | 'P2' | 'P3', { responseMinutes: number; resolutionMinutes: number }> = {
    P1: { responseMinutes: 15, resolutionMinutes: 240 },
    P2: { responseMinutes: 30, resolutionMinutes: 480 },
    P3: { responseMinutes: 60, resolutionMinutes: 1440 }
  }
  const respMin = policy?.firstResponseMinutes ?? fallbackMap[priority].responseMinutes
  const resMin = policy?.resolutionMinutes ?? fallbackMap[priority].resolutionMinutes
  return {
    responseDueAt: new Date(nowMs + respMin * 60000),
    resolutionDueAt: new Date(nowMs + resMin * 60000),
    responseMinutes: respMin,
    resolutionMinutes: resMin
  }
}

// Clientes são identificados pelo token, nunca pelo campo de remetente do corpo.
sacChatRouter.post('/conversations', async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      subject: z.string().trim().min(3).max(160),
      message: z.string().trim().min(1).max(10000),
      priority: z.enum(['P1', 'P2', 'P3']).optional(),
      requiredSkill: z.string().trim().max(80).optional()
    })
    .safeParse(req.body)
  if (!parsed.success) return bad(res, 'Assunto ou mensagem inválidos.')
  const producerId = producerOf(req)
  if (!producerId || (!globalAdmin(req.auth!.role) && producerId !== req.auth!.producerId))
    return bad(res, 'Produtora inválida.', 403)
  const user = await prisma.user.findUnique({ where: { id: req.auth!.id } })
  if (!user || user.status !== 'ativo' || (user.producerId !== producerId && !globalAdmin(user.role)))
    return bad(res, 'Usuário não autorizado.', 403)
  const now = Date.now()
  const priority = parsed.data.priority || 'P3'
  const sla = await resolveSlaDeadlines(producerId, priority, now)
  const conversation = await prisma.$transaction(async tx => {
    const ticket = await tx.serviceTicket.create({
      data: {
        code: `SAC-CHAT-${randomUUID()}`,
        subject: parsed.data.subject,
        description: parsed.data.message,
        category: 'chat-sac',
        channel: 'chat-sac',
        requesterName: user.name,
        requesterEmail: user.email,
        producerId,
        status: 'aberto',
        priority,
        responseDueAt: sla.responseDueAt,
        resolutionDueAt: sla.resolutionDueAt
      }
    })
    const conversation = await tx.sacChatConversation.create({
      data: {
        producerId,
        ticketId: ticket.id,
        clientUserId: user.id,
        requiredSkill: parsed.data.requiredSkill || null
      }
    })
    await tx.ticketMessage.create({
      data: {
        producerId,
        ticketId: ticket.id,
        author: user.name,
        channel: 'chat-sac',
        internal: false,
        body: parsed.data.message
      }
    })
    return conversation
  })
  await dispatchSacQueue(producerId)
  return res
    .status(201)
    .json(await prisma.sacChatConversation.findUnique({ where: { id: conversation.id }, include: { ticket: true } }))
})

// Paginação por cursor e limite controlado (COD-07)
sacChatRouter.get('/conversations', async (req: AuthRequest, res) => {
  const producerId = producerOf(req)
  if (!producerId) return bad(res, 'Selecione a produtora.')
  const staff = staffScope(req, producerId)
  if (isSacAgent(req.auth!.role) && !staff) return bad(res, 'Produtora não autorizada.', 403)
  const cursor = req.query.cursor ? Number(req.query.cursor) : undefined
  const take = Math.min(150, Math.max(1, Number(req.query.limit || 100)))
  const rows = await prisma.sacChatConversation.findMany({
    where: {
      producerId,
      ...(!staff ? { clientUserId: req.auth!.id } : {}),
      ...(cursor && Number.isSafeInteger(cursor) ? { id: { lt: cursor } } : {})
    },
    include: {
      ticket: {
        select: {
          code: true,
          subject: true,
          requesterName: true,
          priority: true,
          responseDueAt: true,
          resolutionDueAt: true,
          firstResponseAt: true
        }
      },
      assignedAgent: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' },
    take
  })
  const nextCursor = rows.length === take ? rows[rows.length - 1]?.id ?? null : null
  return res.json({
    rows,
    nextCursor,
    staff,
    supervisor: staff && isSacSupervisor(req.auth!.role),
    limit: SAC_CHAT_MAX_ACTIVE
  })
})

sacChatRouter.get('/conversations/:id/messages', async (req: AuthRequest, res) => {
  const c = await visible(req, idOf(req))
  if (!c) return bad(res, 'Conversa não encontrada.', 404)
  const cursor = req.query.cursor ? Number(req.query.cursor) : undefined
  const take = Math.min(500, Math.max(1, Number(req.query.limit || 250)))
  const messages = await prisma.ticketMessage.findMany({
    where: {
      ticketId: c.ticketId,
      producerId: c.producerId,
      internal: false, channel: 'chat-sac',
      ...(cursor && Number.isSafeInteger(cursor) ? { id: { gt: cursor } } : {})
    },
    orderBy: { createdAt: 'asc' },
    take
  })
  return res.json(messages)
})

sacChatRouter.post('/conversations/:id/messages', async (req: AuthRequest, res) => {
  const parsed = z.object({ body: z.string().trim().min(1).max(10000) }).safeParse(req.body)
  if (!parsed.success) return bad(res, 'Mensagem inválida.')
  const c = await visible(req, idOf(req))
  if (!c) return bad(res, 'Conversa não encontrada.', 404)
  if (c.status === 'closed') return bad(res, 'Atendimento encerrado.', 409)
  const staff = staffScope(req, c.producerId)
  if (staff && c.assignedAgentId !== req.auth!.id && !isSacSupervisor(req.auth!.role))
    return bad(res, 'Somente atendente responsável pode responder.', 403)
  if (staff && c.status !== 'active') return bad(res, 'Conversa ainda está na fila.', 409)
  const user = await prisma.user.findUnique({ where: { id: req.auth!.id }, select: { name: true, status: true } })
  if (!user || user.status !== 'ativo') return bad(res, 'Usuário não autorizado.', 403)
  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: c.ticketId,
      producerId: c.producerId,
      author: user.name,
      body: parsed.data.body,
      channel: 'chat-sac',
      internal: false
    }
  })
  if (staff) {
    await prisma.serviceTicket.updateMany({
      where: { id: c.ticketId, firstResponseAt: null },
      data: { firstResponseAt: new Date() }
    })
  }
  return res.status(201).json(message)
})

// Atendimento N1 pela IA para o Cliente + Transferência preservando protocolo e histórico (COD-05)
sacChatRouter.post('/conversations/:id/handoff', async (req: AuthRequest, res) => {
  const c = await visible(req, idOf(req))
  if (!c) return bad(res, 'Conversa não encontrada.', 404)
  const parsed = z
    .object({
      summary: z.string().trim().min(3).max(4000),
      requiredSkill: z.string().trim().max(80).optional(),
      priority: z.enum(['P1', 'P2', 'P3']).optional()
    })
    .safeParse(req.body)
  if (!parsed.success) return bad(res, 'Resumo de transferência inválido.')
  await prisma.$transaction(async tx => {
    await tx.sacChatConversation.update({
      where: { id: c.id },
      data: {
        status: 'queued',
        requiredSkill: parsed.data.requiredSkill || c.requiredSkill || null
      }
    })
    if (parsed.data.priority) {
      await tx.serviceTicket.update({
        where: { id: c.ticketId },
        data: { priority: parsed.data.priority }
      })
    }
    await tx.ticketMessage.create({
      data: {
        ticketId: c.ticketId,
        producerId: c.producerId,
        author: 'IA SafeSaff (Triagem N1)',
        body: parsed.data.summary,
        channel: 'chat-sac',
        internal: false
      }
    })
  })
  await dispatchSacQueue(c.producerId)
  return res.json({ ok: true })
})

sacChatRouter.put('/agents/me/status', async (req: AuthRequest, res) => {
  if (!isSacAgent(req.auth!.role)) return bad(res, 'Acesso restrito ao SAC.', 403)
  const producerId = producerOf(req)
  if (!producerId || (!globalAdmin(req.auth!.role) && producerId !== req.auth!.producerId))
    return bad(res, 'Produtora não autorizada.', 403)
  const parsed = z.object({ status: z.enum(['available', 'busy', 'offline']) }).safeParse(req.body)
  if (!parsed.success) return bad(res, 'Status inválido.')
  const current = await prisma.user.findUnique({ where: { id: req.auth!.id } })
  if (!current || current.status !== 'ativo' || !isSacAgent(current.role))
    return bad(res, 'Usuário não autorizado.', 403)
  const state = await prisma.sacAgentState.upsert({
    where: { producerId_userId: { producerId, userId: req.auth!.id } },
    create: { producerId, userId: req.auth!.id, status: parsed.data.status, lastSeenAt: new Date() },
    update: { status: parsed.data.status, lastSeenAt: new Date() }
  })
  if (state.status === 'available') await dispatchSacQueue(producerId)
  return res.json(state)
})

// Gestão persistente de Skills dos colaboradores pelo Supervisor SAC (COD-04 / VIS-04)
sacChatRouter.put('/agents/:userId/skills', async (req: AuthRequest, res) => {
  const producerId = producerOf(req)
  if (!producerId || !staffScope(req, producerId) || !isSacSupervisor(req.auth!.role))
    return bad(res, 'Acesso restrito ao supervisor SAC.', 403)
  const userId = Number(req.params.userId)
  if (!Number.isSafeInteger(userId) || userId < 1) return bad(res, 'Colaborador inválido.')
  const parsed = z.object({ skills: z.array(z.string().trim().min(1).max(40)).max(20) }).safeParse(req.body)
  if (!parsed.success) return bad(res, 'Lista de skills inválida.')
  const skillsCsv = parsed.data.skills.join(',')
  const state = await prisma.sacAgentState.upsert({
    where: { producerId_userId: { producerId, userId } },
    create: { producerId, userId, status: 'offline', skills: skillsCsv, lastSeenAt: new Date() },
    update: { skills: skillsCsv }
  })
  await dispatchSacQueue(producerId)
  return res.json(state)
})

sacChatRouter.post('/conversations/:id/claim', async (req: AuthRequest, res) => {
  const c = await visible(req, idOf(req))
  if (!c) return bad(res, 'Conversa não encontrada.', 404)
  if (!staffScope(req, c.producerId)) return bad(res, 'Acesso restrito aos atendentes SAC.', 403)
  const result = await claimSacConversation(c.producerId, c.id, req.auth!.id)
  if (!result.ok) return bad(res, result.reason!, 409)
  return res.json({ ok: true })
})

// Fechamento transacional atômico (COD-08)
sacChatRouter.post('/conversations/:id/close', async (req: AuthRequest, res) => {
  const id = idOf(req)
  if (!Number.isSafeInteger(id) || id < 1) return bad(res, 'Conversa inválida.', 400)
  const outcome = await prisma.$transaction(async tx => {
    const c = await tx.sacChatConversation.findUnique({ where: { id } })
    if (!c) return { status: 404, message: 'Conversa não encontrada.' }
    if (!staffScope(req, c.producerId) || (c.assignedAgentId !== req.auth!.id && !isSacSupervisor(req.auth!.role))) {
      return { status: 403, message: 'Sem permissão para encerrar.' }
    }
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(74231, ${c.producerId})`
    const changed = await tx.sacChatConversation.updateMany({
      where: { id: c.id, status: 'active' },
      data: { status: 'closed', closedAt: new Date() }
    })
    if (!changed.count) return { status: 409, message: 'Conversa não está ativa ou já foi encerrada.' }
    await tx.serviceTicket.update({ where: { id: c.ticketId }, data: { status: 'fechado', closedAt: new Date() } })
    await tx.sacAssignmentEvent.create({
      data: { producerId: c.producerId, conversationId: c.id, agentUserId: req.auth!.id, action: 'close' }
    })
    return { status: 200, producerId: c.producerId }
  })
  if (outcome.status !== 200) return bad(res, outcome.message!, outcome.status)
  await dispatchSacQueue(outcome.producerId!)
  return res.json({ ok: true })
})

sacChatRouter.post('/conversations/:id/transfer', async (req: AuthRequest, res) => {
  const c = await visible(req, idOf(req))
  if (!c) return bad(res, 'Conversa não encontrada.', 404)
  if (!staffScope(req, c.producerId) || !isSacSupervisor(req.auth!.role))
    return bad(res, 'Transferência exclusiva da supervisão SAC.', 403)
  const parsed = z.object({ agentUserId: z.number().int().positive().optional() }).safeParse(req.body)
  if (!parsed.success) return bad(res, 'Atendente inválido.')
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(74231, ${c.producerId})`
    const latest = await tx.sacChatConversation.findUnique({ where: { id: c.id } })
    if (!latest || latest.status !== 'active') return { ok: false, reason: 'Conversa não está ativa.' }
    if (parsed.data.agentUserId) {
      const agent = await tx.user.findUnique({ where: { id: parsed.data.agentUserId } })
      const state = await tx.sacAgentState.findUnique({
        where: { producerId_userId: { producerId: c.producerId, userId: parsed.data.agentUserId } }
      })
      if (
        !agent ||
        !isSacAgent(agent.role) ||
        agent.status !== 'ativo' ||
        (!globalAdmin(agent.role) && agent.producerId !== c.producerId)
      )
        return { ok: false, reason: 'Atendente de destino inválido.' }
      if (!state || state.status !== 'available' || state.lastSeenAt.getTime() < Date.now() - SAC_AGENT_FRESH_MS)
        return { ok: false, reason: 'Atendente de destino não disponível.' }
      const workload = await tx.sacChatConversation.count({
        where: { producerId: c.producerId, status: 'active', assignedAgentId: agent.id, id: { not: c.id } }
      })
      if (workload >= SAC_CHAT_MAX_ACTIVE) return { ok: false, reason: 'Atendente atingiu a capacidade máxima.' }
      await tx.sacChatConversation.update({
        where: { id: c.id },
        data: { assignedAgentId: agent.id, assignedAt: new Date() }
      })
      await tx.sacAgentState.update({ where: { id: state.id }, data: { lastAssignedAt: new Date() } })
      await tx.sacAssignmentEvent.create({
        data: { producerId: c.producerId, conversationId: c.id, agentUserId: agent.id, action: 'transfer' }
      })
    } else {
      await tx.sacChatConversation.update({
        where: { id: c.id },
        data: { status: 'queued', assignedAgentId: null, assignedAt: null }
      })
      await tx.sacAssignmentEvent.create({
        data: { producerId: c.producerId, conversationId: c.id, agentUserId: req.auth!.id, action: 'transfer' }
      })
    }
    return { ok: true }
  })
  if (!result.ok) return bad(res, result.reason!, 409)
  if (!parsed.data.agentUserId) await dispatchSacQueue(c.producerId)
  return res.json({ ok: true })
})

sacChatRouter.get('/agents', async (req: AuthRequest, res) => {
  const producerId = producerOf(req)
  if (!producerId || !staffScope(req, producerId)) return bad(res, 'Acesso restrito ao SAC.', 403)
  const rows = await prisma.sacAgentState.findMany({
    where: { producerId },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { userId: 'asc' }
  })
  return res.json(rows)
})

// Endpoint oficial de KPIs conciliados em tempo real (COD-10 / VIS-02)
sacChatRouter.get('/kpis', async (req: AuthRequest, res) => {
  const producerId = producerOf(req)
  if (!producerId || !staffScope(req, producerId)) return bad(res, 'Acesso restrito ao SAC.', 403)
  const now = new Date()
  const [conversations, agentStates, approvedArticlesCount, aiSuggestions] = await Promise.all([
    prisma.sacChatConversation.findMany({
      where: { producerId },
      include: { ticket: true }
    }),
    prisma.sacAgentState.findMany({
      where: { producerId },
      include: { user: { select: { id: true, name: true } } }
    }),
    prisma.sacKnowledgeArticle.count({ where: { producerId, status: 'approved' } }),
    prisma.sacAiSuggestion.findMany({ where: { producerId } })
  ])

  const queuedCount = conversations.filter(c => c.status === 'queued').length
  const activeCount = conversations.filter(c => c.status === 'active').length
  const closedCount = conversations.filter(c => c.status === 'closed').length
  const totalToday = conversations.length

  const overdueOpen = conversations.filter(
    c => c.status !== 'closed' && c.ticket?.resolutionDueAt && c.ticket.resolutionDueAt < now
  ).length
  const denomEff = closedCount + overdueOpen
  const efficiencyPct = denomEff > 0 ? Math.round((closedCount / denomEff) * 100) : null

  const slaEvaluated = conversations.filter(c => c.ticket?.resolutionDueAt)
  const slaOnTime = slaEvaluated.filter(c => {
    if (!c.ticket?.resolutionDueAt) return true
    const endRef = c.closedAt || now
    return endRef <= c.ticket.resolutionDueAt
  }).length
  const slaOnTimePct = slaEvaluated.length > 0 ? Math.round((slaOnTime / slaEvaluated.length) * 100) : null

  return res.json({
    producerId,
    generatedAt: now.toISOString(),
    source: 'neon_postgresql',
    queuedCount,
    activeCount,
    closedCount,
    totalToday,
    efficiencyPct,
    slaOnTimePct,
    approvedArticlesCount,
    copilotSuggestionsTotal: aiSuggestions.length,
    copilotAcceptedCount: aiSuggestions.filter(s => s.status === 'accepted').length,
    agentsAvailable: agentStates.filter(
      a => a.status === 'available' && a.lastSeenAt.getTime() >= now.getTime() - SAC_AGENT_FRESH_MS
    ).length,
    agentsBusy: agentStates.filter(a => a.status === 'busy').length,
    agentsOffline: agentStates.filter(a => a.status === 'offline').length
  })
})
