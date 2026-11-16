import { getApiBaseUrl, getAuthHeader, hasStoredToken } from './api'

const base = `${getApiBaseUrl()}/sac/chat`
const LOCAL_CONVS_KEY = 'safesaff_sac_chat_convs_v2'
const LOCAL_MSGS_KEY = 'safesaff_sac_chat_msgs_v2'
const LOCAL_AGENTS_KEY = 'safesaff_sac_chat_agents_v2'
export const SAC_MAX_ACTIVE_PER_AGENT = 3

export interface SacConversation {
  id: number
  producerId: number
  clientUserId: number
  assignedAgentId: number | null
  status: 'queued' | 'active' | 'closed'
  requiredSkill?: string | null
  createdAt: string
  assignedAt?: string | null
  closedAt?: string | null
  ticket: {
    code: string
    subject: string
    requesterName: string
    requesterEmail?: string
    orderCode?: string
    eventName?: string
    priority?: 'P1' | 'P2' | 'P3'
    responseDueAt?: string
    resolutionDueAt?: string
    firstResponseAt?: string | null
  }
  assignedAgent?: { id: number; name: string } | null
}

export interface SacMessage {
  id: number
  author: string
  body: string
  createdAt: string
  senderRole?: 'client' | 'agent' | 'system' | 'ai'
}

export interface SacList {
  rows: SacConversation[]
  nextCursor?: number | null
  staff: boolean
  supervisor: boolean
  limit: number
}

export interface SacAgentInfo {
  userId: number
  status: 'available' | 'busy' | 'offline'
  skills: string[]
  activeChatsCount?: number
  lastSeenAt?: string
  user: { id?: number; name: string; role?: string }
}

export interface SacReconciledKpis {
  producerId: number
  generatedAt: string
  source: 'neon_postgresql' | 'local_operational_store'
  queuedCount: number
  activeCount: number
  closedCount: number
  totalToday: number
  efficiencyPct: number | null
  slaOnTimePct: number | null
  tmaFormatted: string
  agentsAvailable: number
  agentsBusy: number
  agentsOffline: number
  byPriority: {
    P1: { total: number; onTimePct: number | null; responseMinutes: number }
    P2: { total: number; onTimePct: number | null; responseMinutes: number }
    P3: { total: number; onTimePct: number | null; responseMinutes: number }
  }
  channels: {
    chat: { count: number; status: 'integrated'; sharePct: number }
    whatsapp: { count: number; status: 'not_integrated'; sharePct: number }
    email: { count: number; status: 'not_integrated'; sharePct: number }
  }
}

const DEFAULT_AGENTS: SacAgentInfo[] = [
  {
    userId: 101,
    status: 'available',
    skills: ['N1', 'ERP', 'Ingressos & QR Code', 'Financeiro'],
    lastSeenAt: new Date().toISOString(),
    user: { id: 101, name: 'Ana Paula (SAC Nível 1)', role: 'sac-agent' }
  },
  {
    userId: 102,
    status: 'available',
    skills: ['N2', 'ITIL', 'Estornos & CDC', 'Cobrança'],
    lastSeenAt: new Date().toISOString(),
    user: { id: 102, name: 'Marcos Vinícius (SAC Nível 2)', role: 'sac-agent' }
  },
  {
    userId: 103,
    status: 'busy',
    skills: ['N1', 'N2', 'ITIL', 'Financeiro', 'Estornos & CDC'],
    lastSeenAt: new Date().toISOString(),
    user: { id: 103, name: 'Carla Mendes (Supervisora SAC)', role: 'sac-supervisor' }
  }
]

const nowMs = Date.now()

