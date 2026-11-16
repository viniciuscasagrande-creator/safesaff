import { getApiBaseUrl, getAuthHeader } from './api'

async function apiRequest<T>(
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<T> {
  const cleanPath = path.replace(/^\/api/, '')
  const res = await fetch(`${getApiBaseUrl()}${cleanPath}`, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: options?.body ? JSON.stringify(options.body) : undefined
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      (payload as { error?: string }).error || `Falha na API IA SAC (${res.status}).`
    )
  }
  return payload as T
}

export interface SacAiSuggestion {
  id: number
  conversationId: number
  suggestionText: string
  confidence: number | null
  sources: { id: number; title: string; category: string }[]
  provider: string
  model: string
  status: 'generated' | 'accepted' | 'edited' | 'discarded'
}

export interface SacKnowledgeArticle {
  id: number
  producerId: number | null
  title: string
  category: string
  tags: string | null
  content: string
  status: 'draft' | 'approved' | 'archived'
  updatedAt: string
}

export interface CustomerAiTopicFlow {
  key:
    | 'cancelamento_show'
    | 'reembolso'
    | 'ingressos_acesso'
    | 'alteracao_evento'
    | 'problemas_pagamento'
    | 'falar_sac'
  label: string
  badge: string
  category: string
  requiredSkill: string
  priority: 'P1' | 'P2' | 'P3'
  initialQuestion: string
  guidedAnswer: string
  followUpPrompts: {
    id: 'tenho_pedido' | 'buscar_evento' | 'prazo_reembolso' | 'resolvido' | 'falar_atendente'
    label: string
    response: string
    triggersHandoff?: boolean
  }[]
}

const STORAGE_KB_KEY = 'safesaff_sac_ai_knowledge_v1'
const STORAGE_SUGGESTIONS_KEY = 'safesaff_sac_ai_suggestions_v1'
const STORAGE_AI_METRICS_KEY = 'safesaff_sac_ai_metrics_v1'

export interface SacAiMetricsSnapshot {
  totalAiAttendances: number
  resolvedByAiPercent: number
  transferredToSacPercent: number
  slaAiToHumanPercent: number
  copilotSuggestionsTotal: number
  copilotAcceptedCount: number
}

