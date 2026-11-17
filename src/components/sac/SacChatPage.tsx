import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRightLeft,
  BookOpen,
  Bot,
  Clock,
  Headphones,
  MessageSquarePlus,
  RefreshCw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Ticket,
  UserCheck,
  Users
} from 'lucide-react'
import {
  ensureGlobalSacPresenceHeartbeat,
  formatRemainingSla,
  sacChatApi,
  type SacAgentInfo,
  type SacConversation,
  type SacMessage
} from '../../services/sacChat.service'
import {
  CUSTOMER_AI_TOPICS,
  recordSacAiOutcome,
  sacAiApi,
  type CustomerAiTopicFlow,
  type SacAiSuggestion,
  type SacKnowledgeArticle
} from '../../services/sacAi.service'
import { SacDashboardPage } from './dashboard/SacDashboardPage'

interface Props {
  producerId?: number | null
  initialView?: 'dashboard' | 'chat'
}

interface CustomerBotTurn {
  id: string
  sender: 'ai' | 'client'
  text: string
  time: string
}

export function SacChatPage({ producerId, initialView = 'dashboard' }: Props) {
  const initialSnap = useMemo(() => sacChatApi.getInitialSnapshot(), [])
  const [sacView, setSacView] = useState<'dashboard' | 'chat'>(initialView)
  const [list, setList] = useState<SacConversation[]>(initialSnap.rows)
  const [staff, setStaff] = useState(true)
  const [supervisor, setSupervisor] = useState(true)
  const [selected, setSelected] = useState<number | null>(initialSnap.rows[0]?.id ?? null)
  const [messages, setMessages] = useState<SacMessage[]>(
    initialSnap.rows[0]?.id ? initialSnap.messagesMap[initialSnap.rows[0].id] || [] : []
  )
  const [activeAgentId, setActiveAgentId] = useState<number>(101)
  const [availability, setAvailability] = useState<'available' | 'busy' | 'offline'>(() =>
    sacChatApi.getAgentSavedStatus(101)
  )
  const [showNewClientChatModal, setShowNewClientChatModal] = useState(false)
  const [showCustomerAiAssistant, setShowCustomerAiAssistant] = useState(true)
  const [showKnowledgePanel, setShowKnowledgePanel] = useState(false)
  const [clientName, setClientName] = useState('Fernanda Lima Souza')
  const [subject, setSubject] = useState('')
  const [intro, setIntro] = useState('')
  const [draft, setDraft] = useState('')
  const [senderMode, setSenderMode] = useState<'agent' | 'client'>('agent')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [filter, setFilter] = useState<'all' | 'queued' | 'mine' | 'active' | 'closed'>('all')
  const [mobileChatStep, setMobileChatStep] = useState<'list' | 'chat' | 'context'>('list')
  const [agents, setAgents] = useState<SacAgentInfo[]>(initialSnap.agents)
  const [target, setTarget] = useState('')

  // Estado do Copiloto IA do Atendente
  const [suggestion, setSuggestion] = useState<SacAiSuggestion | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Estado da Base de Conhecimento da IA (SAC)
  const [knowledge, setKnowledge] = useState<SacKnowledgeArticle[]>(() =>
    sacAiApi.getInitialKnowledge()
  )
  const [kbTitle, setKbTitle] = useState('')
  const [kbCategory, setKbCategory] = useState('Cancelamento de show')
  const [kbTags, setKbTags] = useState('')
  const [kbContent, setKbContent] = useState('')

  // Estado do Assistente Virtual SafeSaff (IA para o Cliente — N1)
  const [activeClientTopic, setActiveClientTopic] = useState<CustomerAiTopicFlow | null>(
    CUSTOMER_AI_TOPICS[0]
  )
  const [clientOrderCode, setClientOrderCode] = useState('ORD-928371')
  const [clientCustomQuestion, setClientCustomQuestion] = useState('')
  const [botTurns, setBotTurns] = useState<CustomerBotTurn[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: 'Olá! Sou a assistente virtual do SafeSaff. Posso ajudar com dúvidas sobre eventos, ingressos, reembolsos ou encaminhar você para um atendente do SAC. Qual assunto você deseja tratar?',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ])

  async function refresh() {
    try {
      const result = await sacChatApi.list(producerId)
      setList(result.rows)
      setStaff(result.staff)
      setSupervisor(result.supervisor)
      setSelected(prev => prev ?? result.rows[0]?.id ?? null)
      const ags = await sacChatApi.agents(producerId)
      setAgents(ags)
      const kbRows = await sacAiApi.knowledge(producerId)
      setKnowledge(kbRows)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 2800)
    const onSync = () => void refresh()
    window.addEventListener('safesaff:sac-chat-sync', onSync)
    window.addEventListener('safesaff:sac-ai-sync', onSync)
    return () => {
      clearInterval(timer)
      window.removeEventListener('safesaff:sac-chat-sync', onSync)
      window.removeEventListener('safesaff:sac-ai-sync', onSync)
    }
  }, [producerId])

  useEffect(() => {
    setSuggestion(null)
    if (!selected) {
      setMessages([])
      return
    }
    let active = true
    const load = async () => {
      try {
        const rows = await sacChatApi.messages(selected)
        if (active) setMessages(rows)
      } catch (e) {
        if (active) setError((e as Error).message)
      }
    }
    void load()
    const timer = setInterval(() => void load(), 2500)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [selected])

  useEffect(() => {
    ensureGlobalSacPresenceHeartbeat(producerId, activeAgentId)
    setAvailability(sacChatApi.getAgentSavedStatus(activeAgentId))
  }, [producerId, activeAgentId])

  async function action(callback: () => Promise<unknown>, okMsg?: string) {
    try {
      setError('')
      await callback()
      if (okMsg) setFeedback(okMsg)
      await refresh()
      if (selected) setMessages(await sacChatApi.messages(selected))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !intro.trim()) return
    await action(async () => {
      const c = await sacChatApi.create(
        subject.trim(),
        intro.trim(),
        producerId,
        clientName.trim() || 'Cliente Autenticado ERP'
      )
      setSelected(c.id)
      setSubject('')
      setIntro('')
      setShowNewClientChatModal(false)
      setFeedback(
        c.status === 'active'
          ? `✅ Protocolo ${c.ticket.code} criado e distribuído automaticamente para ${c.assignedAgent?.name}!`
          : `⏳ Protocolo ${c.ticket.code} criado e mantido na Fila de Espera do SAC (limite de 3 conversas por atendente respeitado).`
      )
    })
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!selected || !draft.trim()) return
    const text = draft.trim()
    const currentConv = list.find(c => c.id === selected)
    const authorLabel =
      senderMode === 'client'
        ? currentConv?.ticket.requesterName || 'Cliente'
        : currentConv?.assignedAgent?.name || 'Atendente SAC SafeSaff'
    await action(async () => {
      await sacChatApi.send(selected, text, authorLabel, senderMode)
      if (suggestion) {
        const status = text === suggestion.suggestionText.trim() ? 'accepted' : 'edited'
        await sacAiApi.review(suggestion.id, status, text, producerId).catch(() => undefined)
        setSuggestion(null)
      }
      setDraft('')
    })
  }

  async function suggestWithAi() {
    if (!selected) return
    setAiLoading(true)
    setError('')
    try {
      const conv = list.find(c => c.id === selected)
      const lastClientMsg =
        [...messages].reverse().find(m => m.senderRole === 'client')?.body ||
        conv?.ticket.subject ||
        ''
      const generated = await sacAiApi.suggest(
        selected,
        producerId,
        `${conv?.ticket.subject || ''} ${lastClientMsg}`
      )
      setSuggestion(generated)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAiLoading(false)
    }
  }

  async function useSuggestionInEditor() {
    if (!suggestion) return
    setDraft(suggestion.suggestionText)
    await sacAiApi
      .review(suggestion.id, 'accepted', suggestion.suggestionText, producerId)
      .catch(() => undefined)
    setFeedback(
      '✨ Sugestão da IA copiada para o editor! Revise o conteúdo antes de clicar em Enviar.'
    )
  }

  async function discardSuggestion() {
    if (!suggestion) return
    await sacAiApi.review(suggestion.id, 'discarded', undefined, producerId).catch(() => undefined)
    setSuggestion(null)
  }

  async function createArticle(e: FormEvent) {
    e.preventDefault()
    if (!kbTitle.trim() || !kbCategory.trim() || !kbContent.trim()) return
    await action(async () => {
      await sacAiApi.createKnowledge(
        {
          title: kbTitle.trim(),
          category: kbCategory.trim(),
          tags: kbTags.trim() || undefined,
          content: kbContent.trim()
        },
        producerId
      )
      setKbTitle('')
      setKbTags('')
      setKbContent('')
    }, '📚 Rascunho de artigo salvo na Base de Conhecimento da IA (SAC). Aguardando aprovação do supervisor.')
  }

  function handleSelectClientTopic(topic: CustomerAiTopicFlow) {
    setActiveClientTopic(topic)
    const now = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
    setBotTurns(prev => [
      ...prev,
      { id: `c-${Date.now()}`, sender: 'client', text: topic.initialQuestion, time: now },
      { id: `a-${Date.now() + 1}`, sender: 'ai', text: topic.guidedAnswer, time: now }
    ])
  }

  async function handleClientFollowUp(
    followUp: CustomerAiTopicFlow['followUpPrompts'][number]
  ) {
    const now = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
    setBotTurns(prev => [
      ...prev,
      { id: `cf-${Date.now()}`, sender: 'client', text: followUp.label, time: now },
      { id: `af-${Date.now() + 1}`, sender: 'ai', text: followUp.response, time: now }
    ])

    if (followUp.triggersHandoff) {
      await handleHandoffCustomerAiToHuman(activeClientTopic)
    }
  }

  async function handleCustomerFreeQuestion(e: FormEvent) {
    e.preventDefault()
    const q = clientCustomQuestion.trim()
    if (!q) return
    setClientCustomQuestion('')
    const now = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
    const lower = q.toLowerCase()
    const matchedTopic =
      CUSTOMER_AI_TOPICS.find(t => {
        if (lower.includes('cancel') || lower.includes('show'))
          return t.key === 'cancelamento_show'
        if (lower.includes('reembolso') || lower.includes('estorno') || lower.includes('dinheiro'))
          return t.key === 'reembolso'
        if (lower.includes('ingresso') || lower.includes('qr') || lower.includes('titular'))
          return t.key === 'ingressos_acesso'
        if (lower.includes('data') || lower.includes('local') || lower.includes('adiado'))
          return t.key === 'alteracao_evento'
        if (lower.includes('pix') || lower.includes('cart') || lower.includes('pag'))
          return t.key === 'problemas_pagamento'
        if (lower.includes('atendente') || lower.includes('humano'))
          return t.key === 'falar_sac'
        return false
      }) || CUSTOMER_AI_TOPICS[0]

    setActiveClientTopic(matchedTopic)
    setBotTurns(prev => [
      ...prev,
      { id: `cq-${Date.now()}`, sender: 'client', text: q, time: now },
      {
        id: `ca-${Date.now() + 1}`,
        sender: 'ai',
        text: matchedTopic.guidedAnswer,
        time: now
      }
    ])
  }

  function handleMarkResolvedByAi() {
    recordSacAiOutcome('resolved_by_ai')
    const now = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
    setBotTurns(prev => [
      ...prev,
      {
        id: `res-${Date.now()}`,
        sender: 'ai',
        text: '✅ Atendimento concluído pela Assistente Virtual SafeSaff! Ficamos felizes em resolver sua solicitação em 1º nível. Caso precise de algo mais, basta escolher outro tema ou pedir um atendente humano.',
        time: now
      }
    ])
    setFeedback(
      '🤖 Solicitação resolvida diretamente pela IA do Cliente (N1) com base nos artigos aprovados!'
    )
  }

  async function handleHandoffCustomerAiToHuman(topic: CustomerAiTopicFlow | null) {
    const chosen = topic || CUSTOMER_AI_TOPICS[0]
    recordSacAiOutcome('transferred_to_human')

    await action(async () => {
      const created = await sacChatApi.handoffFromAi({
        subject: `[IA → SAC] ${chosen.label} (${clientOrderCode})`,
        clientName: clientName.trim() || 'Fernanda Lima Souza',
        orderCode: clientOrderCode,
        priority: chosen.priority,
        requiredSkill: chosen.requiredSkill,
        transcriptTurns: botTurns,
        producerId
      })
      setSelected(created.id)
      setFeedback(
        created.status === 'active'
          ? `🤖➡️👤 IA transferiu o protocolo ${created.ticket.code} (${chosen.label} • Skill: ${chosen.requiredSkill}) com histórico completo para ${created.assignedAgent?.name}!`
          : `🤖➡️⏳ IA transferiu o protocolo ${created.ticket.code} (${chosen.label} • Skill: ${chosen.requiredSkill}) para a Fila Central do SAC preservando todo o histórico.`
      )
    })
  }

  async function changeAvailability(status: 'available' | 'busy' | 'offline') {
    await action(async () => {
      await sacChatApi.status(status, producerId, activeAgentId)
      setAvailability(status)
    }, `Status do atendente atualizado para ${status === 'available' ? 'Disponível' : status === 'busy' ? 'Ocupado' : 'Ausente'}.`)
  }

  const conversation = list.find(c => c.id === selected)

  const kpis = useMemo(() => {
    const queued = list.filter(c => c.status === 'queued').length
    const activeAll = list.filter(c => c.status === 'active').length
    const myActive = list.filter(
      c => c.status === 'active' && c.assignedAgentId === activeAgentId
    ).length
    const onlineAgents = agents.filter(a => a.status !== 'offline').length
    return { queued, activeAll, myActive, onlineAgents }
  }, [list, agents, activeAgentId])

  const filtered = useMemo(() => {
    return list.filter(c => {
      if (filter === 'queued') return c.status === 'queued'
      if (filter === 'mine')
        return c.status === 'active' && c.assignedAgentId === activeAgentId
      if (filter === 'active') return c.status === 'active'
      if (filter === 'closed') return c.status === 'closed'
      return true
    })
  }, [list, filter, activeAgentId])

  return (
    <main
      className="p-4 md:p-5 space-y-4 text-[#111827] dark:text-[#F7F9FC] transition-colors"
      aria-label="Chat do SAC"
    >
      {/* Barra de Alternância Rápida: Dashboard SAC vs Chat Operacional (Azul Elétrico + Violeta Neon) */}
      <div className="bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSacView('dashboard')}
            data-testid="tab-sac-dashboard-view"
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              sacView === 'dashboard'
                ? 'bg-[#155EEF] text-white shadow'
                : 'bg-[#F5F7FA] dark:bg-[#1D2735] text-[#526074] dark:text-[#B5C0D0] hover:text-[#111827] dark:hover:text-white'
            }`}
          >
            📊 Dashboard SAC (Eficiência, Fila c/ Alerta Sonoro, SLA/ITIL, Skills & IA)
          </button>

          <button
            type="button"
            onClick={() => setSacView('chat')}
            data-testid="tab-sac-live-chat-view"
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              sacView === 'chat'
                ? 'bg-gradient-to-r from-[#155EEF] to-[#7942D8] text-white shadow'
                : 'bg-[#F5F7FA] dark:bg-[#1D2735] text-[#526074] dark:text-[#B5C0D0] hover:text-[#111827] dark:hover:text-white'
            }`}
          >
            💬 Operação Chat SAC + IA ({kpis.queued} na fila • {kpis.myActive}/3 ativos)
          </button>
        </div>

        <span className="text-[11px] text-[#526074] dark:text-[#B5C0D0] pr-2 font-medium">
          Central Integrada SAC SafeSaff • IA para o Cliente (N1) + IA Copiloto do Atendente
        </span>
      </div>

      {sacView === 'dashboard' ? (
        <SacDashboardPage
          producerId={producerId}
          onOpenLiveChat={() => setSacView('chat')}
        />
      ) : (
        <>
          {/* =====================================================================
              1. CABEÇALHO E KPIS EM TEMPO REAL DA CENTRAL SAC — CHAT
          ===================================================================== */}
          <header className="bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-2xl p-4 flex flex-wrap justify-between gap-4 items-center shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#155EEF] to-[#7942D8] text-white flex items-center justify-center shadow">
                <Headphones size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-[#111827] dark:text-[#F7F9FC]">
                    Central SAC — Chat
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F3E8FF] dark:bg-[#B66CFF]/20 text-[#7942D8] dark:text-[#B66CFF] border border-[#D8B4FE] dark:border-[#B66CFF]/40">
                    Atendimento multicanal com IA
                  </span>
                </div>
                <p className="text-xs text-[#526074] dark:text-[#B5C0D0] mt-0.5">
                  Distribuição automática ativada • Assumir manualmente • Limite de 3 conversas simultâneas por atendente • Supervisão SAC
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {staff && (
                <div className="flex items-center gap-2 bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] rounded-xl px-3 py-1.5 text-xs">
                  <span className="text-[#526074] dark:text-[#B5C0D0] font-semibold">
                    Operador:
                  </span>
                  <select
                    value={activeAgentId}
                    onChange={e => setActiveAgentId(Number(e.target.value))}
                    className="bg-white dark:bg-[#101620] border border-[#DCE2EA] dark:border-[#344154] rounded-lg px-2 py-1 text-[#111827] dark:text-[#F7F9FC] font-bold text-xs"
                  >
                    {agents.map(a => (
                      <option key={a.userId} value={a.userId}>
                        {a.user.name}
                      </option>
                    ))}
                  </select>

                  <span className="text-[#526074] dark:text-[#B5C0D0] font-semibold ml-1">
                    Meu status:
                  </span>
                  <select
                    aria-label="Disponibilidade SAC"
                    className="bg-white dark:bg-[#101620] border border-[#DCE2EA] dark:border-[#344154] rounded-lg px-2.5 py-1 font-bold text-xs text-[#111827] dark:text-[#F7F9FC]"
                    value={availability}
                    onChange={e =>
                      void changeAvailability(e.target.value as typeof availability)
                    }
                  >
                    <option value="available">🟢 Online</option>
                    <option value="busy">🟠 Ocupado</option>
                    <option value="offline">⚪ Ausente</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowCustomerAiAssistant(prev => !prev)}
                data-testid="btn-toggle-customer-ai"
                className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer border ${
                  showCustomerAiAssistant
                    ? 'bg-[#7942D8] border-[#7942D8] text-white'
                    : 'bg-white dark:bg-[#1D2735] border-[#DCE2EA] dark:border-[#344154] text-[#7942D8] dark:text-[#B66CFF]'
                }`}
              >
                <Bot size={15} />
                <span>🤖 IA do Cliente (Temas & Reembolso)</span>
              </button>

              {staff && (
                <button
                  type="button"
                  onClick={() => setShowKnowledgePanel(prev => !prev)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] text-[#009AC2] dark:text-[#24DEFF] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen size={14} />
                  <span>Base IA ({knowledge.filter(k => k.status === 'approved').length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowNewClientChatModal(prev => !prev)}
                className="px-3.5 py-2 rounded-xl bg-[#155EEF] hover:bg-[#1D4ED8] text-white font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
              >
                <MessageSquarePlus size={15} />
                <span>+ Novo Protocolo Direto</span>
              </button>
            </div>
          </header>

          {/* =====================================================================
              CAMADA 1: ASSISTENTE VIRTUAL SAFESAFF (IA PARA O CLIENTE — DESTAQUE VIOLETA NEON #7942D8 / #B66CFF)
          ===================================================================== */}
          {showCustomerAiAssistant && (
            <section
              className="bg-white dark:bg-[#151C27] border-2 border-[#7942D8]/40 dark:border-[#B66CFF]/45 rounded-2xl p-4 shadow-md space-y-3"
              data-testid="customer-ai-virtual-assistant"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE2EA] dark:border-[#344154] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7942D8] to-[#155EEF] text-white flex items-center justify-center shadow">
                    <Bot size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-[#111827] dark:text-[#F7F9FC]">
                        Assistente Virtual SafeSaff — IA de Atendimento ao Cliente
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F3E8FF] dark:bg-[#B66CFF]/20 text-[#7942D8] dark:text-[#B66CFF] border border-[#D8B4FE] dark:border-[#B66CFF]/40">
                        Online · IA + Equipe SAC
                      </span>
                    </div>
                    <p className="text-[11px] text-[#526074] dark:text-[#B5C0D0]">
                      O cliente escolhe o tema desejado (ex.: Cancelamento de show, Solicitar reembolso, Ingressos e acesso), recebe orientação imediata da IA e pode transferir para um atendente humano a qualquer momento.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="bg-[#F5F7FA] dark:bg-[#101620] border border-[#DCE2EA] dark:border-[#344154] rounded-lg px-2.5 py-1 text-xs text-[#111827] dark:text-[#F7F9FC] w-44"
                    placeholder="Nome do Cliente"
                  />
                  <input
                    type="text"
                    value={clientOrderCode}
                    onChange={e => setClientOrderCode(e.target.value)}
                    className="bg-[#F5F7FA] dark:bg-[#101620] border border-[#DCE2EA] dark:border-[#344154] rounded-lg px-2.5 py-1 text-xs font-mono text-[#7942D8] dark:text-[#B66CFF] w-28"
                    placeholder="Pedido"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Coluna Esquerda: Botões de Temas e Perguntas Guiadas */}
                <div className="lg:col-span-5 space-y-3 bg-[#F5F7FA] dark:bg-[#101620] border border-[#DCE2EA] dark:border-[#344154] rounded-xl p-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#7942D8] dark:text-[#B66CFF] block">
                    1. Temas Rápidos para o Cliente (Clique para testar)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CUSTOMER_AI_TOPICS.map(topic => {
                      const isCurrent = activeClientTopic?.key === topic.key
                      return (
                        <button
                          key={topic.key}
                          type="button"
                          onClick={() => handleSelectClientTopic(topic)}
                          data-testid={`client-ai-topic-${topic.key}`}
                          className={`text-left p-2.5 rounded-xl border text-xs transition cursor-pointer ${
                            isCurrent
                              ? 'bg-[#7942D8]/15 dark:bg-[#7942D8]/25 border-[#7942D8] dark:border-[#B66CFF] text-[#111827] dark:text-white shadow-2xs'
                              : 'bg-white dark:bg-[#151C27] border-[#DCE2EA] dark:border-[#344154] text-[#111827] dark:text-[#F7F9FC] hover:border-[#7942D8]'
                          }`}
                        >
                          <strong className="block font-bold">
                            {topic.label}
                          </strong>
                          <span className="text-[10px] text-[#7942D8] dark:text-[#B66CFF] block mt-0.5 font-semibold">
                            {topic.badge} • Skill: {topic.requiredSkill}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {activeClientTopic && (
                    <div className="pt-2 border-t border-[#DCE2EA] dark:border-[#344154] space-y-2">
                      <span className="text-[11px] font-bold text-[#526074] dark:text-[#B5C0D0] block">
                        2. Opções de Continuação do Tema ({activeClientTopic.label}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeClientTopic.followUpPrompts.map(fp => (
                          <button
                            key={fp.id}
                            type="button"
                            onClick={() => void handleClientFollowUp(fp)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
                              fp.triggersHandoff
                                ? 'bg-[#FFF7ED] dark:bg-[#FF9A35]/20 border-[#FED7AA] dark:border-[#FF9A35]/50 text-[#BD5D00] dark:text-[#FF9A35]'
                                : 'bg-white dark:bg-[#151C27] border-[#D8B4FE] dark:border-[#B66CFF]/40 text-[#7942D8] dark:text-[#B66CFF]'
                            }`}
                          >
                            {fp.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={handleMarkResolvedByAi}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#7942D8] hover:bg-[#6D28D9] text-white cursor-pointer"
                        >
                          ✓ Dúvida resolvida pela IA
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna Direita: Conversa Interativa do Cliente com a Assistente Virtual SafeSaff */}
                <div className="lg:col-span-7 bg-[#F5F7FA] dark:bg-[#101620] border border-[#DCE2EA] dark:border-[#344154] rounded-xl p-3.5 flex flex-col h-72">
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {botTurns.map(turn => (
                      <div
                        key={turn.id}
                        className={`rounded-xl p-2.5 text-xs ${
                          turn.sender === 'ai'
                            ? 'bg-[#F3E8FF]/80 dark:bg-[#7942D8]/20 border border-[#D8B4FE] dark:border-[#B66CFF]/40 text-[#111827] dark:text-[#F7F9FC] mr-8'
                            : 'bg-[#155EEF] text-white ml-12'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] opacity-80 mb-1">
                          <strong>
                            {turn.sender === 'ai'
                              ? '✨ Assistente Virtual SafeSaff (IA)'
                              : `👤 ${clientName}`}
                          </strong>
                          <span>{turn.time}</span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{turn.text}</p>
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={e => void handleCustomerFreeQuestion(e)}
                    className="pt-2.5 mt-2 border-t border-[#DCE2EA] dark:border-[#344154] flex flex-col sm:flex-row gap-2"
                  >
                    <input
                      type="text"
                      value={clientCustomQuestion}
                      onChange={e => setClientCustomQuestion(e.target.value)}
                      placeholder="Digite uma dúvida do cliente (ex: O show foi cancelado, como recebo meu PIX de volta?)..."
                      className="flex-1 bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-xl px-3 py-1.5 text-xs text-[#111827] dark:text-[#F7F9FC]"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-xl bg-[#7942D8] hover:bg-[#6D28D9] text-white font-bold text-xs cursor-pointer"
                    >
                      Perguntar à IA
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleHandoffCustomerAiToHuman(activeClientTopic)}
                      data-testid="btn-handoff-ai-to-sac"
                      className="px-3.5 py-1.5 rounded-xl bg-[#155EEF] hover:bg-[#1D4ED8] text-white font-bold text-xs cursor-pointer"
                    >
                      Falar com Atendente SAC
                    </button>
                  </form>
                </div>
              </div>
            </section>
          )}

          {/* Strip de KPIs da Fila e Capacidade (Laranja SLA | Azul Elétrico | Ciano | Violeta) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-xl p-3.5 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#BD5D00] dark:text-[#FF9A35] block">
                  Na Fila SAC (SLA)
                </span>
                <strong className="text-2xl font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                  {kpis.queued}
                </strong>
                <span className="text-[11px] text-[#526074] dark:text-[#B5C0D0] block">
                  Aguardando atribuição
                </span>
              </div>
              <Clock size={22} className="text-[#BD5D00] dark:text-[#FF9A35]" />
            </div>

            <div className="bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-xl p-3.5 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#155EEF] dark:text-[#388BFF] block">
                  Meus Atendimentos
                </span>
                <strong className="text-2xl font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                  {kpis.myActive} <span className="text-sm text-[#526074] dark:text-[#B5C0D0]">/ 3 máx</span>
                </strong>
                <span className="text-[11px] text-[#526074] dark:text-[#B5C0D0] block">
                  {kpis.myActive >= 3
                    ? 'Capacidade máxima atingida'
                    : `${3 - kpis.myActive} vaga(s) livre(s)`}
                </span>
              </div>
              <UserCheck size={22} className="text-[#155EEF] dark:text-[#388BFF]" />
            </div>

            <div className="bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-xl p-3.5 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#009AC2] dark:text-[#24DEFF] block">
                  Ativos no SAC
                </span>
                <strong className="text-2xl font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                  {kpis.activeAll}
                </strong>
                <span className="text-[11px] text-[#526074] dark:text-[#B5C0D0] block">
                  Conversas em andamento
                </span>
              </div>
              <Headphones size={22} className="text-[#009AC2] dark:text-[#24DEFF]" />
            </div>

            <div className="bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-xl p-3.5 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#7942D8] dark:text-[#B66CFF] block">
                  Atendentes Online
                </span>
                <strong className="text-2xl font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                  {kpis.onlineAgents}
                </strong>
                <span className="text-[11px] text-[#526074] dark:text-[#B5C0D0] block">
                  Supervisão SAC ativa
                </span>
              </div>
              <Users size={22} className="text-[#7942D8] dark:text-[#B66CFF]" />
            </div>
          </div>

          {/* Alertas e Feedbacks */}
          {error && (
            <div
              role="alert"
              className="bg-[#FFF1F2] dark:bg-[#C1273C]/20 border border-[#FECDD3] dark:border-[#FF5A78]/50 text-[#C1273C] dark:text-[#FF5A78] rounded-xl p-3 text-xs flex items-center justify-between"
            >
              <span>⚠️ {error}</span>
              <button
                type="button"
                onClick={() => setError('')}
                className="underline font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          )}

          {feedback && (
            <div className="bg-[#EFF6FF] dark:bg-[#388BFF]/20 border border-[#BFDBFE] dark:border-[#388BFF]/40 text-[#155EEF] dark:text-[#388BFF] rounded-xl p-3 text-xs flex items-center justify-between font-semibold">
              <span>{feedback}</span>
              <button
                type="button"
                onClick={() => setFeedback('')}
                className="underline font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          )}

          {/* Modal / Card de Abertura de Novo Chat pelo Cliente */}
          {(!staff || showNewClientChatModal) && (
            <form
              onSubmit={e => void create(e)}
              className="bg-white dark:bg-[#151C27] border border-[#155EEF]/50 rounded-2xl p-4 space-y-3 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-[#111827] dark:text-[#F7F9FC]">
                  Abrir Nova Conversa no Chat SAC (Portal do Cliente ERP)
                </h2>
                {staff && (
                  <button
                    type="button"
                    onClick={() => setShowNewClientChatModal(false)}
                    className="text-xs text-[#526074] dark:text-[#B5C0D0] hover:text-[#111827] dark:hover:text-white cursor-pointer"
                  >
                    ✕ Fechar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="bg-[#F5F7FA] dark:bg-[#101620] border border-[#DCE2EA] dark:border-[#344154] rounded-xl p-2.5 text-xs text-[#111827] dark:text-[#F7F9FC]"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Nome do Cliente"
                />
                <input
                  className="bg-[#F5F7FA] dark:bg-[#101620] border border-[#DCE2EA] dark:border-[#344154] rounded-xl p-2.5 text-xs text-[#111827] dark:text-[#F7F9FC]"
                  maxLength={160}
                  minLength={3}
                  required
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Assunto do atendimento (ex: Cancelamento de show, Reembolso PIX...)"
                  aria-label="Assunto"
                />
              </div>
              <textarea
                className="w-full bg-[#F5F7FA] dark:bg-[#101620] border border-[#DCE2EA] dark:border-[#344154] rounded-xl p-2.5 text-xs text-[#111827] dark:text-[#F7F9FC]"
                rows={2}
                maxLength={10000}
                required
                value={intro}
                onChange={e => setIntro(e.target.value)}
                placeholder="Descreva sua solicitação para a equipe do SAC..."
                aria-label="Mensagem inicial"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#526074] dark:text-[#B5C0D0]">
                  Se houver atendente disponível com menos de 3 chats ativos, a conversa será atribuída automaticamente; caso contrário, entrará na Fila SAC.
                </span>
                <button
                  type="submit"
                  className="bg-[#155EEF] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-xl px-4 py-2 cursor-pointer"
                >
                  Iniciar Chat SAC
                </button>
              </div>
            </form>
          )}

          {/* =====================================================================
              2. LAYOUT OPERACIONAL EM 3 COLUNAS NO DESKTOP E 1 TELA POR ETAPA NO MOBILE
              (FILA SAC | CONVERSA + COPILOTO VIOLETA IA | CONTEXTO 360° + SLA LARANJA)
          ===================================================================== */}
          <div
            className="lg:hidden grid grid-cols-3 gap-1.5 bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-xl p-1.5 shadow-2xs"
            role="tablist"
            aria-label="Etapas do atendimento mobile"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mobileChatStep === 'list'}
              onClick={() => setMobileChatStep('list')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                mobileChatStep === 'list'
                  ? 'bg-[#155EEF] text-white shadow-2xs'
                  : 'text-[#526074] dark:text-[#B5C0D0]'
              }`}
            >
              1. Fila ({filtered.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileChatStep === 'chat'}
              onClick={() => setMobileChatStep('chat')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                mobileChatStep === 'chat'
                  ? 'bg-[#155EEF] text-white shadow-2xs'
                  : 'text-[#526074] dark:text-[#B5C0D0]'
              }`}
            >
              2. Conversa
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileChatStep === 'context'}
              onClick={() => setMobileChatStep('context')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                mobileChatStep === 'context'
                  ? 'bg-[#155EEF] text-white shadow-2xs'
                  : 'text-[#526074] dark:text-[#B5C0D0]'
              }`}
            >
              3. Ficha & SLA
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* COLUNA 1 (ESQUERDA - 3 COLUNAS): FILA DE ESPERA & MEUS ATENDIMENTOS */}
            <aside
              className={`lg:col-span-3 bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-2xl p-3.5 space-y-3 flex-col h-[520px] lg:h-[620px] shadow-xs ${
                mobileChatStep === 'list' ? 'flex' : 'hidden lg:flex'
              }`}
              aria-label="Lista de atendimentos"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-sm text-[#111827] dark:text-[#F7F9FC]">
                  Conversas ({filtered.length})
                </h2>
                <button
                  type="button"
                  className="text-[#155EEF] dark:text-[#388BFF] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  onClick={() => void refresh()}
                >
                  <RefreshCw size={12} /> Atualizar
                </button>
              </div>

              {staff && (
                <div className="grid grid-cols-5 gap-1 bg-[#F5F7FA] dark:bg-[#101620] p-1 rounded-xl border border-[#DCE2EA] dark:border-[#344154] text-[10px] font-bold">
                  {(
                    [
                      { id: 'all' as const, label: 'Todas' },
                      { id: 'queued' as const, label: `Fila (${kpis.queued})` },
                      { id: 'mine' as const, label: `Minhas (${kpis.myActive})` },
                      { id: 'active' as const, label: 'Ativas' },
                      { id: 'closed' as const, label: 'Fim' }
                    ] as const
                  ).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilter(tab.id)}
                      className={`py-1.5 rounded-lg cursor-pointer transition ${
                        filter === tab.id
                          ? 'bg-[#155EEF] text-white'
                          : 'text-[#526074] dark:text-[#B5C0D0] hover:text-[#111827] dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filtered.map(c => {
                  const isSelected = selected === c.id
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setSelected(c.id)
                        setMobileChatStep('chat')
                      }}
                      className={`block w-full text-left border rounded-xl p-3 transition cursor-pointer ${
                        isSelected
                          ? 'border-[#155EEF] dark:border-[#388BFF] bg-[#EFF6FF]/70 dark:bg-[#1D2735] shadow-xs'
                          : 'border-[#DCE2EA] dark:border-[#344154] bg-[#F5F7FA]/60 dark:bg-[#101620]/70 hover:border-[#155EEF]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-[10px] font-bold text-[#155EEF] dark:text-[#388BFF]">
                          {c.ticket.code}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'queued'
                              ? 'bg-[#FFF7ED] dark:bg-[#FF9A35]/20 text-[#BD5D00] dark:text-[#FF9A35] border border-[#FED7AA] dark:border-[#FF9A35]/40'
                              : c.status === 'active'
                              ? 'bg-[#EFF6FF] dark:bg-[#388BFF]/20 text-[#155EEF] dark:text-[#388BFF] border border-[#BFDBFE] dark:border-[#388BFF]/40'
                              : 'bg-[#EEF2F6] dark:bg-[#1D2735] text-[#526074] dark:text-[#B5C0D0]'
                          }`}
                        >
                          {c.status === 'queued'
                            ? `⏱ ${formatRemainingSla(c).label}`
                            : c.status === 'active'
                            ? 'Em atendimento'
                            : 'Encerrada'}
                        </span>
                      </div>
                      <span className="block font-bold text-xs text-[#111827] dark:text-[#F7F9FC] truncate">
                        {c.ticket.requesterName}
                      </span>
                      <span className="block text-[11px] text-[#526074] dark:text-[#B5C0D0] truncate mt-0.5">
                        {c.ticket.subject}
                      </span>
                      {c.assignedAgent && (
                        <span className="block text-[10px] text-[#7942D8] dark:text-[#B66CFF] mt-1 font-semibold">
                          👤 {c.assignedAgent.name}
                        </span>
                      )}
                    </button>
                  )
                })}
                {!filtered.length && (
                  <p className="text-xs text-[#526074] dark:text-[#B5C0D0] text-center py-8">
                    Nenhuma conversa neste filtro.
                  </p>
                )}
              </div>
            </aside>

            {/* COLUNA 2 (CENTRO - 6 COLUNAS): CONVERSA EM TEMPO REAL + COPILOTO VIOLETA IA */}
            <section
              className={`lg:col-span-6 bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-2xl p-4 flex-col min-h-[480px] lg:h-[620px] shadow-xs ${
                mobileChatStep === 'chat' ? 'flex' : 'hidden lg:flex'
              }`}
              aria-label="Conversa selecionada"
            >
              {conversation ? (
                <>
                  <div className="flex flex-wrap gap-2 justify-between items-start border-b border-[#DCE2EA] dark:border-[#344154] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-[#155EEF] dark:text-[#388BFF]">
                          {conversation.ticket.code}
                        </span>
                        <h2 className="font-bold text-sm text-[#111827] dark:text-[#F7F9FC]">
                          {conversation.ticket.subject}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-[#FFF7ED] dark:bg-[#FF9A35]/20 text-[#BD5D00] dark:text-[#FF9A35] border border-[#FED7AA] dark:border-[#FF9A35]/40 text-[10px] font-bold">
                          ⏱ {formatRemainingSla(conversation).label} ({conversation.ticket.priority || 'P3'})
                        </span>
                      </div>
                      <p className="text-xs text-[#526074] dark:text-[#B5C0D0] mt-0.5">
                        Cliente:{' '}
                        <strong className="text-[#111827] dark:text-[#F7F9FC]">
                          {conversation.ticket.requesterName}
                        </strong>
                        {conversation.assignedAgent
                          ? ` · Atendente: ${conversation.assignedAgent.name}`
                          : ' · Aguardando na Fila Central do SAC'}
                      </p>
                    </div>

                    {staff && (
                      <div className="flex flex-wrap items-center gap-2">
                        {conversation.status === 'queued' && (
                          <button
                            type="button"
                            className="rounded-xl bg-[#155EEF] hover:bg-[#1D4ED8] text-white px-3 py-1.5 text-xs font-bold shadow cursor-pointer"
                            onClick={() =>
                              void action(
                                () => sacChatApi.claim(conversation.id, activeAgentId),
                                `Atendimento ${conversation.ticket.code} assumido manualmente!`
                              )
                            }
                          >
                            Assumir atendimento
                          </button>
                        )}

                        {supervisor && conversation.status !== 'closed' && (
                          <div className="flex items-center gap-1">
                            <select
                              aria-label="Destino da transferência"
                              className="bg-[#F5F7FA] dark:bg-[#101620] border border-[#DCE2EA] dark:border-[#344154] rounded-lg px-2 py-1 text-xs text-[#111827] dark:text-[#F7F9FC]"
                              value={target}
                              onChange={e => setTarget(e.target.value)}
                            >
                              <option value="">Devolver à fila</option>
                              {agents.map(a => (
                                <option key={a.userId} value={a.userId}>
                                  {a.user.name} ({a.activeChatsCount ?? 0}/3)
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="border border-[#DCE2EA] dark:border-[#344154] bg-[#F5F7FA] dark:bg-[#1D2735] hover:border-[#155EEF] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#111827] dark:text-[#F7F9FC] flex items-center gap-1 cursor-pointer"
                              onClick={() =>
                                void action(
                                  () =>
                                    sacChatApi.transfer(
                                      conversation.id,
                                      target ? Number(target) : undefined
                                    ),
                                  'Transferência executada pela Supervisão SAC.'
                                )
                              }
                            >
                              <ArrowRightLeft size={12} /> Transferir
                            </button>
                          </div>
                        )}

                        {conversation.status === 'active' && (
                          <button
                            type="button"
                            className="rounded-xl border border-[#C1273C]/40 bg-[#C1273C]/10 hover:bg-[#C1273C]/20 text-[#C1273C] dark:text-[#FF5A78] px-3 py-1.5 text-xs font-bold cursor-pointer"
                            onClick={() =>
                              void action(
                                () => sacChatApi.close(conversation.id),
                                `Atendimento ${conversation.ticket.code} encerrado e registrado no histórico.`
                              )
                            }
                          >
                            Finalizar
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Histórico de Mensagens (Cliente Neutro | Humano Azul Elétrico | Sistema Laranja SLA) */}
                  <div
                    className="flex-1 overflow-y-auto space-y-3 py-3 pr-1"
                    aria-live="polite"
                  >
                    {messages.map(m => {
                      const isSystem = m.senderRole === 'system'
                      const isClient =
                        m.senderRole === 'client' ||
                        m.author === conversation.ticket.requesterName
                      return (
                        <div
                          key={m.id}
                          className={`rounded-xl border p-3 text-xs ${
                            isSystem
                              ? 'bg-[#FFF7ED] dark:bg-[#FF9A35]/15 border-[#FED7AA] dark:border-[#FF9A35]/35 text-[#BD5D00] dark:text-[#FF9A35] text-center'
                              : isClient
                              ? 'bg-[#F5F7FA] dark:bg-[#1D2735] border-[#DCE2EA] dark:border-[#344154] text-[#111827] dark:text-[#F7F9FC] mr-8'
                              : 'bg-gradient-to-r from-[#155EEF] to-[#1D4ED8] border-[#388BFF]/40 text-white ml-8 shadow-xs'
                          }`}
                        >
                          <div
                            className={`flex items-center justify-between text-[10px] mb-1 ${
                              isClient || isSystem
                                ? 'text-[#526074] dark:text-[#B5C0D0]'
                                : 'text-blue-100'
                            }`}
                          >
                            <strong>{m.author}</strong>
                            <span>
                              {new Date(m.createdAt).toLocaleTimeString('pt-BR')}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap break-words leading-relaxed">
                            {m.body}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  {/* =================================================================
                      CAMADA 2: COPILOTO IA DO ATENDENTE SAC (DESTAQUE VIOLETA NEON COMO NA REFERÊNCIA C)
                  ================================================================= */}
                  {staff && conversation.status === 'active' && (
                    <div className="border-t border-[#DCE2EA] dark:border-[#344154] pt-2.5 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => void suggestWithAi()}
                          disabled={aiLoading}
                          data-testid="btn-suggest-sac-ai"
                          className="rounded-xl bg-gradient-to-r from-[#7942D8] to-[#9333EA] hover:opacity-95 disabled:opacity-50 text-white px-3.5 py-1.5 font-bold flex items-center gap-1.5 shadow cursor-pointer"
                        >
                          <Sparkles size={13} />
                          <span>
                            {aiLoading
                              ? 'Consultando IA...'
                              : 'Sugerir resposta com IA'}
                          </span>
                        </button>
                        <span className="text-[11px] text-[#526074] dark:text-[#B5C0D0]">
                          Copiloto: não envia mensagens automaticamente.
                        </span>
                      </div>

                      {suggestion && (
                        <div
                          className="rounded-xl border border-[#7942D8]/50 dark:border-[#B66CFF]/50 bg-[#F3E8FF]/90 dark:bg-[#7942D8]/20 text-[#111827] dark:text-[#F7F9FC] p-3 space-y-2"
                          aria-label="Sugestão privada da IA"
                        >
                          <div className="flex flex-wrap justify-between gap-2 text-[11px]">
                            <strong className="text-[#7942D8] dark:text-[#B66CFF]">
                              ✨ Sugestão da IA (Copiloto • {suggestion.model})
                            </strong>
                            <span className="font-semibold text-[#7942D8] dark:text-[#B66CFF]">
                              Confiança:{' '}
                              {suggestion.confidence === null
                                ? 'n/d'
                                : `${Math.round(suggestion.confidence * 100)}%`}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed text-xs">
                            {suggestion.suggestionText}
                          </p>
                          <div className="text-[11px] text-[#7942D8] dark:text-[#B66CFF] font-medium">
                            Fontes aprovadas:{' '}
                            {suggestion.sources
                              .map(s => `${s.title} (${s.category})`)
                              .join(' · ')}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void useSuggestionInEditor()}
                              className="rounded-lg bg-[#7942D8] hover:bg-[#6D28D9] text-white px-3 py-1 font-bold cursor-pointer"
                            >
                              Copiar para editor
                            </button>
                            <button
                              type="button"
                              onClick={() => void discardSuggestion()}
                              className="rounded-lg border border-[#7942D8]/50 dark:border-[#B66CFF]/50 px-3 py-1 font-semibold cursor-pointer text-[#7942D8] dark:text-[#B66CFF]"
                            >
                              Descartar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Barra de Envio de Mensagem */}
                  {conversation.status !== 'closed' && (
                    <form
                      onSubmit={e => void send(e)}
                      className="flex flex-col gap-2 border-t border-[#DCE2EA] dark:border-[#344154] pt-2.5 mt-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#526074] dark:text-[#B5C0D0]">
                            Enviar como:
                          </span>
                          <button
                            type="button"
                            onClick={() => setSenderMode('agent')}
                            className={`px-2.5 py-0.5 rounded-lg font-bold cursor-pointer ${
                              senderMode === 'agent'
                                ? 'bg-[#155EEF] text-white'
                                : 'bg-[#F5F7FA] dark:bg-[#1D2735] text-[#526074] dark:text-[#B5C0D0]'
                            }`}
                          >
                            Atendente SAC
                          </button>
                          <button
                            type="button"
                            onClick={() => setSenderMode('client')}
                            className={`px-2.5 py-0.5 rounded-lg font-bold cursor-pointer ${
                              senderMode === 'client'
                                ? 'bg-[#7942D8] text-white'
                                : 'bg-[#F5F7FA] dark:bg-[#1D2735] text-[#526074] dark:text-[#B5C0D0]'
                            }`}
                          >
                            Simular Resposta do Cliente
                          </button>
                        </div>
                        {conversation.status === 'queued' &&
                          senderMode === 'agent' && (
                            <span className="text-[#BD5D00] dark:text-[#FF9A35] font-semibold">
                              Clique em "Assumir atendimento" para responder como atendente
                            </span>
                          )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          className="flex-1 min-w-0 bg-[#F5F7FA] dark:bg-[#101620] border border-[#DCE2EA] dark:border-[#344154] rounded-xl px-3 py-2 text-xs text-[#111827] dark:text-[#F7F9FC]"
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          maxLength={10000}
                          placeholder="Digite sua mensagem ou revise a sugestão do Copiloto IA..."
                          aria-label="Mensagem"
                        />
                        <button
                          type="submit"
                          disabled={
                            !draft.trim() ||
                            (senderMode === 'agent' &&
                              staff &&
                              conversation.status !== 'active')
                          }
                          className="rounded-xl bg-[#155EEF] hover:bg-[#1D4ED8] disabled:opacity-40 text-white font-bold text-xs px-4 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send size={13} /> Enviar
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <p className="text-[#526074] dark:text-[#B5C0D0] text-sm m-auto">
                  Selecione uma conversa na fila ao lado ou inicie um novo atendimento.
                </p>
              )}
            </section>

            {/* COLUNA 3 (DIREITA - 3 COLUNAS): CONTEXTO 360° DO CLIENTE + SLA EM LARANJA */}
            <aside
              className={`lg:col-span-3 bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-2xl p-4 space-y-3 h-auto lg:h-[620px] overflow-y-auto shadow-xs ${
                mobileChatStep === 'context' ? 'block' : 'hidden lg:block'
              }`}
            >
              <div className="border-b border-[#DCE2EA] dark:border-[#344154] pb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#009AC2] dark:text-[#24DEFF]">
                  Contexto Operacional ERP
                </span>
                <h3 className="text-sm font-black text-[#111827] dark:text-[#F7F9FC] mt-0.5">
                  Ficha do Cliente & SLA
                </h3>
              </div>

              {conversation ? (
                <div className="space-y-3 text-xs">
                  {/* Card SLA do Atendimento em Laranja (como na Referência C) */}
                  <div className="p-3 rounded-xl bg-[#FFF7ED] dark:bg-[#FF9A35]/15 border border-[#FED7AA] dark:border-[#FF9A35]/40 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase text-[#BD5D00] dark:text-[#FF9A35] block">
                      SLA do atendimento ({conversation.ticket.priority || 'P3'})
                    </span>
                    <strong className="text-base font-black text-[#BD5D00] dark:text-[#FF9A35] block">
                      ⏱ {formatRemainingSla(conversation).label}
                    </strong>
                    <div className="h-1.5 rounded-full bg-[#FED7AA] dark:bg-[#101620] overflow-hidden">
                      <div className="h-full bg-[#EA580C] dark:bg-[#FF9A35] w-3/5 rounded-full" />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#526074] dark:text-[#B5C0D0]">
                      <span>
                        Meta: {conversation.ticket.priority === 'P1' ? '15 min' : conversation.ticket.priority === 'P2' ? '30 min' : '60 min'}
                      </span>
                      <span>Skill: {conversation.requiredSkill || 'N1'}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] space-y-1">
                    <span className="text-[10px] text-[#526074] dark:text-[#B5C0D0] uppercase font-bold">
                      Cliente Autenticado
                    </span>
                    <strong className="text-sm text-[#111827] dark:text-[#F7F9FC] block">
                      {conversation.ticket.requesterName}
                    </strong>
                    <span className="text-[#526074] dark:text-[#B5C0D0] block">
                      {conversation.ticket.requesterEmail || 'cliente@safesaff.com.br'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#155EEF] dark:text-[#388BFF] font-bold pt-1">
                      <ShieldCheck size={12} /> Identidade Verificada pela Sessão
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] space-y-1.5">
                    <span className="text-[10px] text-[#526074] dark:text-[#B5C0D0] uppercase font-bold flex items-center gap-1">
                      <ShoppingBag size={12} className="text-[#155EEF] dark:text-[#388BFF]" /> Pedido Vinculado no ERP
                    </span>
                    <div className="flex items-center justify-between">
                      <strong className="font-mono text-[#111827] dark:text-[#F7F9FC]">
                        {conversation.ticket.orderCode || 'ORD-928371'}
                      </strong>
                      <span className="px-2 py-0.5 rounded bg-[#EFF6FF] dark:bg-[#388BFF]/20 text-[#155EEF] dark:text-[#388BFF] text-[10px] font-bold">
                        PAGO • PIX
                      </span>
                    </div>
                    <p className="text-[11px] text-[#526074] dark:text-[#B5C0D0]">
                      {conversation.ticket.eventName ||
                        'Whindersson Nunes - SESSÃO EXTRA 19H'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] space-y-1.5">
                    <span className="text-[10px] text-[#526074] dark:text-[#B5C0D0] uppercase font-bold flex items-center gap-1">
                      <Ticket size={12} className="text-[#7942D8] dark:text-[#B66CFF]" /> Ingressos & Assentos
                    </span>
                    <div className="text-[11px] text-[#111827] dark:text-[#F7F9FC] flex items-center justify-between">
                      <span>Setor VIP Ouro • Fila A05</span>
                      <span className="font-mono text-[#009AC2] dark:text-[#24DEFF]">#00010481</span>
                    </div>
                    <div className="text-[11px] text-[#111827] dark:text-[#F7F9FC] flex items-center justify-between">
                      <span>Setor VIP Ouro • Fila A06</span>
                      <span className="font-mono text-[#009AC2] dark:text-[#24DEFF]">#00010482</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] space-y-1.5">
                    <span className="text-[10px] text-[#526074] dark:text-[#B5C0D0] uppercase font-bold">
                      Carga dos Atendentes SAC (Máx 3)
                    </span>
                    {agents.map(a => (
                      <div
                        key={a.userId}
                        className="flex items-center justify-between text-[11px] py-1 border-b border-[#DCE2EA]/60 dark:border-[#344154]/60 last:border-0"
                      >
                        <span className="text-[#111827] dark:text-[#F7F9FC] truncate">
                          {a.user.name}
                        </span>
                        <span
                          className={`font-bold ${
                            (a.activeChatsCount ?? 0) >= 3
                              ? 'text-[#C1273C] dark:text-[#FF5A78]'
                              : a.status === 'available'
                              ? 'text-[#155EEF] dark:text-[#388BFF]'
                              : 'text-[#BD5D00] dark:text-[#FF9A35]'
                          }`}
                        >
                          {a.activeChatsCount ?? 0}/3 ({a.status})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#526074] dark:text-[#B5C0D0]">
                  Selecione um atendimento para carregar os dados do cliente no ERP.
                </p>
              )}
            </aside>
          </div>

          {/* =====================================================================
              3. BASE DE CONHECIMENTO DA IA (SAC) — GOVERNANÇA DO SUPERVISOR
          ===================================================================== */}
          {staff && (showKnowledgePanel || supervisor) && (
            <section
              className="bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-2xl p-4 space-y-4 shadow-xs"
              aria-label="Base de conhecimento da IA"
            >
              <div className="flex flex-wrap justify-between gap-2 items-center">
                <div>
                  <h2 className="font-bold text-sm text-[#111827] dark:text-[#F7F9FC]">
                    Base de Conhecimento da IA (SAC)
                  </h2>
                  <p className="text-xs text-[#526074] dark:text-[#B5C0D0]">
                    Apenas artigos aprovados pelo supervisor são usados tanto pela Assistente Virtual do Cliente quanto pelo Copiloto dos Atendentes.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#F3E8FF] dark:bg-[#B66CFF]/20 border border-[#D8B4FE] dark:border-[#B66CFF]/40 text-[#7942D8] dark:text-[#B66CFF] text-[11px] font-bold">
                  {knowledge.filter(k => k.status === 'approved').length} artigos aprovados
                </span>
              </div>

              {supervisor && (
                <form
                  onSubmit={e => void createArticle(e)}
                  className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs bg-[#F5F7FA] dark:bg-[#101620] border border-[#DCE2EA] dark:border-[#344154] rounded-xl p-3"
                >
                  <input
                    className="bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-lg p-2 text-[#111827] dark:text-[#F7F9FC]"
                    value={kbTitle}
                    onChange={e => setKbTitle(e.target.value)}
                    placeholder="Título do artigo (ex: Cancelamento por Chuva Forte)"
                    minLength={3}
                    maxLength={160}
                    required
                  />
                  <select
                    className="bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-lg p-2 text-[#111827] dark:text-[#F7F9FC]"
                    value={kbCategory}
                    onChange={e => setKbCategory(e.target.value)}
                  >
                    <option value="Cancelamento de show">Cancelamento de show</option>
                    <option value="Reembolso">Reembolso</option>
                    <option value="Ingressos">Ingressos</option>
                    <option value="Alteração de evento">Alteração de evento</option>
                    <option value="Problemas de pagamento">Problemas de pagamento</option>
                    <option value="Reclamações">Reclamações</option>
                  </select>
                  <input
                    className="bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-lg p-2 text-[#111827] dark:text-[#F7F9FC]"
                    value={kbTags}
                    onChange={e => setKbTags(e.target.value)}
                    placeholder="Tags separadas por vírgula"
                    maxLength={240}
                  />
                  <textarea
                    className="md:col-span-2 bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-lg p-2 text-[#111827] dark:text-[#F7F9FC]"
                    rows={2}
                    value={kbContent}
                    onChange={e => setKbContent(e.target.value)}
                    placeholder="Conteúdo oficial que a IA pode utilizar para orientar clientes e atendentes..."
                    minLength={20}
                    maxLength={20000}
                    required
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#7942D8] hover:bg-[#6D28D9] text-white font-bold px-3 py-2 cursor-pointer"
                  >
                    Salvar rascunho de artigo
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                {knowledge.map(article => (
                  <div
                    key={article.id}
                    className="border border-[#DCE2EA] dark:border-[#344154] bg-[#F5F7FA] dark:bg-[#1D2735] rounded-xl p-3 space-y-1.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between gap-2 items-start">
                        <strong className="text-[#111827] dark:text-[#F7F9FC] leading-snug">
                          {article.title}
                        </strong>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            article.status === 'approved'
                              ? 'bg-[#EFF6FF] dark:bg-[#388BFF]/20 text-[#155EEF] dark:text-[#388BFF] border border-[#BFDBFE] dark:border-[#388BFF]/40'
                              : article.status === 'draft'
                              ? 'bg-[#FFF7ED] dark:bg-[#FF9A35]/20 text-[#BD5D00] dark:text-[#FF9A35] border border-[#FED7AA] dark:border-[#FF9A35]/40'
                              : 'bg-[#EEF2F6] dark:bg-[#101620] text-[#526074] dark:text-[#B5C0D0]'
                          }`}
                        >
                          {article.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#7942D8] dark:text-[#B66CFF] font-semibold">
                        {article.category} {article.tags ? `· ${article.tags}` : ''}
                      </div>
                      <p className="text-[#526074] dark:text-[#B5C0D0] line-clamp-3 leading-relaxed">
                        {article.content}
                      </p>
                    </div>

                    {supervisor && (
                      <div className="flex gap-2 pt-2 border-t border-[#DCE2EA] dark:border-[#344154]">
                        {article.status !== 'approved' && (
                          <button
                            type="button"
                            className="rounded bg-[#155EEF] hover:bg-[#1D4ED8] text-white px-2.5 py-1 font-bold cursor-pointer"
                            onClick={() =>
                              void action(
                                () =>
                                  sacAiApi.updateKnowledge(
                                    article.id,
                                    { status: 'approved' },
                                    producerId
                                  ),
                                `Artigo "${article.title}" aprovado para uso da IA!`
                              )
                            }
                          >
                            Aprovar
                          </button>
                        )}
                        {article.status !== 'archived' && (
                          <button
                            type="button"
                            className="rounded border border-[#DCE2EA] dark:border-[#344154] hover:bg-white dark:hover:bg-[#151C27] text-[#526074] dark:text-[#B5C0D0] px-2.5 py-1 cursor-pointer"
                            onClick={() =>
                              void action(
                                () =>
                                  sacAiApi.updateKnowledge(
                                    article.id,
                                    { status: 'archived' },
                                    producerId
                                  ),
                                `Artigo "${article.title}" arquivado.`
                              )
                            }
                          >
                            Arquivar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
