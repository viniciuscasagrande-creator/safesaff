import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { dispatchSacQueue, claimSacConversation, isSacAgent, isSacSupervisor, SAC_CHAT_MAX_ACTIVE } from '../services/sacDispatcher.js'
import { globalAdmin } from '../auth.js'

export const sacChatRouter = Router()
sacChatRouter.use(requireAuth)
const bad = (res: any, message: string, code = 400) => res.status(code).json({ message })
const producerOf = (req: AuthRequest) => {
  const requested = Number(req.query.producerId || req.body?.producerId || 0)
  return globalAdmin(req.auth!.role) ? (requested || req.auth!.producerId || null) : req.auth!.producerId
}
const staffScope = (req: AuthRequest, producerId: number) => isSacAgent(req.auth!.role) && (globalAdmin(req.auth!.role) || req.auth!.producerId === producerId)
const idOf = (req: AuthRequest) => Number(req.params.id)
async function visible(req: AuthRequest, id: number) {
  if (!Number.isSafeInteger(id) || id < 1) return null
  const row = await prisma.sacChatConversation.findUnique({ where: { id } })
  if (!row) return null
  if (row.clientUserId === req.auth!.id && req.auth!.producerId === row.producerId) return row
  if (staffScope(req, row.producerId)) return row
  return null
}

// Clientes são identificados pelo token, nunca pelo campo de remetente do corpo.
sacChatRouter.post('/conversations', async (req: AuthRequest, res) => {
  const parsed = z.object({ subject: z.string().trim().min(3).max(160), message: z.string().trim().min(1).max(10000) }).safeParse(req.body)
  if (!parsed.success) return bad(res, 'Assunto ou mensagem inválidos.')
  const producerId = producerOf(req)
  if (!producerId || (!globalAdmin(req.auth!.role) && producerId !== req.auth!.producerId)) return bad(res, 'Produtora inválida.', 403)
  const user = await prisma.user.findUnique({ where: { id: req.auth!.id } })
  if (!user || user.status !== 'ativo' || (user.producerId !== producerId && !globalAdmin(user.role))) return bad(res, 'Usuário não autorizado.', 403)
  const now = Date.now()
  const conversation = await prisma.$transaction(async tx => {
    const ticket = await tx.serviceTicket.create({ data: {
      code: `SAC-CHAT-${randomUUID()}`, subject: parsed.data.subject, description: parsed.data.message,
      category: 'chat-sac', channel: 'chat-sac', requesterName: user.name, requesterEmail: user.email,
      producerId, status: 'aberto', priority: 'P3', responseDueAt: new Date(now + 120 * 60000), resolutionDueAt: new Date(now + 1440 * 60000),
    } })
    const conversation = await tx.sacChatConversation.create({ data: { producerId, ticketId: ticket.id, clientUserId: user.id } })
    await tx.ticketMessage.create({ data: { producerId, ticketId: ticket.id, author: user.name, channel: 'chat-sac', internal: false, body: parsed.data.message } })
    return conversation
  })
  await dispatchSacQueue(producerId)
  return res.status(201).json(await prisma.sacChatConversation.findUnique({ where: { id: conversation.id }, include: { ticket: true } }))
})

