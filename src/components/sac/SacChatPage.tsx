import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRightLeft,
  BookOpen,
  Bot,
  CheckCircle2,
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
  const [sacView, setSacView] = useState<'dashboard' | 'chat'>(initialView)
  const [list, setList] = useState<SacConversation[]>([])
  const [staff, setStaff] = useState(true)
  const [supervisor, setSupervisor] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  const [messages, setMessages] = useState<SacMessage[]>([])
  const [availability, setAvailability] = useState<'available' | 'busy' | 'offline'>('available')
  const [activeAgentId, setActiveAgentId] = useState<number>(101)
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
  const [agents, setAgents] = useState<SacAgentInfo[]>([])
  const [target, setTarget] = useState('')

  // Estado do Copiloto IA do Atendente
  const [suggestion, setSuggestion] = useState<SacAiSuggestion | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Estado da Base de Conhecimento da IA (SAC)
  const [knowledge, setKnowledge] = useState<SacKnowledgeArticle[]>([])
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
    if (!staff || availability === 'offline') return
    const heartbeat = setInterval(
      () =>
        void sacChatApi
          .status(availability, producerId, activeAgentId)
          .catch(e => setError(e.message)),
      20000
    )
    return () => clearInterval(heartbeat)
  }, [staff, availability, producerId, activeAgentId])

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

  // Interação do Cliente com a Assistente Virtual SafeSaff (N1)
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
    const transcriptSummary = botTurns
      .slice(-4)
      .map(t => `${t.sender === 'client' ? 'Cliente' : 'IA SafeSaff'}: ${t.text}`)
      .join('\n')

    const initialMessage = `[Triagem IA SafeSaff • Assunto: ${chosen.label} • Prioridade sugerida: ${chosen.priority} • Skill recomendada: ${chosen.requiredSkill} • Pedido: ${clientOrderCode}]\n\nResumo da conversa com a Assistente Virtual:\n${transcriptSummary}`

    recordSacAiOutcome('transferred_to_human')

    await action(async () => {
      const created = await sacChatApi.create(
        `[IA → SAC] ${chosen.label} (${clientOrderCode})`,
        initialMessage,
        producerId,
        clientName.trim() || 'Fernanda Lima Souza'
      )
      setSelected(created.id)
      setFeedback(
        created.status === 'active'
          ? `🤖➡️👤 IA transferiu o atendimento ${created.ticket.code} (${chosen.label}) com histórico completo para ${created.assignedAgent?.name}!`
          : `🤖➡️⏳ IA transferiu o atendimento ${created.ticket.code} (${chosen.label}) para a Fila Central do SAC preservando todo o histórico.`
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
    <main className="p-4 md:p-6 space-y-4 text-slate-100" aria-label="Chat do SAC">
      {/* Barra de Alternância Rápida: Dashboard SAC vs Chat Operacional */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSacView('dashboard')}
            data-testid="tab-sac-dashboard-view"
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              sacView === 'dashboard'
                ? 'bg-[#157347] text-white shadow'
                : 'bg-slate-900 text-slate-300 hover:text-white'
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
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            💬 Operação Chat SAC + IA ({kpis.queued} na fila • {kpis.myActive}/3 ativos)
          </button>
        </div>

        <span className="text-[11px] text-slate-400 pr-2">
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
          <header className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-wrap justify-between gap-4 items-center shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                <Headphones size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-white">Central SAC — Chat</h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    IA Cliente N1 + Copiloto Atendente
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Distribuição automática ativada • Assumir manualmente • Limite de 3 conversas simultâneas por atendente • Supervisão SAC
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {staff && (
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
                  <span className="text-slate-400 font-semibold">Operador:</span>
                  <select
                    value={activeAgentId}
                    onChange={e => setActiveAgentId(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white font-bold text-xs"
                  >
                    {agents.map(a => (
                      <option key={a.userId} value={a.userId}>
                        {a.user.name}
                      </option>
                    ))}
                  </select>

                  <span className="text-slate-400 font-semibold ml-1">Meu status:</span>
                  <select
                    aria-label="Disponibilidade SAC"
                    className={`border rounded-lg px-2.5 py-1 font-bold text-xs ${
                      availability === 'available'
                        ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300'
                        : availability === 'busy'
                        ? 'bg-amber-950 border-amber-500/50 text-amber-300'
                        : 'bg-slate-950 border-slate-700 text-slate-400'
                    }`}
                    value={availability}
                    onChange={e =>
                      void changeAvailability(e.target.value as typeof availability)
                    }
                  >
                    <option value="available">🟢 Disponível</option>
                    <option value="busy">🟡 Ocupado</option>
                    <option value="offline">⚪ Ausente</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowCustomerAiAssistant(prev => !prev)}
                data-testid="btn-toggle-customer-ai"
                className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer border ${
                  showCustomerAiAssistant
                    ? 'bg-[#157347] border-emerald-400/50 text-white'
                    : 'bg-slate-900 border-slate-700 text-emerald-300 hover:bg-slate-800'
                }`}
              >
                <Bot size={15} />
                <span>🤖 IA do Cliente (Temas & Reembolso)</span>
              </button>

              {staff && (
                <button
                  type="button"
                  onClick={() => setShowKnowledgePanel(prev => !prev)}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen size={14} />
                  <span>Base IA ({knowledge.filter(k => k.status === 'approved').length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowNewClientChatModal(prev => !prev)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
              >
                <MessageSquarePlus size={15} />
                <span>+ Novo Protocolo Direto</span>
              </button>
            </div>
          </header>

          {/* =====================================================================
              CAMADA 1: ASSISTENTE VIRTUAL SAFESAFF (IA PARA O CLIENTE — TEMAS, PERGUNTAS E RESPOSTAS + ENCAMINHAMENTO AO SAC)
          ===================================================================== */}
          {showCustomerAiAssistant && (
            <section
              className="bg-gradient-to-br from-[#0F291E] via-[#111827] to-[#111827] border border-emerald-500/40 rounded-2xl p-4 shadow-xl space-y-3"
              data-testid="customer-ai-virtual-assistant"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#157347] text-white flex items-center justify-center shadow">
                    <Bot size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-white">
                        Assistente Virtual SafeSaff — IA de Atendimento ao Cliente
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Online · IA + Equipe SAC
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      O cliente escolhe o tema desejado (ex.: Cancelamento de show, Solicitar reembolso, Ingressos e acesso), recebe orientação imediata da IA e pode transferir para um atendente humano a qualquer momento.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white w-44"
                    placeholder="Nome do Cliente"
                  />
                  <input
                    type="text"
                    value={clientOrderCode}
                    onChange={e => setClientOrderCode(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-emerald-300 w-28"
                    placeholder="Pedido"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Coluna Esquerda: Botões de Temas e Perguntas Guiadas */}
                <div className="lg:col-span-5 space-y-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                    1. Temas Rápidos para o Cliente (Clique para testar)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
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
                              ? 'bg-[#157347]/30 border-emerald-400 text-white shadow'
                              : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          <strong className="block font-bold text-white">
                            {topic.label}
                          </strong>
                          <span className="text-[10px] text-emerald-300/90 block mt-0.5">
                            {topic.badge} • Skill: {topic.requiredSkill}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {activeClientTopic && (
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <span className="text-[11px] font-bold text-slate-300 block">
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
                                ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/30'
                                : 'bg-emerald-950 border-emerald-500/40 text-emerald-200 hover:bg-emerald-900'
                            }`}
                          >
                            {fp.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={handleMarkResolvedByAi}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                        >
                          ✓ Dúvida resolvida pela IA
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna Direita: Conversa Interativa do Cliente com a Assistente Virtual SafeSaff */}
                <div className="lg:col-span-7 bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 flex flex-col h-72">
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {botTurns.map(turn => (
                      <div
                        key={turn.id}
                        className={`rounded-xl p-2.5 text-xs ${
                          turn.sender === 'ai'
                            ? 'bg-[#12261E] border border-emerald-500/30 text-slate-100 mr-8'
                            : 'bg-[#157347] text-white ml-12'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] opacity-80 mb-1">
                          <strong>
                            {turn.sender === 'ai'
                              ? '🤖 Assistente Virtual SafeSaff (IA)'
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
                    className="pt-2.5 mt-2 border-t border-slate-800 flex gap-2"
                  >
                    <input
                      type="text"
                      value={clientCustomQuestion}
                      onChange={e => setClientCustomQuestion(e.target.value)}
                      placeholder="Digite uma dúvida do cliente (ex: O show foi cancelado, como recebo meu PIX de volta?)..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-xl bg-[#157347] hover:bg-[#115c39] text-white font-bold text-xs cursor-pointer"
                    >
                      Perguntar à IA
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleHandoffCustomerAiToHuman(activeClientTopic)}
                      data-testid="btn-handoff-ai-to-sac"
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer"
                    >
                      Falar com Atendente SAC
                    </button>
                  </form>
                </div>
              </div>
            </section>
          )}

          {/* Strip de KPIs da Fila e Capacidade (Limite de 3 por Atendente) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                  Na Fila SAC
                </span>
                <strong className="text-2xl font-black text-white">{kpis.queued}</strong>
                <span className="text-[11px] text-slate-400 block">
                  Aguardando atribuição
                </span>
              </div>
              <Clock size={22} className="text-amber-400" />
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Meus Atendimentos
                </span>
                <strong className="text-2xl font-black text-white">
                  {kpis.myActive} <span className="text-sm text-slate-400">/ 3 máx</span>
                </strong>
                <span className="text-[11px] text-slate-400 block">
                  {kpis.myActive >= 3
                    ? 'Capacidade máxima atingida'
                    : `${3 - kpis.myActive} vaga(s) livre(s)`}
                </span>
              </div>
              <UserCheck size={22} className="text-emerald-400" />
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 block">
                  Ativos no SAC
                </span>
                <strong className="text-2xl font-black text-white">{kpis.activeAll}</strong>
                <span className="text-[11px] text-slate-400 block">
                  Conversas em andamento
                </span>
              </div>
              <Headphones size={22} className="text-blue-400" />
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 block">
                  Atendentes Online
                </span>
                <strong className="text-2xl font-black text-white">
                  {kpis.onlineAgents}
                </strong>
                <span className="text-[11px] text-slate-400 block">
                  Supervisão SAC ativa
                </span>
              </div>
              <Users size={22} className="text-purple-400" />
            </div>
          </div>

          {/* Alertas e Feedbacks */}
          {error && (
            <div
              role="alert"
              className="bg-rose-950/90 border border-rose-500/50 text-rose-200 rounded-xl p-3 text-xs flex items-center justify-between"
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
            <div className="bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 rounded-xl p-3 text-xs flex items-center justify-between">
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
              className="bg-[#111827] border border-blue-500/40 rounded-2xl p-4 space-y-3 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-white">
                  Abrir Nova Conversa no Chat SAC (Portal do Cliente ERP)
                </h2>
                {staff && (
                  <button
                    type="button"
                    onClick={() => setShowNewClientChatModal(false)}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    ✕ Fechar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Nome do Cliente"
                />
                <input
                  className="bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                rows={2}
                maxLength={10000}
                required
                value={intro}
                onChange={e => setIntro(e.target.value)}
                placeholder="Descreva sua solicitação para a equipe do SAC..."
                aria-label="Mensagem inicial"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Se houver atendente disponível com menos de 3 chats ativos, a conversa será atribuída automaticamente; caso contrário, entrará na Fila SAC.
                </span>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl px-4 py-2 cursor-pointer"
                >
                  Iniciar Chat SAC
                </button>
              </div>
            </form>
          )}

          {/* =====================================================================
              2. LAYOUT OPERACIONAL EM 3 COLUNAS (FILA SAC | CHAT + COPILOTO IA | CONTEXTO DO CLIENTE NO ERP)
          ===================================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* COLUNA 1 (ESQUERDA - 3 COLUNAS): FILA DE ESPERA & MEUS ATENDIMENTOS */}
            <aside
              className="lg:col-span-3 bg-[#111827] border border-slate-800 rounded-2xl p-3.5 space-y-3 flex flex-col h-[620px]"
              aria-label="Lista de atendimentos"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-sm text-white">
                  Conversas ({filtered.length})
                </h2>
                <button
                  type="button"
                  className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 cursor-pointer"
                  onClick={() => void refresh()}
                >
                  <RefreshCw size={12} /> Atualizar
                </button>
              </div>

              {staff && (
                <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
                  {(
                    [
                      { id: 'all' as const, label: 'Todas' },
                      { id: 'queued' as const, label: `Fila (${kpis.queued})` },
                      { id: 'mine' as const, label: `Meus (${kpis.myActive})` },
                      { id: 'active' as const, label: 'Ativas' },
                      { id: 'closed' as const, label: 'Fim' }
                    ] as const
                  ).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilter(tab.id)}
                      className={`py-1.5 rounded-lg cursor-pointer ${
                        filter === tab.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white'
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
                      onClick={() => setSelected(c.id)}
                      className={`block w-full text-left border rounded-xl p-3 transition cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-950/40 shadow'
                          : 'border-slate-800 bg-slate-900/70 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-[10px] font-bold text-blue-400">
                          {c.ticket.code}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'queued'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : c.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {c.status === 'queued'
                            ? 'Na fila'
                            : c.status === 'active'
                            ? 'Em atendimento'
                            : 'Encerrada'}
                        </span>
                      </div>
                      <span className="block font-bold text-xs text-white truncate">
                        {c.ticket.requesterName}
                      </span>
                      <span className="block text-[11px] text-slate-400 truncate mt-0.5">
                        {c.ticket.subject}
                      </span>
                      {c.assignedAgent && (
                        <span className="block text-[10px] text-emerald-400 mt-1 font-semibold">
                          👤 {c.assignedAgent.name}
                        </span>
                      )}
                    </button>
                  )
                })}
                {!filtered.length && (
                  <p className="text-xs text-slate-500 text-center py-8">
                    Nenhuma conversa neste filtro.
                  </p>
                )}
              </div>
            </aside>

            {/* COLUNA 2 (CENTRO - 6 COLUNAS): CONVERSA EM TEMPO REAL + COPILOTO IA DO ATENDENTE */}
            <section
              className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-col h-[620px]"
              aria-label="Conversa selecionada"
            >
              {conversation ? (
                <>
                  <div className="flex flex-wrap gap-2 justify-between items-start border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-blue-400">
                          {conversation.ticket.code}
                        </span>
                        <h2 className="font-bold text-sm text-white">
                          {conversation.ticket.subject}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Cliente:{' '}
                        <strong className="text-slate-200">
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
                            className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs font-bold shadow cursor-pointer"
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
                              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
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
                              className="border border-slate-700 bg-slate-800 hover:bg-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-200 flex items-center gap-1 cursor-pointer"
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
                            className="rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-3 py-1.5 text-xs font-bold cursor-pointer"
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

                  {/* Histórico de Mensagens */}
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
                              ? 'bg-slate-900/60 border-slate-800 text-amber-300 text-center'
                              : isClient
                              ? 'bg-slate-900 border-slate-800 text-slate-200 mr-8'
                              : 'bg-blue-950/50 border-blue-500/40 text-blue-100 ml-8'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <strong className="text-slate-200">{m.author}</strong>
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
                      CAMADA 2: COPILOTO IA DO ATENDENTE SAC (REVISÃO HUMANA OBRIGATÓRIA)
                  ================================================================= */}
                  {staff && conversation.status === 'active' && (
                    <div className="border-t border-slate-800 pt-2.5 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => void suggestWithAi()}
                          disabled={aiLoading}
                          data-testid="btn-suggest-sac-ai"
                          className="rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 font-bold flex items-center gap-1.5 shadow cursor-pointer"
                        >
                          <Sparkles size={13} />
                          <span>
                            {aiLoading
                              ? 'Consultando IA...'
                              : 'Sugerir resposta com IA'}
                          </span>
                        </button>
                        <span className="text-[11px] text-slate-400">
                          Copiloto: não envia mensagens automaticamente.
                        </span>
                      </div>

                      {suggestion && (
                        <div
                          className="rounded-xl border border-emerald-500/50 bg-emerald-950/80 text-emerald-100 p-3 space-y-2"
                          aria-label="Sugestão privada da IA"
                        >
                          <div className="flex flex-wrap justify-between gap-2 text-[11px]">
                            <strong>
                              🤖 Sugestão privada ao atendente ({suggestion.model})
                            </strong>
                            <span>
                              Confiança:{' '}
                              {suggestion.confidence === null
                                ? 'n/d'
                                : `${Math.round(suggestion.confidence * 100)}%`}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed text-xs">
                            {suggestion.suggestionText}
                          </p>
                          <div className="text-[11px] text-emerald-300">
                            Fontes aprovadas:{' '}
                            {suggestion.sources
                              .map(s => `${s.title} (${s.category})`)
                              .join(' · ')}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void useSuggestionInEditor()}
                              className="rounded-lg bg-white text-emerald-950 px-3 py-1 font-bold cursor-pointer hover:bg-emerald-100"
                            >
                              Copiar para editor
                            </button>
                            <button
                              type="button"
                              onClick={() => void discardSuggestion()}
                              className="rounded-lg border border-emerald-400/50 px-3 py-1 font-semibold cursor-pointer hover:bg-emerald-900"
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
                      className="flex flex-col gap-2 border-t border-slate-800 pt-2.5 mt-2"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Enviar como:</span>
                          <button
                            type="button"
                            onClick={() => setSenderMode('agent')}
                            className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                              senderMode === 'agent'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            Atendente SAC
                          </button>
                          <button
                            type="button"
                            onClick={() => setSenderMode('client')}
                            className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                              senderMode === 'client'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            Simular Resposta do Cliente
                          </button>
                        </div>
                        {conversation.status === 'queued' &&
                          senderMode === 'agent' && (
                            <span className="text-amber-400 font-semibold">
                              Clique em "Assumir atendimento" para responder como atendente
                            </span>
                          )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          maxLength={10000}
                          placeholder="Escreva sua mensagem ou revise a sugestão do Copiloto IA..."
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
                          className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs px-4 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send size={13} /> Enviar
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <p className="text-slate-500 text-sm m-auto">
                  Selecione uma conversa na fila ao lado ou inicie um novo atendimento.
                </p>
              )}
            </section>

            {/* COLUNA 3 (DIREITA - 3 COLUNAS): CONTEXTO 360° DO CLIENTE NO ERP */}
            <aside className="lg:col-span-3 bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-3 h-[620px] overflow-y-auto">
              <div className="border-b border-slate-800 pb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  Contexto Operacional ERP
                </span>
                <h3 className="text-sm font-black text-white mt-0.5">
                  Ficha do Cliente & Pedidos
                </h3>
              </div>

              {conversation ? (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">
                      Cliente Autenticado
                    </span>
                    <strong className="text-sm text-white block">
                      {conversation.ticket.requesterName}
                    </strong>
                    <span className="text-slate-400 block">
                      {conversation.ticket.requesterEmail || 'cliente@safesaff.com.br'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold pt-1">
                      <ShieldCheck size={12} /> Identidade Verificada pela Sessão
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                      <ShoppingBag size={12} className="text-blue-400" /> Pedido Vinculado no ERP
                    </span>
                    <div className="flex items-center justify-between">
                      <strong className="font-mono text-white">
                        {conversation.ticket.orderCode || 'ORD-928371'}
                      </strong>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        PAGO • PIX
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {conversation.ticket.eventName ||
                        'Whindersson Nunes - SESSÃO EXTRA 19H'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                      <Ticket size={12} className="text-purple-400" /> Ingressos & Assentos
                    </span>
                    <div className="text-[11px] text-slate-200 flex items-center justify-between">
                      <span>Setor VIP Ouro • Fila A05</span>
                      <span className="font-mono text-cyan-300">#00010481</span>
                    </div>
                    <div className="text-[11px] text-slate-200 flex items-center justify-between">
                      <span>Setor VIP Ouro • Fila A06</span>
                      <span className="font-mono text-cyan-300">#00010482</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">
                      Carga dos Atendentes SAC (Máx 3)
                    </span>
                    {agents.map(a => (
                      <div
                        key={a.userId}
                        className="flex items-center justify-between text-[11px] py-1 border-b border-slate-800/60 last:border-0"
                      >
                        <span className="text-slate-200 truncate">{a.user.name}</span>
                        <span
                          className={`font-bold ${
                            (a.activeChatsCount ?? 0) >= 3
                              ? 'text-rose-400'
                              : a.status === 'available'
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {a.activeChatsCount ?? 0}/3 ({a.status})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
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
              className="bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-4"
              aria-label="Base de conhecimento da IA"
            >
              <div className="flex flex-wrap justify-between gap-2 items-center">
                <div>
                  <h2 className="font-bold text-sm text-white">
                    Base de Conhecimento da IA (SAC)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Apenas artigos aprovados pelo supervisor são usados tanto pela Assistente Virtual do Cliente quanto pelo Copiloto dos Atendentes.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                  {knowledge.filter(k => k.status === 'approved').length} artigos aprovados
                </span>
              </div>

              {supervisor && (
                <form
                  onSubmit={e => void createArticle(e)}
                  className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs bg-slate-950/70 border border-slate-800 rounded-xl p-3"
                >
                  <input
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    value={kbTitle}
                    onChange={e => setKbTitle(e.target.value)}
                    placeholder="Título do artigo (ex: Cancelamento por Chuva Forte)"
                    minLength={3}
                    maxLength={160}
                    required
                  />
                  <select
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
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
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    value={kbTags}
                    onChange={e => setKbTags(e.target.value)}
                    placeholder="Tags separadas por vírgula"
                    maxLength={240}
                  />
                  <textarea
                    className="md:col-span-2 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
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
                    className="rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-2 cursor-pointer"
                  >
                    Salvar rascunho de artigo
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                {knowledge.map(article => (
                  <div
                    key={article.id}
                    className="border border-slate-800 bg-slate-900/80 rounded-xl p-3 space-y-1.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between gap-2 items-start">
                        <strong className="text-white leading-snug">
                          {article.title}
                        </strong>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            article.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : article.status === 'draft'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {article.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-cyan-300 font-semibold">
                        {article.category} {article.tags ? `· ${article.tags}` : ''}
                      </div>
                      <p className="text-slate-300 line-clamp-3 leading-relaxed">
                        {article.content}
                      </p>
                    </div>

                    {supervisor && (
                      <div className="flex gap-2 pt-2 border-t border-slate-800">
                        {article.status !== 'approved' && (
                          <button
                            type="button"
                            className="rounded bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1 font-bold cursor-pointer"
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
                            className="rounded border border-slate-700 hover:bg-slate-800 text-slate-300 px-2.5 py-1 cursor-pointer"
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