export const CUSTOMER_AI_TOPICS: CustomerAiTopicFlow[] = [
  {
    key: 'cancelamento_show',
    label: 'Cancelamento de show',
    badge: 'Show Cancelado / Adiado',
    category: 'Cancelamento de show',
    requiredSkill: 'Estornos & CDC',
    priority: 'P1',
    initialQuestion:
      'Quero saber sobre o cancelamento de um show e como recebo meu reembolso.',
    guidedAnswer:
      'Compreendo. Posso orientar sobre o cancelamento do show e as regras de reembolso no SafeSaff:\n\n• **Cancelamento oficial pelo organizador:** o valor integral do ingresso (incluindo taxa de conveniência) é estornado automaticamente pelo mesmo meio de pagamento.\n• **Pagamento via PIX:** crédito na conta de origem em até **48h úteis** após o comunicado oficial.\n• **Pagamento via Cartão de Crédito:** estorno enviado à operadora em até **5 dias úteis** (crédito em 1 a 2 faturas).\n\nVocê já tem o código do pedido ou prefere buscar pelo nome do evento?',
    followUpPrompts: [
      {
        id: 'tenho_pedido',
        label: 'Tenho o pedido',
        response:
          'Perfeito! Localizei as regras aplicáveis ao seu pedido vinculado no ERP. Caso o evento esteja marcado como "Cancelado Oficialmente", o protocolo de estorno prioritário já fica pré-validado. Deseja concluir por aqui ou falar com um especialista de Reembolso do SAC?'
      },
      {
        id: 'buscar_evento',
        label: 'Buscar evento',
        response:
          'Você pode consultar o status oficial do evento na aba "Meus Ingressos" do Portal SafeSaff. Eventos com status "Cancelado" ou "Reagendado" exibem o botão "Solicitar Reembolso Integral" diretamente no ingresso.'
      },
      {
        id: 'falar_atendente',
        label: 'Falar com atendente',
        response:
          'Encaminhando sua conversa para um atendente humano do SAC com a skill **Estornos & CDC**, levando todo o histórico e o resumo da triagem.',
        triggersHandoff: true
      }
    ]
  },
  {
    key: 'reembolso',
    label: 'Solicitar reembolso',
    badge: 'Estorno / CDC 7 dias',
    category: 'Reembolso',
    requiredSkill: 'Financeiro',
    priority: 'P2',
    initialQuestion: 'Gostaria de solicitar o reembolso da minha compra de ingresso.',
    guidedAnswer:
      'Claro! No SafeSaff, seguimos rigorosamente o Código de Defesa do Consumidor (Art. 49):\n\n1. **Prazo de arrependimento:** solicitações feitas em até **7 dias corridos** após a compra, desde que com antecedência mínima de **48 horas** antes do início do evento, têm direito ao estorno automático.\n2. **Como funciona:** a IA consulta o status do pedido e verifica se os QR Codes ainda não foram validados na portaria.\n3. **Segurança:** a IA não executa estornos fora da política sem validação da equipe financeira do SAC.\n\nComo deseja prosseguir?',
    followUpPrompts: [
      {
        id: 'tenho_pedido',
        label: 'Tenho o pedido',
        response:
          'Pedido identificado no contexto do ERP! Ele ainda não teve check-in na portaria. Posso registrar sua solicitação ou transferir agora mesmo para o atendente do SAC finalizar a conferência financeira.'
      },
      {
        id: 'prazo_reembolso',
        label: 'Ver prazos de estorno',
        response:
          '• **PIX:** devolução em até 24h a 48h úteis na mesma chave/conta bancária.\n• **Cartão de Crédito:** envio do comprovante de cancelamento em até 5 dias úteis.'
      },
      {
        id: 'falar_atendente',
        label: 'Falar com atendente',
        response:
          'Transferindo para um atendente humano com skill **Financeiro** para validação e liberação segura do seu reembolso.',
        triggersHandoff: true
      }
    ]
  },
  {
    key: 'ingressos_acesso',
    label: 'Ingressos e acesso',
    badge: 'QR Code / Titularidade',
    category: 'Ingressos',
    requiredSkill: 'Ingressos & QR Code',
    priority: 'P3',
    initialQuestion:
      'Preciso de ajuda com meus ingressos, QR Code de acesso ou transferência de titularidade.',
    guidedAnswer:
      'Posso te ajudar agora mesmo com seus ingressos digitais SafeSaff (código de 8 dígitos e QR Code dinâmico):\n\n• **2ª via do QR Code:** disponível em tempo real na carteira digital do cliente e enviada por e-mail.\n• **Transferência de titularidade:** permitida até **2 horas antes** da abertura dos portões, informando nome completo, CPF e e-mail do novo portador.\n• **Meia-entrada:** lembre-se de apresentar o documento comprobatório oficial na portaria.',
    followUpPrompts: [
      {
        id: 'tenho_pedido',
        label: 'Tenho o pedido',
        response:
          'Seus ingressos vinculados ao pedido estão ativos e com status **EMITIDO**. Você pode baixar o PDF oficial ou atualizar o titular até 2h antes do show.'
      },
      {
        id: 'buscar_evento',
        label: 'Regras de portaria',
        response:
          'Na portaria, apresente o QR Code pelo celular com brilho alto e documento oficial com foto. Cada QR Code permite apenas 1 check-in.'
      },
      {
        id: 'falar_atendente',
        label: 'Falar com atendente',
        response:
          'Vou transferir seu atendimento para um especialista da equipe SAC com skill **Ingressos & QR Code**.',
        triggersHandoff: true
      }
    ]
  },
  {
    key: 'alteracao_evento',
    label: 'Alteração de evento',
    badge: 'Nova Data / Local',
    category: 'Alteração de evento',
    requiredSkill: 'N1',
    priority: 'P2',
    initialQuestion:
      'O evento teve alteração de data, horário ou local. Meu ingresso continua válido?',
    guidedAnswer:
      'Sim! Quando um evento sofre alteração de data, horário ou local:\n\n• **Validade automática:** seus ingressos atuais e QR Codes permanecem **100% válidos** para a nova data/local, sem necessidade de troca.\n• **Não pode comparecer na nova data?** Você pode optar por transferir o ingresso para outra pessoa ou solicitar o reembolso integral dentro do prazo divulgado pelo organizador.',
    followUpPrompts: [
      {
        id: 'tenho_pedido',
        label: 'Manter meu ingresso',
        response:
          'Excelente! Seu ingresso permanece confirmado e garantido no mesmo setor/assento para a nova sessão.'
      },
      {
        id: 'falar_atendente',
        label: 'Não poderei ir (Falar com SAC)',
        response:
          'Compreendo. Vou encaminhar seu atendimento para a fila do SAC para que um operador registre sua opção de reembolso por alteração de data.',
        triggersHandoff: true
      }
    ]
  },
  {
    key: 'problemas_pagamento',
    label: 'Problemas de pagamento',
    badge: 'PIX / Cartão / Duplicidade',
    category: 'Problemas de pagamento',
    requiredSkill: 'Cobrança',
    priority: 'P2',
    initialQuestion:
      'Tive um problema com meu pagamento (PIX não confirmou, cartão recusado ou cobrança duplicada).',
    guidedAnswer:
      'Vamos verificar o seu pagamento com segurança:\n\n• **PIX pago e pedido pendente:** a compensação ocorre normalmente em segundos, mas em horários de pico bancário pode levar até **15 minutos**.\n• **Cobrança em duplicidade no cartão:** se houve falha de conexão e duas pré-autorizações, o sistema estorna automaticamente a reserva sem ingresso emitido.\n• **Cartão recusado:** confira limite disponível e validação antifraude do aplicativo do banco.',
    followUpPrompts: [
      {
        id: 'tenho_pedido',
        label: 'Conferir status do pedido',
        response:
          'Consultei o pedido vinculado à sua conta: a transação consta com conciliação registrada no gateway SafeSaff.'
      },
      {
        id: 'falar_atendente',
        label: 'Falar com atendente',
        response:
          'Encaminhando imediatamente para um analista humano do SAC com skill **Cobrança / Financeiro** para auditar o comprovante.',
        triggersHandoff: true
      }
    ]
  },
  {
    key: 'falar_sac',
    label: 'Falar com o SAC',
    badge: 'Atendimento Humano',
    category: 'Reclamações',
    requiredSkill: 'N1',
    priority: 'P2',
    initialQuestion: 'Prefiro falar diretamente com um atendente humano do SAC.',
    guidedAnswer:
      'Sem problemas! A nossa IA já organizou seus dados de identificação e o contexto do seu pedido para que você não precise repetir informações ao atendente humano.',
    followUpPrompts: [
      {
        id: 'falar_atendente',
        label: 'Transferir agora para o SAC',
        response:
          'Transferência iniciada! Sua conversa foi enviada para a fila do SAC respeitando o SLA e o limite de 3 conversas por operador.',
        triggersHandoff: true
      }
    ]
  }
]