sacChatRouter.get('/conversations', async (req: AuthRequest, res) => {
  const producerId = producerOf(req)
  if (!producerId) return bad(res, 'Selecione a produtora.')
  const staff = staffScope(req, producerId)
  if (isSacAgent(req.auth!.role) && !staff) return bad(res, 'Produtora não autorizada.', 403)
  const rows = await prisma.sacChatConversation.findMany({
    where: { producerId, ...(!staff ? { clientUserId: req.auth!.id } : {}) },
    include: { ticket: { select: { code: true, subject: true, requesterName: true } }, assignedAgent: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' }, take: 150,
  })
  return res.json({ rows, staff, supervisor: staff && isSacSupervisor(req.auth!.role), limit: SAC_CHAT_MAX_ACTIVE })
})

sacChatRouter.get('/conversations/:id/messages', async (req: AuthRequest, res) => {
  const c = await visible(req, idOf(req))
  if (!c) return bad(res, 'Conversa não encontrada.', 404)
  const messages = await prisma.ticketMessage.findMany({ where: { ticketId: c.ticketId, producerId: c.producerId, internal: false, channel: 'chat-sac' }, orderBy: { createdAt: 'asc' }, take: 500 })
  return res.json(messages)
})

sacChatRouter.post('/conversations/:id/messages', async (req: AuthRequest, res) => {
  const parsed = z.object({ body: z.string().trim().min(1).max(10000) }).safeParse(req.body)
  if (!parsed.success) return bad(res, 'Mensagem inválida.')
  const c = await visible(req, idOf(req))
  if (!c) return bad(res, 'Conversa não encontrada.', 404)
  if (c.status === 'closed') return bad(res, 'Atendimento encerrado.', 409)
  const staff = staffScope(req, c.producerId)
  if (staff && c.assignedAgentId !== req.auth!.id && !isSacSupervisor(req.auth!.role)) return bad(res, 'Somente atendente responsável pode responder.', 403)
  if (staff && c.status !== 'active') return bad(res, 'Conversa ainda está na fila.', 409)
  const user = await prisma.user.findUnique({ where: { id: req.auth!.id }, select: { name: true, status: true } })
  if (!user || user.status !== 'ativo') return bad(res, 'Usuário não autorizado.', 403)
  const message = await prisma.ticketMessage.create({ data: { ticketId: c.ticketId, producerId: c.producerId, author: user.name, body: parsed.data.body, channel: 'chat-sac', internal: false } })
  if (staff) await prisma.serviceTicket.updateMany({ where: { id: c.ticketId, firstResponseAt: null }, data: { firstResponseAt: new Date() } })
  return res.status(201).json(message)
})

sacChatRouter.put('/agents/me/status', async (req: AuthRequest, res) => {
  if (!isSacAgent(req.auth!.role)) return bad(res, 'Acesso restrito ao SAC.', 403)
  const producerId = producerOf(req)
  if (!producerId || (!globalAdmin(req.auth!.role) && producerId !== req.auth!.producerId)) return bad(res, 'Produtora não autorizada.', 403)
  const parsed = z.object({ status: z.enum(['available', 'busy', 'offline']) }).safeParse(req.body)
  if (!parsed.success) return bad(res, 'Status inválido.')
  const current = await prisma.user.findUnique({ where: { id: req.auth!.id } })
  if (!current || current.status !== 'ativo' || !isSacAgent(current.role)) return bad(res, 'Usuário não autorizado.', 403)
  const state = await prisma.sacAgentState.upsert({ where: { producerId_userId: { producerId, userId: req.auth!.id } }, create: { producerId, userId: req.auth!.id, status: parsed.data.status, lastSeenAt: new Date() }, update: { status: parsed.data.status, lastSeenAt: new Date() } })
  if (state.status === 'available') await dispatchSacQueue(producerId)
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

sacChatRouter.post('/conversations/:id/close', async (req: AuthRequest, res) => {
  const c = await visible(req, idOf(req))
  if (!c) return bad(res, 'Conversa não encontrada.', 404)
  if (!staffScope(req, c.producerId) || (c.assignedAgentId !== req.auth!.id && !isSacSupervisor(req.auth!.role))) return bad(res, 'Sem permissão para encerrar.', 403)
  if (c.status !== 'active') return bad(res, 'Conversa não está ativa.', 409)
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(74231, ${c.producerId})`
    const changed = await tx.sacChatConversation.updateMany({ where: { id: c.id, status: 'active' }, data: { status: 'closed', closedAt: new Date() } })
    if (!changed.count) return
    await tx.serviceTicket.update({ where: { id: c.ticketId }, data: { status: 'fechado', closedAt: new Date() } })
    await tx.sacAssignmentEvent.create({ data: { producerId: c.producerId, conversationId: c.id, agentUserId: req.auth!.id, action: 'close' } })
  })
  await dispatchSacQueue(c.producerId)
  return res.json({ ok: true })
})

sacChatRouter.post('/conversations/:id/transfer', async (req: AuthRequest, res) => {
  const c = await visible(req, idOf(req))
  if (!c) return bad(res, 'Conversa não encontrada.', 404)
  if (!staffScope(req, c.producerId) || !isSacSupervisor(req.auth!.role)) return bad(res, 'Transferência exclusiva da supervisão SAC.', 403)
  const parsed = z.object({ agentUserId: z.number().int().positive().optional() }).safeParse(req.body)
  if (!parsed.success) return bad(res, 'Atendente inválido.')
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(74231, ${c.producerId})`
    const latest = await tx.sacChatConversation.findUnique({ where: { id: c.id } })
    if (!latest || latest.status !== 'active') return { ok: false, reason: 'Conversa não está ativa.' }
    if (parsed.data.agentUserId) {
      const agent = await tx.user.findUnique({ where: { id: parsed.data.agentUserId } })
      const state = await tx.sacAgentState.findUnique({ where: { producerId_userId: { producerId: c.producerId, userId: parsed.data.agentUserId } } })
      if (!agent || !isSacAgent(agent.role) || agent.status !== 'ativo' || (!globalAdmin(agent.role) && agent.producerId !== c.producerId)) return { ok: false, reason: 'Atendente de destino inválido.' }
      if (!state || state.status !== 'available' || state.lastSeenAt.getTime() < Date.now() - 60000) return { ok: false, reason: 'Atendente de destino não disponível.' }
      const workload = await tx.sacChatConversation.count({ where: { producerId: c.producerId, status: 'active', assignedAgentId: agent.id, id: { not: c.id } } })
      if (workload >= SAC_CHAT_MAX_ACTIVE) return { ok: false, reason: 'Atendente atingiu a capacidade máxima.' }
      await tx.sacChatConversation.update({ where: { id: c.id }, data: { assignedAgentId: agent.id, assignedAt: new Date() } })
      await tx.sacAgentState.update({ where: { id: state.id }, data: { lastAssignedAt: new Date() } })
      await tx.sacAssignmentEvent.create({ data: { producerId: c.producerId, conversationId: c.id, agentUserId: agent.id, action: 'transfer' } })
    } else {
      await tx.sacChatConversation.update({ where: { id: c.id }, data: { status: 'queued', assignedAgentId: null, assignedAt: null } })
      await tx.sacAssignmentEvent.create({ data: { producerId: c.producerId, conversationId: c.id, agentUserId: req.auth!.id, action: 'transfer' } })
    }
    return { ok: true }
  })
  if (!result.ok) return bad(res, result.reason!, 409)
  if (!parsed.data.agentUserId) await dispatchSacQueue(c.producerId)
  return res.json({ ok: true })
})

sacChatRouter.get('/agents', async (req: AuthRequest, res) => {
  const producerId = producerOf(req)
  if (!producerId || !staffScope(req, producerId) || !isSacSupervisor(req.auth!.role)) return bad(res, 'Acesso restrito ao supervisor SAC.', 403)
  const rows = await prisma.sacAgentState.findMany({ where: { producerId }, include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { userId: 'asc' } })
  return res.json(rows)
})