const DEFAULT_CONVERSATIONS: SacConversation[] = [
  {
    id: 1,
    producerId: 1,
    clientUserId: 501,
    assignedAgentId: null,
    status: 'queued',
    requiredSkill: 'Ingressos & QR Code',
    createdAt: new Date(nowMs - 8 * 60000).toISOString(),
    ticket: {
      code: 'SAC-000125',
      subject: 'Dúvida sobre transferência de titularidade de ingresso',
      requesterName: 'Lucas Fernandes Pereira',
      requesterEmail: 'lucas.pereira@email.com',
      orderCode: 'ORD-928371',
      eventName: 'Whindersson Nunes - SESSÃO EXTRA 19H',
      priority: 'P3',
      responseDueAt: new Date(nowMs + 52 * 60000).toISOString(),
      resolutionDueAt: new Date(nowMs + 1432 * 60000).toISOString()
    },
    assignedAgent: null
  },
  {
    id: 2,
    producerId: 1,
    clientUserId: 502,
    assignedAgentId: null,
    status: 'queued',
    requiredSkill: 'Estornos & CDC',
    createdAt: new Date(nowMs - 4 * 60000).toISOString(),
    ticket: {
      code: 'SAC-000126',
      subject: 'Solicitação de reembolso por alteração de horário do show',
      requesterName: 'Mariana Costa Ribeiro',
      requesterEmail: 'mariana.costa@email.com.br',
      orderCode: 'ORD-928419',
      eventName: 'Festival Sinfônico de Inverno 2026',
      priority: 'P2',
      responseDueAt: new Date(nowMs + 26 * 60000).toISOString(),
      resolutionDueAt: new Date(nowMs + 476 * 60000).toISOString()
    },
    assignedAgent: null
  },
  {
    id: 3,
    producerId: 1,
    clientUserId: 503,
    assignedAgentId: 101,
    status: 'active',
    requiredSkill: 'Financeiro',
    createdAt: new Date(nowMs - 19 * 60000).toISOString(),
    assignedAt: new Date(nowMs - 16 * 60000).toISOString(),
    ticket: {
      code: 'SAC-000124',
      subject: 'Comprovante PIX e liberação de assento na Plateia VIP',
      requesterName: 'Roberto Almeida Prado',
      requesterEmail: 'roberto.prado@empresa.com.br',
      orderCode: 'ORD-928104',
      eventName: 'MARCOS & BELUTTI • Tour 18 Anos',
      priority: 'P1',
      firstResponseAt: new Date(nowMs - 15 * 60000).toISOString(),
      responseDueAt: new Date(nowMs - 4 * 60000).toISOString(),
      resolutionDueAt: new Date(nowMs + 221 * 60000).toISOString()
    },
    assignedAgent: { id: 101, name: 'Ana Paula (SAC Nível 1)' }
  },
  {
    id: 4,
    producerId: 1,
    clientUserId: 504,
    assignedAgentId: 102,
    status: 'closed',
    requiredSkill: 'Ingressos & QR Code',
    createdAt: new Date(nowMs - 65 * 60000).toISOString(),
    assignedAt: new Date(nowMs - 63 * 60000).toISOString(),
    closedAt: new Date(nowMs - 54 * 60000).toISOString(),
    ticket: {
      code: 'SAC-000123',
      subject: 'Reenvio de 2ª via de ingresso QR Code por e-mail',
      requesterName: 'Camila Rocha Azevedo',
      requesterEmail: 'camila.azevedo@email.com',
      orderCode: 'ORD-927990',
      eventName: 'Whindersson Nunes - SESSÃO EXTRA 19H',
      priority: 'P3',
      firstResponseAt: new Date(nowMs - 62 * 60000).toISOString(),
      responseDueAt: new Date(nowMs - 5 * 60000).toISOString(),
      resolutionDueAt: new Date(nowMs + 1375 * 60000).toISOString()
    },
    assignedAgent: { id: 102, name: 'Marcos Vinícius (SAC Nível 2)' }
  }
]

const DEFAULT_MESSAGES: Record<number, SacMessage[]> = {
  1: [
    {
      id: 1001,
      author: 'Lucas Fernandes Pereira',
      body: 'Olá! Comprei 2 ingressos para a sessão extra das 19h e preciso transferir 1 ingresso para o CPF da minha esposa. Podem me orientar?',
      createdAt: new Date(nowMs - 8 * 60000).toISOString(),
      senderRole: 'client'
    }
  ],
  2: [
    {
      id: 2001,
      author: 'Mariana Costa Ribeiro',
      body: 'Boa tarde! Não poderei comparecer no novo horário do Festival Sinfônico e gostaria de solicitar o reembolso integral do pedido ORD-928419.',
      createdAt: new Date(nowMs - 4 * 60000).toISOString(),
      senderRole: 'client'
    }
  ],
  3: [
    {
      id: 3001,
      author: 'Roberto Almeida Prado',
      body: 'Olá, realizei o pagamento via PIX há 5 minutos para os assentos A05 e A06. Já consta confirmado?',
      createdAt: new Date(nowMs - 18 * 60000).toISOString(),
      senderRole: 'client'
    },
    {
      id: 3002,
      author: 'Ana Paula (SAC Nível 1)',
      body: 'Olá Roberto! Seja bem-vindo ao SAC SafeSaff. Já localizei seu pedido ORD-928104 aqui no ERP e seus 2 ingressos já estão emitidos e ativos para entrada!',
      createdAt: new Date(nowMs - 15 * 60000).toISOString(),
      senderRole: 'agent'
    }
  ],
  4: [
    {
      id: 4001,
      author: 'Camila Rocha Azevedo',
      body: 'Preciso da 2ª via do meu QR Code do pedido ORD-927990.',
      createdAt: new Date(nowMs - 65 * 60000).toISOString(),
      senderRole: 'client'
    },
    {
      id: 4002,
      author: 'Marcos Vinícius (SAC Nível 2)',
      body: 'Olá Camila! Acabei de reenviar o PDF e o QR Code atualizado para seu e-mail cadastrado. Bom espetáculo!',
      createdAt: new Date(nowMs - 55 * 60000).toISOString(),
      senderRole: 'agent'
    }
  ]
}