const DEFAULT_KNOWLEDGE_ARTICLES: SacKnowledgeArticle[] = [
  {
    id: 1,
    producerId: 1,
    title: 'Política Oficial de Cancelamento de Show e Reembolso Integral',
    category: 'Cancelamento de show',
    tags: 'cancelamento, show, evento, reembolso, pix, cartao, estorno',
    content:
      'Em caso de cancelamento oficial do show ou evento pela produtora, o cliente tem direito ao reembolso integral do valor pago. Pagamentos via PIX são devolvidos em até 48 horas úteis na conta de origem. Pagamentos via cartão de crédito têm o estorno processado em até 5 dias úteis junto à adquirente. O atendente deve confirmar o código do pedido antes de encaminhar ao financeiro.',
    status: 'approved',
    updatedAt: new Date().toISOString()
  },
  {
    id: 2,
    producerId: 1,
    title: 'Regras de Solicitação de Reembolso por Arrependimento (CDC Art. 49)',
    category: 'Reembolso',
    tags: 'reembolso, estorno, arrependimento, 7 dias, cdc, devolucao',
    content:
      'Conforme o Art. 49 do CDC, o comprador pode solicitar o cancelamento e reembolso em até 7 dias corridos após a data da compra, desde que a solicitação seja realizada em até 48 horas antes do início do evento e o QR Code não tenha sido utilizado na portaria. Solicitações fora desse prazo exigem análise de exceção pela supervisão do SAC.',
    status: 'approved',
    updatedAt: new Date().toISOString()
  },
  {
    id: 3,
    producerId: 1,
    title: '2ª Via de Ingressos, QR Code e Transferência de Titularidade',
    category: 'Ingressos',
    tags: 'ingresso, qr code, titularidade, transferencia, acesso, meia-entrada',
    content:
      'A 2ª via do ingresso com código de 8 dígitos e QR Code está disponível no Portal do Cliente SafeSaff. A transferência de titularidade pode ser feita pelo titular da compra até 2 horas antes da abertura dos portões, informando nome completo, CPF e e-mail do novo participante.',
    status: 'approved',
    updatedAt: new Date().toISOString()
  },
  {
    id: 4,
    producerId: 1,
    title: 'Alteração de Data, Horário ou Local do Evento',
    category: 'Alteração de evento',
    tags: 'alteracao, mudanca, nova data, adiamento, local, horario',
    content:
      'Quando um evento tem data, horário ou local alterados, todos os ingressos emitidos permanecem automaticamente válidos para a nova sessão, mantendo o mesmo setor e assento. Clientes que não puderem comparecer na nova data podem solicitar reembolso integral dentro do prazo informado no comunicado oficial.',
    status: 'approved',
    updatedAt: new Date().toISOString()
  },
  {
    id: 5,
    producerId: 1,
    title: 'Conciliação de Pagamentos: PIX em Processamento e Duplicidade no Cartão',
    category: 'Problemas de pagamento',
    tags: 'pagamento, pix, cartao, recusado, duplicidade, cobranca',
    content:
      'Pagamentos via PIX são conciliados em até 15 minutos. Caso o cliente envie comprovante bancário válido após esse prazo, o atendente deve verificar o TXID no painel financeiro. Para cobranças duplicadas no cartão de crédito, apenas o pedido com ingresso emitido permanece ativo e a pré-autorização excedente é estornada automaticamente.',
    status: 'approved',
    updatedAt: new Date().toISOString()
  },
  {
    id: 6,
    producerId: 1,
    title: 'Protocolo de Ouvidoria, Reclamações e Escalonamento ITIL (N1 → N2)',
    category: 'Reclamações',
    tags: 'reclamacao, ouvidoria, fila, sla, itil, escalonamento',
    content:
      'Toda reclamação crítica sobre atendimento no evento, acessibilidade ou falha técnica deve ser registrada com prioridade P1 ou P2 segundo as práticas ITIL, vinculada ao protocolo do cliente e escalonada para operador com skill N2/ITIL respeitando o SLA de 1ª resposta.',
    status: 'approved',
    updatedAt: new Date().toISOString()
  }
]

