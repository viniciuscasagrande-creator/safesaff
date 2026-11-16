import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Headphones,
  MessageSquarePlus,
  RefreshCw,
  Send,
  ShieldCheck,
  ShoppingBag,
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
import { SacDashboardPage } from './dashboard/SacDashboardPage'

interface Props {
  producerId?: number | null
  initialView?: 'dashboard' | 'chat'
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

  async function refresh() {
    try {
      const result = await sacChatApi.list(producerId)
      setList(result.rows)
      setStaff(result.staff)
      setSupervisor(result.supervisor)
      setSelected(prev => prev ?? result.rows[0]?.id ?? null)
      const ags = await sacChatApi.agents(producerId)
      setAgents(ags)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 2800)
    const onSync = () => void refresh()
    window.addEventListener('safesaff:sac-chat-sync', onSync)
    return () => {
      clearInterval(timer)
      window.removeEventListener('safesaff:sac-chat-sync', onSync)
    }
  }, [producerId])

  useEffect(() => {
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
      setDraft('')
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
      {/* Barra de Alternância Rápida: Dashboard SAC (SLA, ITIL, Alerta Sonoro & Skills) vs Chat Operacional */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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
            📊 Dashboard SAC (Eficiência, Fila c/ Alerta Sonoro, SLA/ITIL & Skills)
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
            💬 Operação Chat SAC em Tempo Real ({kpis.queued} na fila • {kpis.myActive}/3 ativos)
          </button>
        </div>

        <span className="text-[11px] text-slate-400 pr-2">
          Central Integrada SAC SafeSaff • SLA & ITIL + IA Copiloto
        </span>
      </div>

      {sacView === 'dashboard' ? (
        <SacDashboardPage onOpenLiveChat={() => setSacView('chat')} />
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
                Tempo Real • Exclusivo SAC
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Distribuição automática ativada • Assumir manualmente • Limite de 3 conversas simultâneas por atendente • Supervisão SAC
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Atendente Logado + Disponibilidade */}
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
            onClick={() => setShowNewClientChatModal(prev => !prev)}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
          >
            <MessageSquarePlus size={15} />
            <span>+ Simular Chat do Cliente</span>
          </button>
        </div>
      </header>

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
              placeholder="Assunto do atendimento (ex: Transferência de ingresso, 2ª via QR Code...)"
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
          2. LAYOUT OPERACIONAL EM 3 COLUNAS (FILA SAC | CHAT ATIVO | CONTEXTO DO CLIENTE NO ERP)
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* COLUNA 1 (ESQUERDA - 3 COLUNAS): FILA DE ESPERA & MEUS ATENDIMENTOS */}
        <aside
          className="lg:col-span-3 bg-[#111827] border border-slate-800 rounded-2xl p-3.5 space-y-3 flex flex-col h-[580px]"
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

          {/* Abas rápidas da Fila */}
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

        {/* COLUNA 2 (CENTRO - 6 COLUNAS): CONVERSA EM TEMPO REAL */}
        <section
          className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-col h-[580px]"
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
                    Cliente: <strong className="text-slate-200">{conversation.ticket.requesterName}</strong>
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
                className="flex-1 overflow-y-auto space-y-3 py-4 pr-1"
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
                        <span>{new Date(m.createdAt).toLocaleTimeString('pt-BR')}</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">
                        {m.body}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Barra de Envio de Mensagem */}
              {conversation.status !== 'closed' && (
                <form
                  onSubmit={e => void send(e)}
                  className="flex flex-col gap-2 border-t border-slate-800 pt-3"
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
                    {conversation.status === 'queued' && senderMode === 'agent' && (
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
                      placeholder="Escreva sua mensagem em tempo real..."
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
        <aside className="lg:col-span-3 bg-[#111827] border border-slate-800 rounded-2xl p-4 space-y-3 h-[580px] overflow-y-auto">
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
        </>
      )}
    </main>
  )
}