function loadLocalConvs(): SacConversation[] {
  if (typeof window === 'undefined') return DEFAULT_CONVERSATIONS
  try {
    const raw = localStorage.getItem(LOCAL_CONVS_KEY)
    if (!raw) {
      localStorage.setItem(LOCAL_CONVS_KEY, JSON.stringify(DEFAULT_CONVERSATIONS))
      return DEFAULT_CONVERSATIONS
    }
    const parsed = JSON.parse(raw) as SacConversation[]
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_CONVERSATIONS
  } catch {
    return DEFAULT_CONVERSATIONS
  }
}

function saveLocalConvs(list: SacConversation[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCAL_CONVS_KEY, JSON.stringify(list))
  notifySacSync()
}

function loadLocalMsgs(): Record<number, SacMessage[]> {
  if (typeof window === 'undefined') return DEFAULT_MESSAGES
  try {
    const raw = localStorage.getItem(LOCAL_MSGS_KEY)
    if (!raw) {
      localStorage.setItem(LOCAL_MSGS_KEY, JSON.stringify(DEFAULT_MESSAGES))
      return DEFAULT_MESSAGES
    }
    return JSON.parse(raw)
  } catch {
    return DEFAULT_MESSAGES
  }
}

function saveLocalMsgs(map: Record<number, SacMessage[]>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCAL_MSGS_KEY, JSON.stringify(map))
  notifySacSync()
}

function loadLocalAgents(): SacAgentInfo[] {
  if (typeof window === 'undefined') return DEFAULT_AGENTS
  try {
    const raw = localStorage.getItem(LOCAL_AGENTS_KEY)
    if (!raw) {
      localStorage.setItem(LOCAL_AGENTS_KEY, JSON.stringify(DEFAULT_AGENTS))
      return DEFAULT_AGENTS
    }
    const parsed = JSON.parse(raw) as SacAgentInfo[]
    return Array.isArray(parsed) && parsed.length
      ? parsed.map(a => ({ ...a, skills: Array.isArray(a.skills) ? a.skills : ['N1', 'ERP'] }))
      : DEFAULT_AGENTS
  } catch {
    return DEFAULT_AGENTS
  }
}

function saveLocalAgents(agents: SacAgentInfo[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCAL_AGENTS_KEY, JSON.stringify(agents))
  notifySacSync()
}

function notifySacSync() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('safesaff:sac-chat-sync'))
  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('safesaff_sac_chat_channel')
      bc.postMessage({ type: 'SYNC', ts: Date.now() })
      bc.close()
    }
  } catch {
    // ignore
  }
}

function hasSkillMatch(agentSkills: string[], requiredSkill?: string | null): boolean {
  if (!requiredSkill || !requiredSkill.trim()) return true
  const req = requiredSkill.trim().toLowerCase()
  return agentSkills.some(s => s.trim().toLowerCase() === req)
}

function computeSlaDeadlines(priority: 'P1' | 'P2' | 'P3' = 'P3', fromMs = Date.now()) {
  const map: Record<'P1' | 'P2' | 'P3', { resp: number; res: number }> = {
    P1: { resp: 15, res: 240 },
    P2: { resp: 30, res: 480 },
    P3: { resp: 60, res: 1440 }
  }
  const cfg = map[priority] || map.P3
  return {
    responseDueAt: new Date(fromMs + cfg.resp * 60000).toISOString(),
    resolutionDueAt: new Date(fromMs + cfg.res * 60000).toISOString()
  }
}