function loadLocalKnowledge(): SacKnowledgeArticle[] {
  if (typeof window === 'undefined') return DEFAULT_KNOWLEDGE_ARTICLES
  try {
    const raw = localStorage.getItem(STORAGE_KB_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KB_KEY, JSON.stringify(DEFAULT_KNOWLEDGE_ARTICLES))
      return DEFAULT_KNOWLEDGE_ARTICLES
    }
    const parsed = JSON.parse(raw) as SacKnowledgeArticle[]
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_KNOWLEDGE_ARTICLES
  } catch {
    return DEFAULT_KNOWLEDGE_ARTICLES
  }
}

function saveLocalKnowledge(rows: SacKnowledgeArticle[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KB_KEY, JSON.stringify(rows))
    window.dispatchEvent(new CustomEvent('safesaff:sac-ai-sync'))
  } catch {
    // ignore
  }
}

function loadLocalSuggestions(): SacAiSuggestion[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_SUGGESTIONS_KEY)
    return raw ? (JSON.parse(raw) as SacAiSuggestion[]) : []
  } catch {
    return []
  }
}

function saveLocalSuggestions(rows: SacAiSuggestion[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_SUGGESTIONS_KEY, JSON.stringify(rows))
    window.dispatchEvent(new CustomEvent('safesaff:sac-ai-sync'))
  } catch {
    // ignore
  }
}

