import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { isSacAgent, isSacSupervisor } from '../services/sacDispatcher.js'
import { buildCopilotInput, rankKnowledge, suggestWithProvider } from '../services/sacAiCopilot.js'
import { globalAdmin } from '../auth.js'

export const sacAiRouter = Router()
sacAiRouter.use(requireAuth)
const fail = (res: any, status: number, message: string) => res.status(status).json({ message })
const getTenant = (req: AuthRequest): number | null => {
  const raw = req.query.producerId
  const requested = typeof raw === 'string' ? Number(raw) : undefined
  if (raw !== undefined && (!Number.isSafeInteger(requested) || requested! <= 0)) return null
  if (globalAdmin(req.auth!.role)) return requested || req.auth!.producerId || null
  if (requested && requested !== req.auth!.producerId) return null
  return req.auth!.producerId || null
}
const canWork = (req: AuthRequest, producerId: number) => isSacAgent(req.auth!.role) && (globalAdmin(req.auth!.role) || req.auth!.producerId === producerId)
const canManage = (req: AuthRequest, producerId: number) => canWork(req, producerId) && isSacSupervisor(req.auth!.role)
const articleInput = z.object({ title: z.string().trim().min(4).max(160), content: z.string().trim().min(20).max(16000) })

// O artigo é sempre criado em rascunho; a aprovação é uma ação exclusiva da supervisão.
sacAiRouter.get('/knowledge', async (req: AuthRequest, res) => {
  const tenant = getTenant(req)
  if (!tenant || !canWork(req, tenant)) return fail(res, 403, 'Acesso restrito ao SAC.')
  const rows = await prisma.sacKnowledgeArticle.findMany({ where: { producerId: tenant, ...(!canManage(req, tenant) ? { status: 'approved' } : {}) }, select: { id: true, title: true, status: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 100 })
  return res.json(rows)
})

sacAiRouter.post('/knowledge', async (req: AuthRequest, res) => {
  const tenant = getTenant(req)
  if (!tenant || !canManage(req, tenant)) return fail(res, 403, 'Somente supervisores SAC.')
  const parsed = articleInput.safeParse(req.body)
  if (!parsed.success) return fail(res, 400, 'Artigo inválido.')
  const row = await prisma.sacKnowledgeArticle.create({ data: { producerId: tenant, title: parsed.data.title, content: parsed.data.content, status: 'draft', updatedByUserId: req.auth!.id } })
  return res.status(201).json(row)
})

sacAiRouter.patch('/knowledge/:id', async (req: AuthRequest, res) => {
  const tenant = getTenant(req)
  if (!tenant || !canManage(req, tenant)) return fail(res, 403, 'Somente supervisores SAC.')
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, 'Artigo inválido.')
  const parsed = articleInput.partial().extend({ status: z.enum(['draft','approved','archived']).optional() }).refine(x => Object.keys(x).length > 0).safeParse(req.body)
  if (!parsed.success) return fail(res, 400, 'Alteração inválida.')
  const changed = await prisma.sacKnowledgeArticle.updateMany({ where: { id, producerId: tenant }, data: { ...parsed.data, updatedByUserId: req.auth!.id } })
  if (!changed.count) return fail(res, 404, 'Artigo não encontrado.')
  return res.json({ ok: true })
})

sacAiRouter.post('/conversations/:id/suggest', async (req: AuthRequest, res) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, 400, 'Conversa inválida.')
  const conversation = await prisma.sacChatConversation.findUnique({ where: { id } })
  if (!conversation || !canWork(req, conversation.producerId)) return fail(res, 404, 'Conversa indisponível.')
  if (conversation.status !== 'active') return fail(res, 409, 'A conversa precisa estar em atendimento.')
  if (conversation.assignedAgentId !== req.auth!.id && !isSacSupervisor(req.auth!.role)) return fail(res, 403, 'Acesso restrito ao atendente responsável.')
  const articles = await prisma.sacKnowledgeArticle.findMany({ where: { producerId: conversation.producerId, status: 'approved' }, select: { id: true, title: true, content: true }, orderBy: { updatedAt: 'desc' }, take: 100 })
  const messages = await prisma.ticketMessage.findMany({ where: { producerId: conversation.producerId, ticketId: conversation.ticketId, internal: false, channel: 'chat-sac' }, select: { author: true, body: true }, orderBy: { createdAt: 'desc' }, take: 12 })
  if (!messages.length) return fail(res, 409, 'Conversa ainda sem mensagens.')
  const chronological = messages.reverse()
  const reference = rankKnowledge(articles, chronological.slice(-4).map(m => m.body).join(' '))
  if (!reference.length) return fail(res, 422, 'Base aprovada não contém conteúdo pertinente. Atendimento humano necessário.')
  try {
    const suggestion = await suggestWithProvider(buildCopilotInput(reference, chronological))
    const row = await prisma.sacAiSuggestion.create({ data: { producerId: conversation.producerId, conversationId: id, agentUserId: req.auth!.id, suggestion, sourceArticleIds: JSON.stringify(reference.map(a => a.id)) } })
    return res.json({ id: row.id, suggestion: row.suggestion, sources: reference.map(a => ({ id: a.id, title: a.title })), notice: 'Rascunho privado da IA. Revise antes de enviar.' })
  } catch (error) {
    // Não expor corpo das mensagens, credenciais ou stacktrace no erro HTTP.
    return fail(res, 503, error instanceof Error ? error.message : 'Serviço de IA indisponível.')
  }
})

sacAiRouter.post('/suggestions/:id/review', async (req: AuthRequest, res) => {
  const id = Number(req.params.id)
  const parsed = z.object({ decision: z.enum(['accepted','discarded']) }).safeParse(req.body)
  if (!Number.isSafeInteger(id) || id <= 0 || !parsed.success) return fail(res, 400, 'Revisão inválida.')
  const row = await prisma.sacAiSuggestion.findUnique({ where: { id } })
  if (!row || !canWork(req, row.producerId) || (row.agentUserId !== req.auth!.id && !isSacSupervisor(req.auth!.role))) return fail(res, 404, 'Sugestão indisponível.')
  const changed = await prisma.sacAiSuggestion.updateMany({ where: { id, producerId: row.producerId, status: 'suggested' }, data: { status: parsed.data.decision, reviewedAt: new Date() } })
  if (!changed.count) return fail(res, 409, 'Sugestão já revisada.')
  // Não cria TicketMessage; o envio normal exige ação explícita do atendente.
  return res.json({ ok: true })
})