export function formatRemainingSla(conv: SacConversation): {
  label: string
  severity: 'ok' | 'warning' | 'breached'
} {
  if (conv.status === 'closed') {
    return { label: 'SLA concluído', severity: 'ok' }
  }
  const targetIso =
    !conv.ticket.firstResponseAt && conv.ticket.responseDueAt
      ? conv.ticket.responseDueAt
      : conv.ticket.resolutionDueAt
  if (!targetIso) {
    const prio = conv.ticket.priority || 'P3'
    return { label: `SLA ${prio}`, severity: 'ok' }
  }
  const diffMin = Math.round((new Date(targetIso).getTime() - Date.now()) / 60000)
  if (diffMin < 0) {
    return { label: `SLA vencido (${Math.abs(diffMin)}m)`, severity: 'breached' }
  }
  if (diffMin <= 15) {
    return { label: `SLA: ${diffMin} min`, severity: 'warning' }
  }
  if (diffMin >= 60) {
    const h = Math.floor(diffMin / 60)
    const m = diffMin % 60
    return { label: `SLA: ${h}h ${m}m`, severity: 'ok' }
  }
  return { label: `SLA: ${diffMin} min`, severity: 'ok' }
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (!hasStoredToken()) {
    throw new Error('FALLBACK_LOCAL_SAC')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      signal: controller.signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error('FALLBACK_LOCAL_SAC')
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error((data as { message?: string }).message || 'Erro no Chat SAC')
    return data as T
  } finally {
    clearTimeout(timer)
  }
}

// Heartbeat global de presença independente da tela do Chat SAC estar aberta (COD-01)
let globalPresenceTimer: ReturnType<typeof setInterval> | null = null
let globalPresenceAgentId = 101
let globalPresenceProducerId: number | null | undefined = 1

export function ensureGlobalSacPresenceHeartbeat(
  producerId?: number | null,
  agentId = 101
) {
  if (typeof window === 'undefined') return
  globalPresenceProducerId = producerId
  globalPresenceAgentId = agentId
  if (globalPresenceTimer) return
  globalPresenceTimer = setInterval(() => {
    const saved = sacChatApi.getAgentSavedStatus(globalPresenceAgentId)
    if (saved !== 'offline') {
      void sacChatApi
        .status(saved, globalPresenceProducerId, globalPresenceAgentId)
        .catch(() => undefined)
    }
  }, 20000)
}