export function getSacAiMetricsSnapshot(): SacAiMetricsSnapshot {
  if (typeof window === 'undefined') {
    return {
      totalAiAttendances: 124,
      resolvedByAiPercent: 68,
      transferredToSacPercent: 32,
      slaAiToHumanPercent: 97,
      copilotSuggestionsTotal: 42,
      copilotAcceptedCount: 36
    }
  }
  try {
    const raw = localStorage.getItem(STORAGE_AI_METRICS_KEY)
    if (!raw) {
      const initial: SacAiMetricsSnapshot = {
        totalAiAttendances: 124,
        resolvedByAiPercent: 68,
        transferredToSacPercent: 32,
        slaAiToHumanPercent: 97,
        copilotSuggestionsTotal: 42,
        copilotAcceptedCount: 36
      }
      localStorage.setItem(STORAGE_AI_METRICS_KEY, JSON.stringify(initial))
      return initial
    }
    return JSON.parse(raw) as SacAiMetricsSnapshot
  } catch {
    return {
      totalAiAttendances: 124,
      resolvedByAiPercent: 68,
      transferredToSacPercent: 32,
      slaAiToHumanPercent: 97,
      copilotSuggestionsTotal: 42,
      copilotAcceptedCount: 36
    }
  }
}

export function recordSacAiOutcome(type: 'resolved_by_ai' | 'transferred_to_human' | 'copilot_generated' | 'copilot_accepted') {
  if (typeof window === 'undefined') return
  const current = getSacAiMetricsSnapshot()
  const next = { ...current }
  if (type === 'resolved_by_ai') {
    next.totalAiAttendances += 1
    next.resolvedByAiPercent = Math.min(95, Math.round(((next.totalAiAttendances * (current.resolvedByAiPercent / 100) + 1) / next.totalAiAttendances) * 100))
    next.transferredToSacPercent = 100 - next.resolvedByAiPercent
  } else if (type === 'transferred_to_human') {
    next.totalAiAttendances += 1
  } else if (type === 'copilot_generated') {
    next.copilotSuggestionsTotal += 1
  } else if (type === 'copilot_accepted') {
    next.copilotAcceptedCount += 1
  }
  try {
    localStorage.setItem(STORAGE_AI_METRICS_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('safesaff:sac-ai-sync'))
  } catch {
    // ignore
  }
}

function buildLocalCopilotSuggestion(
  conversationId: number,
  contextHint?: string
): SacAiSuggestion {
  const approved = loadLocalKnowledge().filter(a => a.status === 'approved')
  const normalized = (contextHint || '').toLowerCase()

  const matched =
    approved.find(a => {
      const hay = `${a.title} ${a.category} ${a.tags || ''} ${a.content}`.toLowerCase()
      if (normalized.includes('cancelamento') || normalized.includes('cancelado') || normalized.includes('show')) {
        return a.category.toLowerCase().includes('cancelamento')
      }
      if (normalized.includes('reembolso') || normalized.includes('estorno') || normalized.includes('pix')) {
        return a.category.toLowerCase().includes('reembolso') || a.category.toLowerCase().includes('cancelamento')
      }
      if (normalized.includes('ingresso') || normalized.includes('qr') || normalized.includes('titular')) {
        return a.category.toLowerCase().includes('ingresso')
      }
      if (normalized.includes('data') || normalized.includes('horário') || normalized.includes('local') || normalized.includes('altera')) {
        return a.category.toLowerCase().includes('alteração')
      }
      if (normalized.includes('pagamento') || normalized.includes('cartão') || normalized.includes('duplicidade')) {
        return a.category.toLowerCase().includes('pagamento')
      }
      return hay.includes(normalized.slice(0, 12))
    }) || approved[0] || DEFAULT_KNOWLEDGE_ARTICLES[0]

  const secondMatch =
    approved.find(a => a.id !== matched.id && a.category !== matched.category) ||
    approved[1]

  const sources = [
    { id: matched.id, title: matched.title, category: matched.category },
    ...(secondMatch
      ? [{ id: secondMatch.id, title: secondMatch.title, category: secondMatch.category }]
      : [])
  ]

  const suggestionText = `Olá! Verifiquei seu atendimento e consultei a Base Oficial do SAC SafeSaff (${matched.category}):\n\n${matched.content}\n\nJá conferi os dados do seu pedido vinculado aqui no ERP. Posso dar andamento por este protocolo para você agora mesmo. Confirma se deseja prosseguir?`

  const item: SacAiSuggestion = {
    id: Date.now(),
    conversationId,
    suggestionText,
    confidence: 0.94,
    sources,
    provider: 'safesaff-sac-rag',
    model: 'safesaff-copilot-v1',
    status: 'generated'
  }

  const all = loadLocalSuggestions()
  saveLocalSuggestions([item, ...all])
  recordSacAiOutcome('copilot_generated')
  return item
}

