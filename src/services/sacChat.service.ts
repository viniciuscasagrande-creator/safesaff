import { getApiBaseUrl, getAuthHeader } from './api'

const base = `${getApiBaseUrl()}/sac/chat`
const LOCAL_CONVS_KEY = 'safesaff_sac_chat_convs_v1'
const LOCAL_MSGS_KEY = 'safesaff_sac_chat_msgs_v1'
const LOCAL_AGENTS_KEY = 'safesaff_sac_chat_agents_v1'
const SAC_MAX_ACTIVE_PER_AGENT = 3

export interface SacConversation {
  id: number
  producerId: number
  clientUserId: number
  assignedAgentId: number | null
  status: 'queued' | 'active' | 'closed'
  createdAt: string
  ticket: {
    code: string
    subject: string
    requesterName: string
    requesterEmail?: string
    orderCode?: string
    eventName?: string
  }
  assignedAgent?: { id: number; name: string } | null
}

export interface SacMessage {
  id: number
  author: string
  body: string
  createdAt: string
  senderRole?: 'client' | 'agent' | 'system'
}

export interface SacList {
  rows: SacConversation[]
  staff: boolean
  supervisor: boolean
  limit: number
}

export interface SacAgentInfo {
  userId: number
  status: 'available' | 'busy' | 'offline'
  activeChatsCount?: number
  user: { name: string }
}

const DEFAULT_AGENTS: SacAgentInfo[] = [
  { userId: 101, status: 'available', user: { name: 'Ana Paula (SAC Nível 1)' } },
  { userId: 102, status: 'available', user: { name: 'Marcos Vinícius (SAC Nível 2)' } },
  { userId: 103, status: 'busy', user: { name: 'Carla Mendes (Supervisora SAC)' } }
]

const DEFAULT_CONVERSATIONS: SacConversation[] = [
  {
    id: 1,
    producerId: 1,
    clientUserId: 501,
    assignedAgentId: null,
    status: 'queued',
    createdAt: new Date(Date.now() - 8 * 60000).toISOString(),
    ticket: {
      code: 'SAC-000125',
      subject: 'Dúvida sobre transferência de titularidade de ingresso',
      requesterName: 'Lucas Fernandes Pereira',
      requesterEmail: 'lucas.pereira@email.com',
      orderCode: 'ORD-928371',
      eventName: 'Whindersson Nunes - SESSÃO EXTRA 19H'
    },
    assignedAgent: null
  },
  {
    id: 2,
    producerId: 1,
    clientUserId: 502,
    assignedAgentId: null,
    status: 'queued',
    createdAt: new Date(Date.now() - 4 * 60000).toISOString(),
    ticket: {
      code: 'SAC-000126',
      subject: 'Solicitação de 2ª via de QR Code para entrada hoje',
      requesterName: 'Mariana Costa Ribeiro',
      requesterEmail: 'mariana.costa@email.com.br',
      orderCode: 'ORD-928419',
      eventName: 'Festival Sinfônico de Inverno 2026'
    },
    assignedAgent: null
  },
  {
    id: 3,
    producerId: 1,
    clientUserId: 503,
    assignedAgentId: 101,
    status: 'active',
    createdAt: new Date(Date.now() - 19 * 60000).toISOString(),
    ticket: {
      code: 'SAC-000124',
      subject: 'Comprovante PIX e liberação de assento na Plateia VIP',
      requesterName: 'Roberto Almeida Prado',
      requesterEmail: 'roberto.prado@empresa.com.br',
      orderCode: 'ORD-928104',
      eventName: 'MARCOS & BELUTTI • Tour 18 Anos'
    },
    assignedAgent: { id: 101, name: 'Ana Paula (SAC Nível 1)' }
  }
]