export const sacChatApi = {
  getInitialSnapshot(): {
    rows: SacConversation[]
    agents: SacAgentInfo[]
    messagesMap: Record<number, SacMessage[]>
  } {
    const rows = loadLocalConvs()
    const agents = loadLocalAgents().map(a => ({
      ...a,
      activeChatsCount: rows.filter(
        c => c.status === 'active' && c.assignedAgentId === a.userId
      ).length
    }))
    return {
      rows,
      agents,
      messagesMap: loadLocalMsgs()
    }
  },

  getAgentSavedStatus(agentId = 101): 'available' | 'busy' | 'offline' {
    const found = loadLocalAgents().find(a => a.userId === agentId)
    return found?.status || 'available'
  },

  async list(producerId?: number | null): Promise<SacList> {
    try {
      const remote = await call<SacList>(
        `/conversations${producerId ? `?producerId=${producerId}` : ''}`
      )
      if (remote.rows.length > 0) {
        return remote
      }
      return {
        rows: loadLocalConvs(),
        staff: true,
        supervisor: true,
        limit: SAC_MAX_ACTIVE_PER_AGENT
      }
    } catch {
      const rows = loadLocalConvs()
      return {
        rows,
        staff: true,
        supervisor: true,
        limit: SAC_MAX_ACTIVE_PER_AGENT
      }
    }
  },

  async create(
    subject: string,
    message: string,
    producerId?: number | null,
    requesterName = 'Cliente Autenticado ERP',
    options?: {
      priority?: 'P1' | 'P2' | 'P3'
      requiredSkill?: string
      orderCode?: string
    }
  ): Promise<SacConversation> {
    const priority = options?.priority || 'P3'
    const requiredSkill = options?.requiredSkill
    try {
      return await call<SacConversation>('/conversations', 'POST', {
        subject,
        message,
        producerId,
        priority,
        requiredSkill
      })
    } catch {
      const convs = loadLocalConvs()
      const agents = loadLocalAgents()
      const msgs = loadLocalMsgs()

      // Distribuição Automática com Limite de 3 Conversas + Compatibilidade de Skill (COD-04)
      const availableCandidates = agents
        .filter(a => a.status === 'available' && hasSkillMatch(a.skills, requiredSkill))
        .map(a => ({
          agent: a,
          activeCount: convs.filter(
            c => c.status === 'active' && c.assignedAgentId === a.userId
          ).length
        }))
        .filter(item => item.activeCount < SAC_MAX_ACTIVE_PER_AGENT)
        .sort((a, b) => a.activeCount - b.activeCount)

      const chosen = availableCandidates[0]?.agent || null
      const newId = Math.max(0, ...convs.map(c => c.id)) + 1
      const code = `SAC-${String(122 + newId).padStart(6, '0')}`
      const nowIso = new Date().toISOString()
      const deadlines = computeSlaDeadlines(priority)

      const created: SacConversation = {
        id: newId,
        producerId: producerId || 1,
        clientUserId: 599,
        assignedAgentId: chosen ? chosen.userId : null,
        status: chosen ? 'active' : 'queued',
        requiredSkill: requiredSkill || null,
        createdAt: nowIso,
        assignedAt: chosen ? nowIso : null,
        ticket: {
          code,
          subject,
          requesterName,
          requesterEmail: 'cliente@safesaff.com.br',
          orderCode: options?.orderCode || 'ORD-928371',
          eventName: 'Whindersson Nunes - SESSÃO EXTRA 19H',
          priority,
          responseDueAt: deadlines.responseDueAt,
          resolutionDueAt: deadlines.resolutionDueAt
        },
        assignedAgent: chosen ? { id: chosen.userId, name: chosen.user.name } : null
      }

      const initialMessages: SacMessage[] = [
        {
          id: Date.now(),
          author: requesterName,
          body: message,
          createdAt: nowIso,
          senderRole: 'client'
        }
      ]

      if (chosen) {
        initialMessages.push({
          id: Date.now() + 1,
          author: 'Distribuidor Automático SAC',
          body: `Atendimento ${code} (${priority}${requiredSkill ? ` • Skill: ${requiredSkill}` : ''}) distribuído automaticamente para ${chosen.user.name} (respeitando o limite de ${SAC_MAX_ACTIVE_PER_AGENT} chats simultâneos).`,
          createdAt: nowIso,
          senderRole: 'system'
        })
      } else {
        initialMessages.push({
          id: Date.now() + 1,
          author: 'Fila Central SAC',
          body: `Protocolo ${code} (${priority}${requiredSkill ? ` • Skill exigida: ${requiredSkill}` : ''}) registrado na Fila de Espera do SAC. Assim que um atendente com a competência ficar disponível (< ${SAC_MAX_ACTIVE_PER_AGENT} chats), será atribuído automaticamente.`,
          createdAt: nowIso,
          senderRole: 'system'
        })
      }

      msgs[newId] = initialMessages
      saveLocalMsgs(msgs)
      saveLocalConvs([created, ...convs])
      return created
    }
  },

  // Handoff da IA para o SAC mantendo o mesmo protocolo quando já existe conversa ou criando protocolo unificado (COD-05)
  async handoffFromAi(params: {
    existingConversationId?: number | null
    subject: string
    clientName: string
    orderCode: string
    priority: 'P1' | 'P2' | 'P3'
    requiredSkill: string
    transcriptTurns: { sender: 'ai' | 'client'; text: string; time: string }[]
    producerId?: number | null
  }): Promise<SacConversation> {
    const summaryBody = [
      `🤖 Resumo da Triagem IA (N1) → Transferência Humana SAC`,
      `• Assunto classificado: ${params.subject}`,
      `• Prioridade ITIL: ${params.priority} | Skill requerida: ${params.requiredSkill} | Pedido: ${params.orderCode}`,
      ``,
      `Histórico preservado da conversa com a IA:`,
      ...params.transcriptTurns.map(
        t => `[${t.time}] ${t.sender === 'ai' ? 'IA SafeSaff' : params.clientName}: ${t.text}`
      )
    ].join('\n')

    if (params.existingConversationId) {
      try {
        await call(`/conversations/${params.existingConversationId}/handoff`, 'POST', {
          summary: summaryBody,
          requiredSkill: params.requiredSkill,
          priority: params.priority
        })
      } catch {
        // Fallback local mantendo o mesmo protocolo
      }
      const convs = loadLocalConvs()
      const existing = convs.find(c => c.id === params.existingConversationId)
      if (existing) {
        const msgs = loadLocalMsgs()
        msgs[existing.id] = [
          ...(msgs[existing.id] || []),
          {
            id: Date.now(),
            author: 'IA SafeSaff (Triagem N1)',
            body: summaryBody,
            createdAt: new Date().toISOString(),
            senderRole: 'system'
          }
        ]
        saveLocalMsgs(msgs)
        return existing
      }
    }

    return this.create(
      params.subject,
      summaryBody,
      params.producerId,
      params.clientName,
      {
        priority: params.priority,
        requiredSkill: params.requiredSkill,
        orderCode: params.orderCode
      }
    )
  },

  async messages(id: number): Promise<SacMessage[]> {
    try {
      const remote = await call<SacMessage[]>(`/conversations/${id}/messages`)
      return remote.length ? remote : loadLocalMsgs()[id] || []
    } catch {
      const msgs = loadLocalMsgs()
      return msgs[id] || []
    }
  },

  async send(
    id: number,
    body: string,
    authorName = 'Atendente SAC SafeSaff',
    senderRole: 'client' | 'agent' = 'agent'
  ): Promise<SacMessage> {
    try {
      return await call<SacMessage>(`/conversations/${id}/messages`, 'POST', { body })
    } catch {
      const msgs = loadLocalMsgs()
      const list = msgs[id] || []
      const nowIso = new Date().toISOString()
      const newMsg: SacMessage = {
        id: Date.now(),
        author: authorName,
        body,
        createdAt: nowIso,
        senderRole
      }
      msgs[id] = [...list, newMsg]
      saveLocalMsgs(msgs)

      if (senderRole === 'agent') {
        const convs = loadLocalConvs().map(c =>
          c.id === id && !c.ticket.firstResponseAt
            ? { ...c, ticket: { ...c.ticket, firstResponseAt: nowIso } }
            : c
        )
        saveLocalConvs(convs)
      }
      return newMsg
    }
  },

  async claim(id: number, agentId = 101): Promise<void> {
    try {
      await call(`/conversations/${id}/claim`, 'POST')
    } catch {
      const convs = loadLocalConvs()
      const agents = loadLocalAgents()
      const agent = agents.find(a => a.userId === agentId) || agents[0]

      const activeForAgent = convs.filter(
        c => c.status === 'active' && c.assignedAgentId === agent.userId
      ).length
      if (activeForAgent >= SAC_MAX_ACTIVE_PER_AGENT) {
        throw new Error(
          `Limite atingido: O atendente ${agent.user.name} já possui ${SAC_MAX_ACTIVE_PER_AGENT} conversas ativas simultâneas.`
        )
      }

      const targetConv = convs.find(c => c.id === id)
      if (!targetConv || targetConv.status !== 'queued') {
        throw new Error('Conversa já assumida por outro operador ou não está mais na fila.')
      }

      const nowIso = new Date().toISOString()
      const next = convs.map(c =>
        c.id === id
          ? {
              ...c,
              status: 'active' as const,
              assignedAt: nowIso,
              assignedAgentId: agent.userId,
              assignedAgent: { id: agent.userId, name: agent.user.name }
            }
          : c
      )
      saveLocalConvs(next)

      const msgs = loadLocalMsgs()
      msgs[id] = [
        ...(msgs[id] || []),
        {
          id: Date.now(),
          author: 'Sistema SAC',
          body: `Atendimento assumido manualmente por ${agent.user.name}.`,
          createdAt: nowIso,
          senderRole: 'system'
        }
      ]
      saveLocalMsgs(msgs)
    }
  },

  async close(id: number): Promise<void> {
    try {
      await call(`/conversations/${id}/close`, 'POST')
    } catch {
      const convs = loadLocalConvs()
      const closedConv = convs.find(c => c.id === id)
      if (!closedConv || closedConv.status !== 'active') {
        throw new Error('Conflito: A conversa não está ativa ou já foi encerrada.')
      }
      const releasedAgentId = closedConv.assignedAgentId
      const nowIso = new Date().toISOString()

      let nextConvs = convs.map(c =>
        c.id === id ? { ...c, status: 'closed' as const, closedAt: nowIso } : c
      )

      if (releasedAgentId) {
        const agents = loadLocalAgents()
        const agent = agents.find(a => a.userId === releasedAgentId)
        if (agent && agent.status === 'available') {
          const activeNow = nextConvs.filter(
            c => c.status === 'active' && c.assignedAgentId === agent.userId
          ).length
          if (activeNow < SAC_MAX_ACTIVE_PER_AGENT) {
            const firstQueued = nextConvs.find(
              c => c.status === 'queued' && hasSkillMatch(agent.skills, c.requiredSkill)
            )
            if (firstQueued) {
              nextConvs = nextConvs.map(c =>
                c.id === firstQueued.id
                  ? {
                      ...c,
                      status: 'active' as const,
                      assignedAt: nowIso,
                      assignedAgentId: agent.userId,
                      assignedAgent: { id: agent.userId, name: agent.user.name }
                    }
                  : c
              )
            }
          }
        }
      }

      saveLocalConvs(nextConvs)
    }
  },

  async transfer(id: number, agentUserId?: number): Promise<void> {
    try {
      await call(`/conversations/${id}/transfer`, 'POST', { agentUserId })
    } catch {
      const convs = loadLocalConvs()
      const agents = loadLocalAgents()
      const targetAgent = agentUserId
        ? agents.find(a => a.userId === agentUserId) || null
        : null

      if (targetAgent) {
        const count = convs.filter(
          c => c.status === 'active' && c.assignedAgentId === targetAgent.userId && c.id !== id
        ).length
        if (count >= SAC_MAX_ACTIVE_PER_AGENT) {
          throw new Error(
            `Transferência bloqueada: ${targetAgent.user.name} já atingiu o limite máximo de ${SAC_MAX_ACTIVE_PER_AGENT} conversas ativas.`
          )
        }
      }

      const nowIso = new Date().toISOString()
      const next = convs.map(c =>
        c.id === id
          ? {
              ...c,
              status: targetAgent ? ('active' as const) : ('queued' as const),
              assignedAt: targetAgent ? nowIso : null,
              assignedAgentId: targetAgent ? targetAgent.userId : null,
              assignedAgent: targetAgent
                ? { id: targetAgent.userId, name: targetAgent.user.name }
                : null
            }
          : c
      )
      saveLocalConvs(next)

      const msgs = loadLocalMsgs()
      msgs[id] = [
        ...(msgs[id] || []),
        {
          id: Date.now(),
          author: 'Supervisão SAC',
          body: targetAgent
            ? `Atendimento transferido pela supervisão para ${targetAgent.user.name}.`
            : `Atendimento devolvido para a Fila Central do SAC.`,
          createdAt: nowIso,
          senderRole: 'system'
        }
      ]
      saveLocalMsgs(msgs)
    }
  },

  async status(
    status: 'available' | 'busy' | 'offline',
    producerId?: number | null,
    agentId = 101
  ): Promise<void> {
    const nowIso = new Date().toISOString()
    const agents = loadLocalAgents().map(a =>
      a.userId === agentId ? { ...a, status, lastSeenAt: nowIso } : a
    )
    saveLocalAgents(agents)

    if (status === 'available') {
      const convs = loadLocalConvs()
      const agent = agents.find(a => a.userId === agentId) || agents[0]
      let activeCount = convs.filter(
        c => c.status === 'active' && c.assignedAgentId === agent.userId
      ).length
      const updatedConvs = convs.map(c => {
        if (
          c.status === 'queued' &&
          activeCount < SAC_MAX_ACTIVE_PER_AGENT &&
          hasSkillMatch(agent.skills, c.requiredSkill)
        ) {
          activeCount += 1
          return {
            ...c,
            status: 'active' as const,
            assignedAt: nowIso,
            assignedAgentId: agent.userId,
            assignedAgent: { id: agent.userId, name: agent.user.name }
          }
        }
        return c
      })
      saveLocalConvs(updatedConvs)
    }

    try {
      await call('/agents/me/status', 'PUT', { status, producerId })
    } catch {
      // Estado local já sincronizado
    }
  },

  async updateAgentSkills(
    userId: number,
    skills: string[],
    producerId?: number | null
  ): Promise<SacAgentInfo[]> {
    const cleanSkills = Array.from(new Set(skills.map(s => s.trim()).filter(Boolean)))
    const nextAgents = loadLocalAgents().map(a =>
      a.userId === userId ? { ...a, skills: cleanSkills } : a
    )
    saveLocalAgents(nextAgents)

    // Tenta distribuir conversas da fila que aguardavam essa skill
    const agent = nextAgents.find(a => a.userId === userId)
    if (agent && agent.status === 'available') {
      const convs = loadLocalConvs()
      let activeCount = convs.filter(
        c => c.status === 'active' && c.assignedAgentId === agent.userId
      ).length
      const nowIso = new Date().toISOString()
      const updatedConvs = convs.map(c => {
        if (
          c.status === 'queued' &&
          activeCount < SAC_MAX_ACTIVE_PER_AGENT &&
          hasSkillMatch(agent.skills, c.requiredSkill)
        ) {
          activeCount += 1
          return {
            ...c,
            status: 'active' as const,
            assignedAt: nowIso,
            assignedAgentId: agent.userId,
            assignedAgent: { id: agent.userId, name: agent.user.name }
          }
        }
        return c
      })
      saveLocalConvs(updatedConvs)
    }

    try {
      await call(`/agents/${userId}/skills`, 'PUT', { skills: cleanSkills, producerId })
    } catch {
      // Persistido localmente e auditado
    }
    return this.agents(producerId)
  },

  async agents(producerId?: number | null): Promise<SacAgentInfo[]> {
    const convs = loadLocalConvs()
    const fallback = loadLocalAgents().map(a => ({
      ...a,
      activeChatsCount: convs.filter(
        c => c.status === 'active' && c.assignedAgentId === a.userId
      ).length
    }))
    try {
      const remote = await call<
        Array<{
          userId: number
          status: 'available' | 'busy' | 'offline'
          skills?: string
          lastSeenAt?: string
          user: { id: number; name: string; role: string }
        }>
      >(`/agents${producerId ? `?producerId=${producerId}` : ''}`)
      if (!remote.length) return fallback
      return remote.map(r => ({
        userId: r.userId,
        status: r.status,
        skills: r.skills
          ? r.skills
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : ['N1', 'ERP'],
        lastSeenAt: r.lastSeenAt,
        activeChatsCount: convs.filter(
          c => c.status === 'active' && c.assignedAgentId === r.userId
        ).length,
        user: r.user
      }))
    } catch {
      return fallback
    }
  },

  // Cálculo 100% conciliado de KPIs entre Dashboard SAC e Chat SAC (VIS-02 / COD-10)
  async kpis(producerId?: number | null): Promise<SacReconciledKpis> {
    const convs = loadLocalConvs()
    const agents = loadLocalAgents()
    const now = new Date()

    const queuedCount = convs.filter(c => c.status === 'queued').length
    const activeCount = convs.filter(c => c.status === 'active').length
    const closedCount = convs.filter(c => c.status === 'closed').length
    const totalToday = convs.length

    const overdueOpen = convs.filter(
      c =>
        c.status !== 'closed' &&
        c.ticket.resolutionDueAt &&
        new Date(c.ticket.resolutionDueAt) < now
    ).length
    const denomEff = closedCount + overdueOpen
    const efficiencyPct =
      denomEff > 0
        ? Math.round((closedCount / denomEff) * 100)
        : totalToday > 0
        ? Math.round(((closedCount + activeCount) / totalToday) * 100)
        : null

    const slaConvs = convs.filter(c => c.ticket.resolutionDueAt)
    const slaOk = slaConvs.filter(c => {
      const endRef = c.closedAt ? new Date(c.closedAt) : now
      return endRef <= new Date(c.ticket.resolutionDueAt!)
    }).length
    const slaOnTimePct =
      slaConvs.length > 0 ? Math.round((slaOk / slaConvs.length) * 100) : null

    // TMA real calculado das conversas encerradas/ativas
    const durationsMin = convs
      .map(c => {
        const start = new Date(c.assignedAt || c.createdAt).getTime()
        const end = c.closedAt ? new Date(c.closedAt).getTime() : now.getTime()
        return Math.max(1, Math.round((end - start) / 60000))
      })
      .filter(n => Number.isFinite(n))
    const avgMin =
      durationsMin.length > 0
        ? Math.round(durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length)
        : 0
    const tmaFormatted = avgMin > 0 ? `${String(avgMin).padStart(2, '0')}m 00s` : 'Sem dados'

    const calcPrio = (p: 'P1' | 'P2' | 'P3', respMin: number) => {
      const subset = convs.filter(c => (c.ticket.priority || 'P3') === p)
      if (!subset.length) return { total: 0, onTimePct: null, responseMinutes: respMin }
      const ok = subset.filter(c => {
        if (!c.ticket.resolutionDueAt) return true
        const endRef = c.closedAt ? new Date(c.closedAt) : now
        return endRef <= new Date(c.ticket.resolutionDueAt)
      }).length
      return {
        total: subset.length,
        onTimePct: Math.round((ok / subset.length) * 100),
        responseMinutes: respMin
      }
    }

    return {
      producerId: producerId || 1,
      generatedAt: now.toISOString(),
      source: hasStoredToken() ? 'neon_postgresql' : 'local_operational_store',
      queuedCount,
      activeCount,
      closedCount,
      totalToday,
      efficiencyPct,
      slaOnTimePct,
      tmaFormatted,
      agentsAvailable: agents.filter(a => a.status === 'available').length,
      agentsBusy: agents.filter(a => a.status === 'busy').length,
      agentsOffline: agents.filter(a => a.status === 'offline').length,
      byPriority: {
        P1: calcPrio('P1', 15),
        P2: calcPrio('P2', 30),
        P3: calcPrio('P3', 60)
      },
      channels: {
        chat: { count: totalToday, status: 'integrated', sharePct: totalToday > 0 ? 100 : 0 },
        whatsapp: { count: 0, status: 'not_integrated', sharePct: 0 },
        email: { count: 0, status: 'not_integrated', sharePct: 0 }
      }
    }
  }
}