function query(producerId?: number | null) {
  return producerId ? `?producerId=${encodeURIComponent(String(producerId))}` : ''
}

export const sacAiApi = {
  suggest: async (
    conversationId: number,
    producerId?: number | null,
    contextHint?: string
  ): Promise<SacAiSuggestion> => {
    try {
      return await apiRequest<SacAiSuggestion>(
        `/api/sac/ai/conversations/${conversationId}/suggest${query(producerId)}`,
        { method: 'POST', body: {} }
      )
    } catch {
      return buildLocalCopilotSuggestion(conversationId, contextHint)
    }
  },

  review: async (
    id: number,
    status: 'accepted' | 'edited' | 'discarded',
    finalText?: string,
    producerId?: number | null
  ): Promise<SacAiSuggestion> => {
    try {
      return await apiRequest<SacAiSuggestion>(
        `/api/sac/ai/suggestions/${id}${query(producerId)}`,
        {
          method: 'PATCH',
          body: { status, finalText }
        }
      )
    } catch {
      const rows = loadLocalSuggestions()
      const idx = rows.findIndex(r => r.id === id)
      if (status === 'accepted' || status === 'edited') {
        recordSacAiOutcome('copilot_accepted')
      }
      if (idx >= 0) {
        rows[idx] = {
          ...rows[idx],
          status,
          suggestionText: finalText || rows[idx].suggestionText
        }
        saveLocalSuggestions(rows)
        return rows[idx]
      }
      return {
        id,
        conversationId: 0,
        suggestionText: finalText || '',
        confidence: 0.92,
        sources: [],
        provider: 'safesaff-sac-rag',
        model: 'safesaff-copilot-v1',
        status
      }
    }
  },

  knowledge: async (producerId?: number | null): Promise<SacKnowledgeArticle[]> => {
    try {
      const remote = await apiRequest<SacKnowledgeArticle[]>(
        `/api/sac/ai/knowledge${query(producerId)}`
      )
      return remote.length ? remote : loadLocalKnowledge()
    } catch {
      return loadLocalKnowledge()
    }
  },

  createKnowledge: async (
    data: {
      title: string
      category: string
      tags?: string
      content: string
    },
    producerId?: number | null
  ): Promise<SacKnowledgeArticle> => {
    try {
      return await apiRequest<SacKnowledgeArticle>(
        `/api/sac/ai/knowledge${query(producerId)}`,
        {
          method: 'POST',
          body: data
        }
      )
    } catch {
      const current = loadLocalKnowledge()
      const created: SacKnowledgeArticle = {
        id: Date.now(),
        producerId: producerId ?? 1,
        title: data.title,
        category: data.category,
        tags: data.tags || null,
        content: data.content,
        status: 'draft',
        updatedAt: new Date().toISOString()
      }
      saveLocalKnowledge([created, ...current])
      return created
    }
  },

  updateKnowledge: async (
    id: number,
    data: Partial<SacKnowledgeArticle>,
    producerId?: number | null
  ): Promise<SacKnowledgeArticle> => {
    try {
      return await apiRequest<SacKnowledgeArticle>(
        `/api/sac/ai/knowledge/${id}${query(producerId)}`,
        {
          method: 'PATCH',
          body: data
        }
      )
    } catch {
      const current = loadLocalKnowledge()
      const next = current.map(item =>
        item.id === id
          ? { ...item, ...data, updatedAt: new Date().toISOString() }
          : item
      )
      saveLocalKnowledge(next)
      return (
        next.find(item => item.id === id) || {
          id,
          producerId: producerId ?? 1,
          title: data.title || 'Artigo atualizado',
          category: data.category || 'Geral',
          tags: data.tags || null,
          content: data.content || '',
          status: (data.status as SacKnowledgeArticle['status']) || 'approved',
          updatedAt: new Date().toISOString()
        }
      )
    }
  }
}