const DEFAULT_MESSAGES: Record<number, SacMessage[]> = {
  1: [
    {
      id: 1001,
      author: 'Lucas Fernandes Pereira',
      body: 'Olá! Comprei 2 ingressos para a sessão extra das 19h e preciso transferir 1 ingresso para o CPF da minha esposa. Podem me orientar?',
      createdAt: new Date(Date.now() - 8 * 60000).toISOString(),
      senderRole: 'client'
    }
  ],
  2: [
    {
      id: 2001,
      author: 'Mariana Costa Ribeiro',
      body: 'Boa tarde! Meu aplicativo atualizou e quero confirmar se meu QR Code do pedido ORD-928419 continua válido na catraca.',
      createdAt: new Date(Date.now() - 4 * 60000).toISOString(),
      senderRole: 'client'
    }
  ],
  3: [
    {
      id: 3001,
      author: 'Roberto Almeida Prado',
      body: 'Olá, realizei o pagamento via PIX há 5 minutos para os assentos A05 e A06. Já consta confirmado?',
      createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
      senderRole: 'client'
    },
    {
      id: 3002,
      author: 'Ana Paula (SAC Nível 1)',
      body: 'Olá Roberto! Seja bem-vindo ao SAC SafeSaff. Já localizei seu pedido ORD-928104 aqui no ERP e seus 2 ingressos já estão emitidos e ativos para entrada!',
      createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
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
    return JSON.parse(raw)
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
    return JSON.parse(raw)
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

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('FALLBACK_LOCAL_SAC')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Erro no Chat SAC')
  return data as T
}

export const sacChatApi = {
  async list(producerId?: number | null): Promise<SacList> {
    try {
      return await call<SacList>(`/conversations${producerId ? `?producerId=${producerId}` : ''}`)
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
    requesterName = 'Cliente Autenticado ERP'
  ): Promise<SacConversation> {
    try {
      return await call<SacConversation>('/conversations', 'POST', {
        subject,
        message,
        producerId
      })
    } catch {
      const convs = loadLocalConvs()
      const agents = loadLocalAgents()
      const msgs = loadLocalMsgs()

      // Regra de Distribuição Automática: procura atendente 'available' com < 3 conversas ativas
      const availableCandidates = agents
        .filter(a => a.status === 'available')
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
      const code = `SAC-${String(120 + newId).padStart(6, '0')}`
      const nowIso = new Date().toISOString()

      const created: SacConversation = {
        id: newId,
        producerId: producerId || 1,
        clientUserId: 599,
        assignedAgentId: chosen ? chosen.userId : null,
        status: chosen ? 'active' : 'queued',
        createdAt: nowIso,
        ticket: {
          code,
          subject,
          requesterName,
          requesterEmail: 'cliente@safesaff.com.br',
          orderCode: 'ORD-928500',
          eventName: 'Whindersson Nunes - SESSÃO EXTRA 19H'
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
          body: `Atendimento ${code} distribuído automaticamente para ${chosen.user.name} (carga dentro do limite de ${SAC_MAX_ACTIVE_PER_AGENT} chats simultâneos).`,
          createdAt: nowIso,
          senderRole: 'system'
        })
      } else {
        initialMessages.push({
          id: Date.now() + 1,
          author: 'Fila Central SAC',
          body: `Protocolo ${code} registrado. Todos os atendentes atingiram o limite de ${SAC_MAX_ACTIVE_PER_AGENT} conversas ou estão ocupados. Aguardando na fila prioritária.`,
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

  async messages(id: number): Promise<SacMessage[]> {
    try {
      return await call<SacMessage[]>(`/conversations/${id}/messages`)
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
      const newMsg: SacMessage = {
        id: Date.now(),
        author: authorName,
        body,
        createdAt: new Date().toISOString(),
        senderRole
      }
      msgs[id] = [...list, newMsg]
      saveLocalMsgs(msgs)
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

      const next = convs.map(c =>
        c.id === id
          ? {
              ...c,
              status: 'active' as const,
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
          createdAt: new Date().toISOString(),
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
      const releasedAgentId = closedConv?.assignedAgentId

      let nextConvs = convs.map(c =>
        c.id === id ? { ...c, status: 'closed' as const } : c
      )

      // Ao fechar uma conversa, verifica se há alguém na fila para distribuir automaticamente ao atendente que liberou vaga
      if (releasedAgentId) {
        const agents = loadLocalAgents()
        const agent = agents.find(a => a.userId === releasedAgentId)
        if (agent && agent.status === 'available') {
          const activeNow = nextConvs.filter(
            c => c.status === 'active' && c.assignedAgentId === agent.userId
          ).length
          if (activeNow < SAC_MAX_ACTIVE_PER_AGENT) {
            const firstQueued = nextConvs.find(c => c.status === 'queued')
            if (firstQueued) {
              nextConvs = nextConvs.map(c =>
                c.id === firstQueued.id
                  ? {
                      ...c,
                      status: 'active' as const,
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

      const next = convs.map(c =>
        c.id === id
          ? {
              ...c,
              status: targetAgent ? ('active' as const) : ('queued' as const),
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
          createdAt: new Date().toISOString(),
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
    try {
      await call('/agents/me/status', 'PUT', { status, producerId })
    } catch {
      const agents = loadLocalAgents().map(a =>
        a.userId === agentId ? { ...a, status } : a
      )
      saveLocalAgents(agents)

      // Se o atendente ficou 'available', puxa da fila automaticamente até o limite de 3
      if (status === 'available') {
        const convs = loadLocalConvs()
        const agent = agents.find(a => a.userId === agentId) || agents[0]
        let activeCount = convs.filter(
          c => c.status === 'active' && c.assignedAgentId === agent.userId
        ).length
        const updatedConvs = convs.map(c => {
          if (c.status === 'queued' && activeCount < SAC_MAX_ACTIVE_PER_AGENT) {
            activeCount += 1
            return {
              ...c,
              status: 'active' as const,
              assignedAgentId: agent.userId,
              assignedAgent: { id: agent.userId, name: agent.user.name }
            }
          }
          return c
        })
        saveLocalConvs(updatedConvs)
      }
    }
  },

  async agents(producerId?: number | null): Promise<SacAgentInfo[]> {
    try {
      return await call<SacAgentInfo[]>(
        `/agents${producerId ? `?producerId=${producerId}` : ''}`
      )
    } catch {
      const convs = loadLocalConvs()
      return loadLocalAgents().map(a => ({
        ...a,
        activeChatsCount: convs.filter(
          c => c.status === 'active' && c.assignedAgentId === a.userId
        ).length
      }))
    }
  }
}
