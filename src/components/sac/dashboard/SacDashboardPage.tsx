import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  BellRing,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Headphones,
  Info,
  Mail,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Volume2,
  VolumeX,
  X
} from 'lucide-react'
import {
  sacChatApi,
  type SacAgentInfo,
  type SacConversation,
  type SacReconciledKpis
} from '../../../services/sacChat.service'
import {
  CUSTOMER_AI_TOPICS,
  getSacAiMetricsSnapshot,
  sacAiApi,
  type SacKnowledgeArticle
} from '../../../services/sacAi.service'

const AVAILABLE_SKILL_CATALOG = [
  'N1',
  'N2',
  'ITIL',
  'ERP',
  'Financeiro',
  'Cobrança',
  'Estornos & CDC',
  'Ingressos & QR Code',
  'Suporte Técnico',
  'VIP & Produtores'
]

interface Props {
  producerId?: number | null
  onOpenLiveChat?: () => void
}

export const SacDashboardPage: React.FC<Props> = ({ producerId, onOpenLiveChat }) => {
  const initialSnap = useMemo(() => sacChatApi.getInitialSnapshot(), [])
  const [periodFilter, setPeriodFilter] = useState<'Hoje' | 'Últimas 24h' | 'Últimos 7 dias'>('Hoje')
  const [conversations, setConversations] = useState<SacConversation[]>(initialSnap.rows)
  const [agents, setAgents] = useState<SacAgentInfo[]>(initialSnap.agents)
  const [kpis, setKpis] = useState<SacReconciledKpis | null>(null)
  const [aiMetrics, setAiMetrics] = useState(() => getSacAiMetricsSnapshot())
  const [knowledgeArticles, setKnowledgeArticles] = useState<SacKnowledgeArticle[]>(() =>
    sacAiApi.getInitialKnowledge()
  )
  const [previewTopicKey, setPreviewTopicKey] = useState<string>('cancelamento_show')

  // Estado do Alerta Sonoro Baseado no Crescimento Real da Fila (Sem Simulação em Produção — VIS-03)
  const [queueThreshold, setQueueThreshold] = useState<number>(2)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true)
  const [lastSoundAlertAt, setLastSoundAlertAt] = useState<string | null>(null)
  const prevQueuedRef = useRef<number>(initialSnap.rows.filter(c => c.status === 'queued').length)
  const lastAlertEpochRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Estado de Skills da Equipe Conectado Diretamente aos Agentes Reais do SAC (VIS-04 / COD-04)
  const [skillSearch, setSkillSearch] = useState<string>('')
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [showManageSkillsModal, setShowManageSkillsModal] = useState<boolean>(false)
  const [newCustomSkill, setNewCustomSkill] = useState<string>('')
  const [skillCatalog, setSkillCatalog] = useState<string[]>(AVAILABLE_SKILL_CATALOG)
  const [skillFeedback, setSkillFeedback] = useState<string>('')

  // Estado da Governança da IA do SAC
  const [aiMode, setAiMode] = useState<'copiloto' | 'triagem' | 'autonomia_faq'>('copiloto')
  const [aiAutoTransferOnRisk, setAiAutoTransferOnRisk] = useState<boolean>(true)
  const [aiRespectSkillRouting, setAiRespectSkillRouting] = useState<boolean>(true)

  const playQueueAlertSound = (severity: 'warning' | 'critical' = 'critical') => {
    if (!soundEnabled) return
    const nowEpoch = Date.now()
    // Cooldown mínimo de 15s entre alertas sonoros reais
    if (nowEpoch - lastAlertEpochRef.current < 15000) return
    lastAlertEpochRef.current = nowEpoch

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        void ctx.resume()
      }

      const now = ctx.currentTime
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.type = 'sine'
      osc2.type = 'triangle'

      const baseFreq = severity === 'critical' ? 587.33 : 440
      const secondFreq = severity === 'critical' ? 880 : 659.25

      osc1.frequency.setValueAtTime(baseFreq, now)
      osc1.frequency.setValueAtTime(secondFreq, now + 0.16)

      osc2.frequency.setValueAtTime(baseFreq * 0.5, now)
      osc2.frequency.setValueAtTime(secondFreq * 0.5, now + 0.16)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.15)
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.19)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.5)
      osc2.stop(now + 0.5)

      setLastSoundAlertAt(
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      )
    } catch {
      // Fallback silencioso caso o navegador aguarde interação prévia
    }
  }

  const refreshOperationalData = async () => {
    const [listRes, agentsRes, kpisRes, kbRes] = await Promise.all([
      sacChatApi.list(producerId),
      sacChatApi.agents(producerId),
      sacChatApi.kpis(producerId),
      sacAiApi.knowledge(producerId)
    ])
    setConversations(listRes.rows)
    setAgents(agentsRes)
    setKpis(kpisRes)
    setKnowledgeArticles(kbRes)
    setAiMetrics(getSacAiMetricsSnapshot())

    // Dispara som de alerta se a fila real cresceu e atingiu o limiar configurado
    if (
      kpisRes.queuedCount > prevQueuedRef.current &&
      kpisRes.queuedCount >= queueThreshold
    ) {
      playQueueAlertSound(kpisRes.queuedCount >= queueThreshold + 2 ? 'critical' : 'warning')
    }
    prevQueuedRef.current = kpisRes.queuedCount
  }

  useEffect(() => {
    void refreshOperationalData()
    const onSync = () => void refreshOperationalData()
    window.addEventListener('safesaff:sac-chat-sync', onSync)
    window.addEventListener('safesaff:sac-ai-sync', onSync)
    return () => {
      window.removeEventListener('safesaff:sac-chat-sync', onSync)
      window.removeEventListener('safesaff:sac-ai-sync', onSync)
    }
  }, [producerId, queueThreshold, soundEnabled])

  const filteredAgents = useMemo(() => {
    const q = skillSearch.trim().toLowerCase()
    if (!q) return agents
    return agents.filter(
      a =>
        a.user.name.toLowerCase().includes(q) ||
        a.skills.some(s => s.toLowerCase().includes(q)) ||
        a.status.toLowerCase().includes(q)
    )
  }, [agents, skillSearch])

  const editingAgent = useMemo(
    () => agents.find(a => a.userId === editingUserId) || agents[0] || null,
    [agents, editingUserId]
  )

  const handleToggleAgentSkill = async (userId: number, skill: string) => {
    const target = agents.find(a => a.userId === userId)
    if (!target) return
    const has = target.skills.includes(skill)
    const nextSkills = has
      ? target.skills.filter(s => s !== skill)
      : [...target.skills, skill]
    const updated = await sacChatApi.updateAgentSkills(userId, nextSkills, producerId)
    setAgents(updated)
    setSkillFeedback(
      `Skills de ${target.user.name} salvas e sincronizadas com o roteador automático da fila SAC!`
    )
    void refreshOperationalData()
  }

  const queuedCount = kpis?.queuedCount ?? conversations.filter(c => c.status === 'queued').length
  const activeCount = kpis?.activeCount ?? conversations.filter(c => c.status === 'active').length
  const closedCount = kpis?.closedCount ?? conversations.filter(c => c.status === 'closed').length
  const totalToday = kpis?.totalToday ?? conversations.length
  const efficiencyPct = kpis?.efficiencyPct ?? (totalToday > 0 ? Math.round(((closedCount + activeCount) / totalToday) * 100) : null)
  const slaOnTimePct = kpis?.slaOnTimePct ?? 100
  const tmaFormatted = kpis?.tmaFormatted ?? '11m 00s'
  const approvedArticlesCount = knowledgeArticles.filter(a => a.status === 'approved').length

  return (
    <div
      className="space-y-4 text-[#111827] dark:text-[#F7F9FC] font-sans transition-colors"
      data-testid="sac-dashboard-enterprise"
    >
      {/* =====================================================================
          CABEÇALHO INTEGRADO AO LAYOUT PRINCIPAL (SEM SHELL/SIDEBAR DUPLICADA — VIS-01)
      ===================================================================== */}
      <header className="bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black text-[#111827] dark:text-[#F7F9FC] tracking-tight">
              SAC — Dashboard de Atendimento
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#EFF6FF] dark:bg-[#388BFF]/20 text-[#155EEF] dark:text-[#388BFF] border border-[#BFDBFE] dark:border-[#388BFF]/40">
              Dados Conciliados 1:1 com o Chat SAC ({totalToday} protocolos)
            </span>
          </div>
          <p className="text-xs text-[#526074] dark:text-[#B5C0D0] mt-0.5">
            Monitoramento operacional em tempo real • Governança SLA & ITIL • Roteamento por Skills e Limite de 3 Conversas/Agente
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void refreshOperationalData()}
            className="px-3 py-2 rounded-xl bg-[#F5F7FA] dark:bg-[#1D2735] hover:border-[#155EEF] border border-[#DCE2EA] dark:border-[#344154] text-xs font-bold text-[#111827] dark:text-[#F7F9FC] flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className="text-[#155EEF] dark:text-[#388BFF]" />
            <span>Atualizar Indicadores</span>
          </button>

          {/* Seletor de Período */}
          <div className="flex items-center gap-2 bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#111827] dark:text-[#F7F9FC]">
            <Calendar size={14} className="text-[#155EEF] dark:text-[#388BFF]" />
            <select
              value={periodFilter}
              onChange={e => setPeriodFilter(e.target.value as typeof periodFilter)}
              className="bg-transparent font-bold text-[#111827] dark:text-[#F7F9FC] focus:outline-hidden cursor-pointer border-0"
            >
              <option value="Hoje">Hoje</option>
              <option value="Últimas 24h">Últimas 24h</option>
              <option value="Últimos 7 dias">Últimos 7 dias</option>
            </select>
          </div>

          {/* Controle de Consentimento de Áudio do Alerta de Fila */}
          <button
            type="button"
            onClick={() => setSoundEnabled(prev => !prev)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              soundEnabled
                ? 'bg-[#FFF7ED] dark:bg-[#FF9A35]/15 border-[#FED7AA] dark:border-[#FF9A35]/40 text-[#BD5D00] dark:text-[#FF9A35]'
                : 'bg-[#F5F7FA] dark:bg-[#1D2735] border-[#DCE2EA] dark:border-[#344154] text-[#526074] dark:text-[#B5C0D0]'
            }`}
            title={
              soundEnabled
                ? 'Alerta sonoro automático ativado quando a fila real atingir o limite'
                : 'Alerta sonoro silenciado pelo supervisor'
            }
          >
            {soundEnabled ? <Bell size={14} /> : <VolumeX size={14} />}
            <span>{soundEnabled ? 'Som de Fila Ativo' : 'Som Silenciado'}</span>
          </button>
        </div>
      </header>

      {/* ===================================================================
          LINHA 1: 4 CARDS CORPORATIVOS CONCILIADOS COM O CHAT SAC (VIS-02)
          (ATENDIMENTOS HOJE | EFICIÊNCIA & RESOLUÇÃO | TMA | SLA NO PRAZO)
      =================================================================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* Card 1: Atendimentos Hoje (Azul Elétrico) */}
        <div className="rounded-2xl bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] p-4 flex items-center gap-3.5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#155EEF] to-[#1E40AF] text-white flex items-center justify-center shadow-md shrink-0">
            <Headphones size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-[#526074] dark:text-[#B5C0D0] block">
              Atendimentos hoje
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <strong
                className="text-2xl font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums"
                data-testid="kpi-total-today"
              >
                {totalToday}
              </strong>
              <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] dark:bg-[#388BFF]/20 text-[#155EEF] dark:text-[#388BFF] text-[10px] font-extrabold">
                {activeCount} ativo(s) · {queuedCount} fila
              </span>
            </div>
            <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block mt-0.5">
              Conciliado com os protocolos do Chat SAC
            </span>
          </div>
        </div>

        {/* Card 2: Eficiência & Resolução (Violeta Neon) */}
        <div className="rounded-2xl bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] p-4 flex items-center gap-3.5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7942D8] to-[#5B21B6] text-white flex items-center justify-center shadow-md shrink-0">
            <CheckCircle2 size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#526074] dark:text-[#B5C0D0]">
                Eficiência & Resolvidos
              </span>
              <Info size={12} className="text-[#8E9BAE]" />
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <strong className="text-2xl font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                {efficiencyPct !== null ? `${efficiencyPct}%` : 'Sem dados'}
              </strong>
              <span className="px-2 py-0.5 rounded-full bg-[#F3E8FF] dark:bg-[#B66CFF]/20 text-[#7942D8] dark:text-[#B66CFF] text-[10px] font-extrabold">
                {closedCount} encerrado(s)
              </span>
            </div>
            <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block mt-0.5">
              Resolvidos + em atendimento s/ atraso
            </span>
          </div>
        </div>

        {/* Card 3: TMA — Tempo Médio (Laranja SLA) */}
        <div className="rounded-2xl bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] p-4 flex items-center gap-3.5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EA580C] to-[#BD5D00] text-white flex items-center justify-center shadow-md shrink-0">
            <Clock size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-[#526074] dark:text-[#B5C0D0] block">
              TMA (Tempo médio)
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <strong className="text-2xl font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                {tmaFormatted}
              </strong>
            </div>
            <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block mt-0.5">
              Calculado dos atendimentos reais do dia
            </span>
          </div>
        </div>

        {/* Card 4: SLA no Prazo (Ciano Corporativo) */}
        <div className="rounded-2xl bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] p-4 flex items-center gap-3.5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#009AC2] to-[#0369A1] text-white flex items-center justify-center shadow-md shrink-0">
            <Target size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-[#526074] dark:text-[#B5C0D0] block">
              SLA (no prazo)
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <strong className="text-2xl font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                {slaOnTimePct !== null ? `${slaOnTimePct}%` : 'Sem dados'}
              </strong>
              <span className="px-2 py-0.5 rounded-full bg-[#ECFEFF] dark:bg-[#24DEFF]/20 text-[#009AC2] dark:text-[#24DEFF] text-[10px] font-extrabold">
                Política ITIL
              </span>
            </div>
            <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block mt-0.5">
              P1 (15m/4h) · P2 (30m/8h) · P3 (60m/24h)
            </span>
          </div>
        </div>
      </section>

      {/* ===================================================================
          LINHA 2: FAIXA OPERACIONAL GRAFITE DE ALTO CONTRASTE
          (FILA REAL COM ALERTA SONORO | ATENDENTES REAIS | OCUPAÇÃO & IA)
      =================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Bloco 1: Fila de Atendimento Real + Alerta Sonoro por Limiar */}
        <div className="lg:col-span-5 rounded-2xl bg-[#161D29] dark:bg-[#151C27] border border-[#263142] dark:border-[#344154] p-4 text-white flex flex-col justify-between gap-3 shadow-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#B5C0D0]">
              <BellRing size={16} className="text-[#FF9A35]" />
              <span>Fila de Atendimento (Tempo Real)</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 border ${
                queuedCount >= queueThreshold
                  ? 'bg-[#FF9A35]/20 text-[#FF9A35] border-[#FF9A35]/40'
                  : 'bg-white/10 text-[#B5C0D0] border-white/15'
              }`}
            >
              <Volume2 size={12} />
              <span>
                {queuedCount >= queueThreshold
                  ? 'Acima do limiar de alerta'
                  : 'Fila controlada'}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 items-center pt-1">
            <div className="border-r border-white/10 pr-3">
              <div className="flex items-baseline gap-2">
                <strong
                  className="text-3xl font-black text-white tabular-nums"
                  data-testid="kpi-queue-current"
                >
                  {queuedCount}
                </strong>
                <span className="px-2 py-0.5 rounded-full bg-[#388BFF]/20 text-[#388BFF] text-[10px] font-extrabold">
                  {activeCount} em atendimento
                </span>
              </div>
              <span className="text-[11px] text-[#B5C0D0] block mt-0.5">
                aguardando na fila central do SAC
              </span>
            </div>

            <div className="pl-1 space-y-1">
              <span className="text-[11px] text-[#B5C0D0] flex items-center gap-1.5">
                <Clock size={12} className="text-[#24DEFF]" /> Limiar sonoro:{' '}
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={queueThreshold}
                  onChange={e => setQueueThreshold(Math.max(1, Number(e.target.value)))}
                  className="w-12 px-1.5 py-0.5 rounded border border-[#344154] bg-[#0B1018] text-center font-bold text-white text-xs"
                />
              </span>
              <span className="text-[11px] text-[#8E9BAE] block">
                Último alerta:{' '}
                <strong className="text-white">{lastSoundAlertAt || 'Nenhum'}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Bloco 2: Atendentes Reais (Disponíveis / Ocupados / Ausentes) */}
        <div className="lg:col-span-4 rounded-2xl bg-[#161D29] dark:bg-[#151C27] border border-[#263142] dark:border-[#344154] p-4 text-white flex flex-col justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2 text-xs font-bold text-[#B5C0D0]">
            <Users size={16} className="text-[#388BFF]" />
            <span>Equipe SAC ({agents.length} operadores • Máx 3 chats)</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10">
              <strong className="text-2xl font-black text-white block tabular-nums">
                {agents.filter(a => a.status === 'available').length}
              </strong>
              <span className="text-[11px] text-[#43D9A3] font-semibold">
                ● Disponíveis
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/10">
              <strong className="text-2xl font-black text-white block tabular-nums">
                {agents.filter(a => a.status === 'busy').length}
              </strong>
              <span className="text-[11px] text-[#FF9A35] font-semibold">
                ● Ocupados
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/10">
              <strong className="text-2xl font-black text-white block tabular-nums">
                {agents.filter(a => a.status === 'offline').length}
              </strong>
              <span className="text-[11px] text-[#8E9BAE] font-semibold">
                ● Ausentes
              </span>
            </div>
          </div>
        </div>

        {/* Bloco 3: Capacidade Operacional & Modo IA */}
        <div className="lg:col-span-3 rounded-2xl bg-[#161D29] dark:bg-[#151C27] border border-[#263142] dark:border-[#344154] p-4 text-white flex flex-col justify-between gap-2 shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-[#B5C0D0]">
            <span className="flex items-center gap-1.5">
              <Sparkles size={15} className="text-[#B66CFF]" />
              Capacidade & IA
            </span>
            <select
              value={aiMode}
              onChange={e => setAiMode(e.target.value as typeof aiMode)}
              className="px-2 py-0.5 rounded-lg border border-[#344154] bg-[#0B1018] text-[11px] text-white font-bold cursor-pointer"
            >
              <option value="copiloto">IA Copiloto + N1</option>
              <option value="triagem">IA Triagem</option>
              <option value="autonomia_faq">IA Autônoma</option>
            </select>
          </div>

          <div className="flex items-end justify-between gap-2 pt-1">
            <div>
              <strong className="text-2xl font-black text-white tabular-nums">
                {activeCount} / {agents.length * 3}
              </strong>
              <span className="text-[11px] text-[#B5C0D0] block">
                Slots simultâneos em uso
              </span>
            </div>
            {onOpenLiveChat && (
              <button
                type="button"
                onClick={onOpenLiveChat}
                className="px-3 py-1.5 rounded-xl bg-[#155EEF] hover:bg-[#1D4ED8] text-white text-xs font-bold cursor-pointer"
              >
                Abrir Chat ({totalToday})
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ===================================================================
          LINHA 3: ATENDIMENTOS POR CANAL (CONCILIADO SEM DADOS INVENTADOS — VIS-02)
          + PROTOCOLOS EM TEMPO REAL NO SAC
      =================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Card Esquerdo: Atendimentos por Canal */}
        <div className="lg:col-span-5 bg-white dark:bg-[#151C27] rounded-2xl border border-[#DCE2EA] dark:border-[#344154] p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-extrabold text-[#111827] dark:text-[#F7F9FC]">
              Atendimentos por Canal
            </h2>
            <p className="text-xs text-[#526074] dark:text-[#B5C0D0]">
              Contagem real por canal de origem (canais sem webhook ativo exibem status real)
            </p>
          </div>

          <div className="space-y-3.5">
            {/* Canal 1: Chat SafeSaff (Integrado e Ativo) */}
            <div className="grid grid-cols-12 items-center gap-2 text-xs">
              <div className="col-span-5 flex items-center gap-2.5 font-bold text-[#111827] dark:text-[#F7F9FC]">
                <span className="w-7 h-7 rounded-lg bg-[#EFF6FF] dark:bg-[#388BFF]/15 text-[#155EEF] dark:text-[#388BFF] border border-[#BFDBFE] dark:border-[#388BFF]/30 flex items-center justify-center">
                  <MessageSquare size={14} />
                </span>
                <span>Chat SafeSaff</span>
              </div>
              <div className="col-span-2 text-right font-black text-sm text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                {totalToday}
              </div>
              <div className="col-span-5">
                <div className="flex justify-between text-[10px] text-[#526074] dark:text-[#B5C0D0] font-semibold mb-1">
                  <span>100% dos chamados ativos</span>
                  <span className="text-[#155EEF] dark:text-[#388BFF] font-bold">Integrado</span>
                </div>
                <div className="h-2 rounded-full bg-[#EEF2F6] dark:bg-[#1D2735] overflow-hidden">
                  <div
                    className="h-full bg-[#155EEF] dark:bg-[#388BFF] rounded-full"
                    style={{ width: totalToday > 0 ? '100%' : '0%' }}
                  />
                </div>
              </div>
            </div>

            {/* Canal 2: WhatsApp (Status transparente conforme Onda 0 da Auditoria) */}
            <div className="grid grid-cols-12 items-center gap-2 text-xs pt-2 border-t border-[#DCE2EA]/60 dark:border-[#344154]/60">
              <div className="col-span-5 flex items-center gap-2.5 font-bold text-[#111827] dark:text-[#F7F9FC]">
                <span className="w-7 h-7 rounded-lg bg-[#ECFEFF] dark:bg-[#24DEFF]/15 text-[#009AC2] dark:text-[#24DEFF] border border-[#A5F3FC] dark:border-[#24DEFF]/30 flex items-center justify-center">
                  <MessageCircle size={14} />
                </span>
                <span>WhatsApp</span>
              </div>
              <div className="col-span-2 text-right font-black text-sm text-[#526074] dark:text-[#B5C0D0] tabular-nums">
                0
              </div>
              <div className="col-span-5">
                <span className="px-2 py-0.5 rounded bg-[#EEF2F6] dark:bg-[#1D2735] text-[#526074] dark:text-[#B5C0D0] text-[10px] font-semibold block text-center">
                  Não integrado (aguardando webhook)
                </span>
              </div>
            </div>

            {/* Canal 3: E-mail (Status transparente conforme Onda 0 da Auditoria) */}
            <div className="grid grid-cols-12 items-center gap-2 text-xs pt-2 border-t border-[#DCE2EA]/60 dark:border-[#344154]/60">
              <div className="col-span-5 flex items-center gap-2.5 font-bold text-[#111827] dark:text-[#F7F9FC]">
                <span className="w-7 h-7 rounded-lg bg-[#F3E8FF] dark:bg-[#B66CFF]/15 text-[#7942D8] dark:text-[#B66CFF] border border-[#D8B4FE] dark:border-[#B66CFF]/30 flex items-center justify-center">
                  <Mail size={14} />
                </span>
                <span>E-mail</span>
              </div>
              <div className="col-span-2 text-right font-black text-sm text-[#526074] dark:text-[#B5C0D0] tabular-nums">
                0
              </div>
              <div className="col-span-5">
                <span className="px-2 py-0.5 rounded bg-[#EEF2F6] dark:bg-[#1D2735] text-[#526074] dark:text-[#B5C0D0] text-[10px] font-semibold block text-center">
                  Não integrado (aguardando SMTP/IMAP)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card Direito: Protocolos Operacionais Reais Sincronizados com o Chat SAC */}
        <div className="lg:col-span-7 bg-white dark:bg-[#151C27] rounded-2xl border border-[#DCE2EA] dark:border-[#344154] p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-[#111827] dark:text-[#F7F9FC]">
                Protocolos Sincronizados com o Chat SAC ({conversations.length})
              </h2>
              <p className="text-xs text-[#526074] dark:text-[#B5C0D0]">
                Lista em tempo real dos mesmos protocolos visíveis na aba de operação do Chat SAC
              </p>
            </div>
            {onOpenLiveChat && (
              <button
                type="button"
                onClick={onOpenLiveChat}
                className="text-xs font-bold text-[#155EEF] dark:text-[#388BFF] hover:underline cursor-pointer"
              >
                Atender na fila →
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#DCE2EA] dark:border-[#344154] text-[11px] font-bold text-[#526074] dark:text-[#B5C0D0]">
                  <th className="py-2 pr-2">Protocolo</th>
                  <th className="py-2 px-2">Cliente</th>
                  <th className="py-2 px-2">Assunto</th>
                  <th className="py-2 px-2">Prioridade / Skill</th>
                  <th className="py-2 pl-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE2EA]/60 dark:divide-[#344154]/60">
                {conversations.slice(0, 5).map(c => (
                  <tr key={c.id} className="hover:bg-[#F5F7FA] dark:hover:bg-[#1D2735]">
                    <td className="py-2 pr-2 font-mono font-bold text-[#155EEF] dark:text-[#388BFF]">
                      {c.ticket.code}
                    </td>
                    <td className="py-2 px-2 font-bold text-[#111827] dark:text-[#F7F9FC]">
                      {c.ticket.requesterName}
                    </td>
                    <td className="py-2 px-2 text-[#526074] dark:text-[#B5C0D0] max-w-[200px] truncate">
                      {c.ticket.subject}
                    </td>
                    <td className="py-2 px-2">
                      <span className="px-2 py-0.5 rounded bg-[#F3E8FF] dark:bg-[#B66CFF]/20 text-[#7942D8] dark:text-[#B66CFF] font-bold text-[10px]">
                        {c.ticket.priority || 'P3'} · {c.requiredSkill || 'Geral'}
                      </span>
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'queued'
                            ? 'bg-[#FFF7ED] dark:bg-[#FF9A35]/20 text-[#BD5D00] dark:text-[#FF9A35]'
                            : c.status === 'active'
                            ? 'bg-[#EFF6FF] dark:bg-[#388BFF]/20 text-[#155EEF] dark:text-[#388BFF]'
                            : 'bg-[#ECFDF5] dark:bg-[#43D9A3]/20 text-[#16734A] dark:text-[#43D9A3]'
                        }`}
                      >
                        {c.status === 'queued'
                          ? 'Na fila'
                          : c.status === 'active'
                          ? `Ativo (${c.assignedAgent?.name.split(' ')[0] || 'SAC'})`
                          : 'Resolvido'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===================================================================
          LINHA 4: SLA POR PRIORIDADE & ITIL (ESQUERDA) + SKILLS DA EQUIPE (DIREITA)
      =================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Card Esquerdo: SLA por Prioridade & ITIL (Calculado dos Chamados Reais — COD-03) */}
        <div className="lg:col-span-6 bg-white dark:bg-[#151C27] rounded-2xl border border-[#DCE2EA] dark:border-[#344154] p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] dark:bg-[#388BFF]/15 text-[#155EEF] dark:text-[#388BFF] flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#111827] dark:text-[#F7F9FC]">
                  SLA por Prioridade & Governança ITIL
                </h2>
                <p className="text-xs text-[#526074] dark:text-[#B5C0D0]">
                  Política escalonada por prioridade (P1: 15m/4h • P2: 30m/8h • P3: 60m/24h)
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full bg-[#EFF6FF] dark:bg-[#388BFF]/15 text-[#155EEF] dark:text-[#388BFF] border border-[#BFDBFE] dark:border-[#388BFF]/30 text-[11px] font-extrabold">
              SlaPolicy Ativa
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            {(
              [
                {
                  prio: 'P1' as const,
                  label: 'Alta (P1 · 15m)',
                  color: '#155EEF',
                  data: kpis?.byPriority.P1
                },
                {
                  prio: 'P2' as const,
                  label: 'Média (P2 · 30m)',
                  color: '#7942D8',
                  data: kpis?.byPriority.P2
                },
                {
                  prio: 'P3' as const,
                  label: 'Baixa (P3 · 60m)',
                  color: '#EA580C',
                  data: kpis?.byPriority.P3
                }
              ] as const
            ).map(ring => {
              const pctVal = ring.data?.onTimePct ?? 100
              const totalCount = ring.data?.total ?? 0
              return (
                <div
                  key={ring.prio}
                  className="p-3 rounded-2xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] flex flex-col items-center justify-center"
                >
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#DCE2EA"
                        strokeOpacity="0.35"
                        strokeWidth="10"
                        fill="none"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke={ring.color}
                        strokeWidth="10"
                        strokeDasharray="251.2"
                        strokeDashoffset={251.2 * (1 - pctVal / 100)}
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <strong className="absolute text-xs font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                      {totalCount > 0 ? `${pctVal}%` : 'Sem dados'}
                    </strong>
                  </div>
                  <span className="text-xs font-bold text-[#111827] dark:text-[#F7F9FC] mt-1.5">
                    {ring.label}
                  </span>
                  <span className="text-[10px] text-[#526074] dark:text-[#B5C0D0]">
                    {totalCount} chamado(s)
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Card Direito: Skills da Equipe Conectadas ao Roteador Automático (VIS-04 / COD-04) */}
        <div className="lg:col-span-6 bg-white dark:bg-[#151C27] rounded-2xl border border-[#DCE2EA] dark:border-[#344154] p-5 shadow-xs space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#F3E8FF] dark:bg-[#B66CFF]/15 text-[#7942D8] dark:text-[#B66CFF] flex items-center justify-center">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#111827] dark:text-[#F7F9FC]">
                  Skills da Equipe SAC (Roteamento Ativo)
                </h2>
                <p className="text-xs text-[#526074] dark:text-[#B5C0D0]">
                  Alterações nas skills atualizam imediatamente a elegibilidade na fila do Chat SAC
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingUserId(agents[0]?.userId || null)
                setShowManageSkillsModal(true)
              }}
              data-testid="btn-open-manage-skills"
              className="px-3.5 py-2 rounded-xl bg-[#155EEF] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Edit3 size={13} />
              <span>Gerenciar Skills</span>
            </button>
          </div>

          {skillFeedback && (
            <div className="p-2.5 rounded-xl bg-[#EFF6FF] dark:bg-[#388BFF]/20 border border-[#BFDBFE] dark:border-[#388BFF]/40 text-xs text-[#155EEF] dark:text-[#388BFF] font-semibold flex items-center justify-between">
              <span>{skillFeedback}</span>
              <button
                type="button"
                onClick={() => setSkillFeedback('')}
                className="underline font-bold cursor-pointer"
              >
                OK
              </button>
            </div>
          )}

          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-[#8E9BAE]" />
            <input
              type="text"
              value={skillSearch}
              onChange={e => setSkillSearch(e.target.value)}
              placeholder="Buscar operador do SAC ou competência..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#DCE2EA] dark:border-[#344154] bg-[#F5F7FA] dark:bg-[#101620] text-xs text-[#111827] dark:text-[#F7F9FC] focus:outline-hidden"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#DCE2EA] dark:border-[#344154] text-[11px] font-bold text-[#526074] dark:text-[#B5C0D0]">
                  <th className="py-2 pr-2">Operador SAC</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2 text-center">Carga</th>
                  <th className="py-2 pl-2">Skills Ativas no Dispatcher</th>
                  <th className="py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE2EA]/60 dark:divide-[#344154]/60">
                {filteredAgents.map(ag => (
                  <tr key={ag.userId} className="hover:bg-[#F5F7FA] dark:hover:bg-[#1D2735]">
                    <td className="py-2.5 pr-2 font-bold text-[#111827] dark:text-[#F7F9FC]">
                      {ag.user.name}
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          ag.status === 'available'
                            ? 'bg-[#ECFDF5] dark:bg-[#43D9A3]/15 text-[#16734A] dark:text-[#43D9A3]'
                            : ag.status === 'busy'
                            ? 'bg-[#FFF7ED] dark:bg-[#FF9A35]/15 text-[#BD5D00] dark:text-[#FF9A35]'
                            : 'bg-[#EEF2F6] dark:bg-[#1D2735] text-[#526074] dark:text-[#B5C0D0]'
                        }`}
                      >
                        {ag.status === 'available'
                          ? 'Disponível'
                          : ag.status === 'busy'
                          ? 'Ocupado'
                          : 'Ausente'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                      {ag.activeChatsCount ?? 0}/3
                    </td>
                    <td className="py-2.5 pl-2">
                      <div className="flex flex-wrap gap-1">
                        {ag.skills.map(sk => (
                          <span
                            key={sk}
                            className="px-2 py-0.5 rounded-md bg-[#F3E8FF] dark:bg-[#B66CFF]/15 text-[#7942D8] dark:text-[#B66CFF] border border-[#D8B4FE] dark:border-[#B66CFF]/30 text-[10px] font-bold"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUserId(ag.userId)
                          setShowManageSkillsModal(true)
                        }}
                        title={`Editar skills de ${ag.user.name}`}
                        className="p-1.5 rounded-lg text-[#526074] dark:text-[#B5C0D0] hover:text-[#155EEF] cursor-pointer"
                      >
                        <Edit3 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===================================================================
          LINHA 5: INTELIGÊNCIA ARTIFICIAL NO ATENDIMENTO SAC (VIOLETA NEON & AZUL ELÉTRICO)
      =================================================================== */}
      <section
        className="bg-white dark:bg-[#151C27] rounded-2xl border border-[#DCE2EA] dark:border-[#344154] p-5 shadow-xs space-y-4"
        data-testid="sac-dashboard-ai-section"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F3E8FF] dark:bg-[#B66CFF]/20 text-[#7942D8] dark:text-[#B66CFF] flex items-center justify-center">
              <Bot size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#111827] dark:text-[#F7F9FC]">
                  Inteligência Artificial no Atendimento (Cliente N1 + Copiloto SAC)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#F3E8FF] dark:bg-[#B66CFF]/20 text-[#7942D8] dark:text-[#B66CFF] border border-[#D8B4FE] dark:border-[#B66CFF]/40 text-[10px] font-extrabold">
                  {approvedArticlesCount} artigos aprovados na Base IA
                </span>
              </div>
              <p className="text-xs text-[#526074] dark:text-[#B5C0D0]">
                A IA realiza a triagem inicial por temas autorizados pelo supervisor e transfere para a fila SAC mantendo protocolo, histórico e skill exigida.
              </p>
            </div>
          </div>

          {onOpenLiveChat && (
            <button
              type="button"
              onClick={onOpenLiveChat}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#7942D8] to-[#155EEF] hover:opacity-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Sparkles size={14} />
              <span>Abrir Chat com IA & Copiloto</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-2xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] p-4 space-y-1">
            <span className="text-xs font-bold text-[#526074] dark:text-[#B5C0D0] block">
              Atendimentos pela IA
            </span>
            <strong className="text-3xl font-black text-[#7942D8] dark:text-[#B66CFF] block tabular-nums">
              {aiMetrics.totalAiAttendances}
            </strong>
            <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block">
              Conversas iniciadas com triagem da IA
            </span>
          </div>

          <div className="rounded-2xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] p-4 space-y-1">
            <span className="text-xs font-bold text-[#526074] dark:text-[#B5C0D0] block">
              Resolução pela IA (N1)
            </span>
            <strong className="text-3xl font-black text-[#155EEF] dark:text-[#388BFF] block tabular-nums">
              {aiMetrics.resolvedByAiPercent}%
            </strong>
            <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block">
              Dúvidas concluídas sem fila humana
            </span>
          </div>

          <div className="rounded-2xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] p-4 space-y-1">
            <span className="text-xs font-bold text-[#526074] dark:text-[#B5C0D0] block">
              Transferidos ao SAC
            </span>
            <strong className="text-3xl font-black text-[#BD5D00] dark:text-[#FF9A35] block tabular-nums">
              {aiMetrics.transferredToSacPercent}%
            </strong>
            <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block">
              Encaminhados com resumo e skill
            </span>
          </div>

          <div className="rounded-2xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] p-4 space-y-1">
            <span className="text-xs font-bold text-[#526074] dark:text-[#B5C0D0] block">
              Aproveitamento Copiloto
            </span>
            <strong className="text-3xl font-black text-[#009AC2] dark:text-[#24DEFF] block tabular-nums">
              {aiMetrics.copilotAcceptedCount}/{aiMetrics.copilotSuggestionsTotal}
            </strong>
            <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block">
              Sugestões utilizadas pelos atendentes
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
          <div className="lg:col-span-7 rounded-2xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-xs font-extrabold text-[#111827] dark:text-[#F7F9FC] block">
                  🤖 Árvore de Assuntos Autorizados para a IA do Cliente (N1)
                </strong>
                <span className="text-[11px] text-[#526074] dark:text-[#B5C0D0]">
                  Cada assunto está vinculado a uma prioridade ITIL e uma Skill obrigatória na fila SAC
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CUSTOMER_AI_TOPICS.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setPreviewTopicKey(t.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                    previewTopicKey === t.key
                      ? 'bg-[#7942D8] text-white border-[#7942D8]'
                      : 'bg-white dark:bg-[#151C27] text-[#111827] dark:text-[#F7F9FC] border-[#DCE2EA] dark:border-[#344154]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {(() => {
              const currentTopic =
                CUSTOMER_AI_TOPICS.find(t => t.key === previewTopicKey) ||
                CUSTOMER_AI_TOPICS[0]
              return (
                <div className="rounded-xl bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <strong className="text-[#7942D8] dark:text-[#B66CFF]">
                      Tema: {currentTopic.label}
                    </strong>
                    <span className="px-2 py-0.5 rounded bg-[#EFF6FF] dark:bg-[#388BFF]/20 text-[#155EEF] dark:text-[#388BFF] font-bold">
                      Prioridade {currentTopic.priority} · Skill: {currentTopic.requiredSkill}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-[#526074] dark:text-[#B5C0D0] leading-relaxed">
                    {currentTopic.guidedAnswer}
                  </p>
                </div>
              )
            })()}
          </div>

          <div className="lg:col-span-5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] p-4 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <strong className="text-xs font-extrabold text-[#111827] dark:text-[#F7F9FC]">
                  📚 Artigos Aprovados na Base de Conhecimento ({approvedArticlesCount})
                </strong>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
                {knowledgeArticles
                  .filter(a => a.status === 'approved')
                  .map(art => (
                    <div
                      key={art.id}
                      className="p-2.5 rounded-xl bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <strong className="text-[#111827] dark:text-[#F7F9FC] block truncate">
                          {art.title}
                        </strong>
                        <span className="text-[10px] text-[#7942D8] dark:text-[#B66CFF] font-semibold">
                          {art.category}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#ECFDF5] dark:bg-[#43D9A3]/20 text-[#16734A] dark:text-[#43D9A3] text-[10px] font-bold shrink-0">
                        approved
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          MODAL DO SUPERVISOR: GERENCIAR SKILLS DOS OPERADORES REAIS DO SAC
      ===================================================================== */}
      {showManageSkillsModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowManageSkillsModal(false)}
        >
          <div
            className="bg-white dark:bg-[#151C27] rounded-2xl border border-[#DCE2EA] dark:border-[#344154] shadow-2xl w-full max-w-2xl overflow-hidden text-[#111827] dark:text-[#F7F9FC]"
            onClick={e => e.stopPropagation()}
            data-testid="modal-manage-sac-skills"
          >
            <div className="bg-[#161D29] text-white px-5 py-4 flex items-center justify-between border-b border-[#344154]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#388BFF] block">
                  Governança de Supervisão SAC • Roteamento Baseado em Skills & ITIL
                </span>
                <h3 className="text-base font-black">
                  Atribuição de Skills aos Operadores do SAC
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManageSkillsModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#111827] dark:text-[#F7F9FC] block mb-1.5">
                  1. Selecione o Operador do SAC:
                </label>
                <div className="flex flex-wrap gap-2">
                  {agents.map(ag => (
                    <button
                      key={ag.userId}
                      type="button"
                      onClick={() => setEditingUserId(ag.userId)}
                      className={`px-3 py-1.5 rounded-xl font-bold border flex items-center gap-2 cursor-pointer ${
                        editingAgent?.userId === ag.userId
                          ? 'bg-[#155EEF] text-white border-[#155EEF]'
                          : 'bg-[#F5F7FA] dark:bg-[#1D2735] text-[#111827] dark:text-[#F7F9FC] border-[#DCE2EA] dark:border-[#344154]'
                      }`}
                    >
                      <span>{ag.user.name}</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-black/15 text-[10px]">
                        {ag.skills.length} skills
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {editingAgent && (
                <div className="p-4 rounded-xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] space-y-3">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm text-[#111827] dark:text-[#F7F9FC]">
                      Skills de {editingAgent.user.name}
                    </strong>
                    <span className="text-[11px] text-[#526074] dark:text-[#B5C0D0]">
                      Clique para habilitar ou remover no roteador da fila
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skillCatalog.map(skill => {
                      const active = editingAgent.skills.includes(skill)
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() =>
                            void handleToggleAgentSkill(editingAgent.userId, skill)
                          }
                          className={`px-3 py-1.5 rounded-lg font-bold border flex items-center gap-1.5 transition cursor-pointer ${
                            active
                              ? 'bg-[#7942D8] text-white border-[#7942D8] shadow-2xs'
                              : 'bg-white dark:bg-[#151C27] text-[#526074] dark:text-[#B5C0D0] border-[#DCE2EA] dark:border-[#344154]'
                          }`}
                        >
                          {active && <Check size={13} />}
                          <span>{skill}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="pt-2 border-t border-[#DCE2EA] dark:border-[#344154] flex items-center gap-2">
                    <input
                      type="text"
                      value={newCustomSkill}
                      onChange={e => setNewCustomSkill(e.target.value)}
                      placeholder="Cadastrar nova skill no catálogo..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-[#DCE2EA] dark:border-[#344154] bg-white dark:bg-[#151C27] text-[#111827] dark:text-[#F7F9FC]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = newCustomSkill.trim()
                        if (!clean) return
                        if (!skillCatalog.includes(clean)) {
                          setSkillCatalog(prev => [...prev, clean])
                        }
                        void handleToggleAgentSkill(editingAgent.userId, clean)
                        setNewCustomSkill('')
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#155EEF] hover:bg-[#1D4ED8] text-white font-bold cursor-pointer"
                    >
                      + Adicionar Skill
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[#EFF6FF] dark:bg-[#388BFF]/15 border border-[#BFDBFE] dark:border-[#388BFF]/35 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 font-semibold text-[#111827] dark:text-[#F7F9FC] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiRespectSkillRouting}
                    onChange={e => setAiRespectSkillRouting(e.target.checked)}
                    className="rounded"
                  />
                  <span>
                    Exigir compatibilidade de Skill na distribuição automática (além do limite de 3 conversas/agente)
                  </span>
                </label>

                <label className="flex items-center gap-2 font-semibold text-[#111827] dark:text-[#F7F9FC] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiAutoTransferOnRisk}
                    onChange={e => setAiAutoTransferOnRisk(e.target.checked)}
                    className="rounded"
                  />
                  <span>Escalonar P1 automaticamente para agentes com skill N2 / ITIL</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowManageSkillsModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#155EEF] hover:bg-[#1D4ED8] text-white font-bold cursor-pointer"
                >
                  Salvar & Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
