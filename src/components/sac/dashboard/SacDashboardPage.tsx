import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
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
  Layers,
  Mail,
  MessageCircle,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Volume2,
  VolumeX,
  X
} from 'lucide-react'
import {
  CUSTOMER_AI_TOPICS,
  getSacAiMetricsSnapshot,
  sacAiApi,
  type SacKnowledgeArticle
} from '../../../services/sacAi.service'

export type SacDashboardTab =
  | 'dashboard'
  | 'atendimentos'
  | 'fila'
  | 'sla_itil'
  | 'skills'
  | 'ia_sac'
  | 'relatorios'
  | 'configuracoes'

export interface SacCollaboratorSkillRow {
  id: string
  initials: string
  name: string
  status: 'Disponível' | 'Em atendimento' | 'Pausa'
  activeChats: number
  maxChats: number
  skills: string[]
}

const INITIAL_COLLABORATORS: SacCollaboratorSkillRow[] = [
  {
    id: 'col-1',
    initials: 'AO',
    name: 'Ana Oliveira',
    status: 'Disponível',
    activeChats: 3,
    maxChats: 3,
    skills: ['Financeiro', 'ERP', 'N1']
  },
  {
    id: 'col-2',
    initials: 'BM',
    name: 'Bruno Mendes',
    status: 'Em atendimento',
    activeChats: 3,
    maxChats: 3,
    skills: ['Suporte Técnico', 'N2', 'ITIL']
  },
  {
    id: 'col-3',
    initials: 'CL',
    name: 'Carlos Lima',
    status: 'Em atendimento',
    activeChats: 2,
    maxChats: 3,
    skills: ['ERP', 'N1', 'Suporte Técnico']
  },
  {
    id: 'col-4',
    initials: 'JC',
    name: 'Juliana Costa',
    status: 'Disponível',
    activeChats: 1,
    maxChats: 3,
    skills: ['Cobrança', 'Financeiro', 'ERP']
  },
  {
    id: 'col-5',
    initials: 'RS',
    name: 'Ricardo Souza',
    status: 'Em atendimento',
    activeChats: 2,
    maxChats: 3,
    skills: ['N2', 'ITIL', 'Suporte Técnico']
  }
]

const AVAILABLE_SKILL_CATALOG = [
  'Financeiro',
  'ERP',
  'N1',
  'N2',
  'N3',
  'Suporte Técnico',
  'ITIL',
  'Cobrança',
  'Estornos & CDC',
  'Ingressos & QR Code',
  'VIP & Produtores',
  'Triagem IA'
]

interface Props {
  producerId?: number | null
  onOpenLiveChat?: () => void
}

export const SacDashboardPage: React.FC<Props> = ({ producerId, onOpenLiveChat }) => {
  const [activeNav, setActiveNav] = useState<SacDashboardTab>('dashboard')
  const [periodFilter, setPeriodFilter] = useState<'Hoje' | 'Últimas 24h' | 'Últimos 7 dias'>('Hoje')
  const [aiMetrics, setAiMetrics] = useState(() => getSacAiMetricsSnapshot())
  const [knowledgeArticles, setKnowledgeArticles] = useState<SacKnowledgeArticle[]>([])
  const [previewTopicKey, setPreviewTopicKey] = useState<string>('cancelamento_show')

  useEffect(() => {
    const syncAi = () => {
      setAiMetrics(getSacAiMetricsSnapshot())
      void sacAiApi.knowledge(producerId).then(setKnowledgeArticles).catch(() => undefined)
    }
    syncAi()
    window.addEventListener('safesaff:sac-ai-sync', syncAi)
    return () => window.removeEventListener('safesaff:sac-ai-sync', syncAi)
  }, [producerId])

  // Estado da Fila e Alerta Sonoro Inteligente (Web Audio API)
  const [queueCurrent, setQueueCurrent] = useState<number>(14)
  const [queueDelta30m, setQueueDelta30m] = useState<number>(6)
  const [queueThreshold, setQueueThreshold] = useState<number>(10)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true)
  const [soundMutedMinutes] = useState<number>(0)
  const [lastSoundAlertAt, setLastSoundAlertAt] = useState<string>('10:00')
  const [, setQueueHistory] = useState<{ time: string; value: number }[]>([
    { time: '09:00', value: 3 },
    { time: '09:10', value: 5 },
    { time: '09:20', value: 5 },
    { time: '09:30', value: 8 },
    { time: '09:40', value: 10 },
    { time: '09:50', value: 11 },
    { time: '10:00', value: 14 }
  ])

  // Estado de Skills da Equipe (Editável pelo Supervisor do SAC)
  const [collaborators, setCollaborators] = useState<SacCollaboratorSkillRow[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('safesaff_sac_collaborator_skills_v1')
        if (saved) return JSON.parse(saved)
      } catch {
        // ignore
      }
    }
    return INITIAL_COLLABORATORS
  })
  const [skillSearch, setSkillSearch] = useState<string>('')
  const [editingCollabId, setEditingCollabId] = useState<string | null>(null)
  const [showManageSkillsModal, setShowManageSkillsModal] = useState<boolean>(false)
  const [newCustomSkill, setNewCustomSkill] = useState<string>('')
  const [skillCatalog, setSkillCatalog] = useState<string[]>(AVAILABLE_SKILL_CATALOG)

  // Estado da IA do SAC (Copiloto, Triagem, Autonomia FAQ)
  const [aiMode, setAiMode] = useState<'copiloto' | 'triagem' | 'autonomia_faq'>('copiloto')
  const [aiAutoTransferOnRisk, setAiAutoTransferOnRisk] = useState<boolean>(true)
  const [aiRespectSkillRouting, setAiRespectSkillRouting] = useState<boolean>(true)

  const audioCtxRef = useRef<AudioContext | null>(null)

  const saveCollaborators = (next: SacCollaboratorSkillRow[]) => {
    setCollaborators(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem('safesaff_sac_collaborator_skills_v1', JSON.stringify(next))
    }
  }

  const playQueueAlertSound = (severity: 'warning' | 'critical' = 'critical') => {
    if (!soundEnabled || soundMutedMinutes > 0) return
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
      // Fallback silencioso caso o navegador bloqueie autoplay
    }
  }

  const handleSimulateQueueGrowth = () => {
    const nextVal = queueCurrent + 2
    setQueueCurrent(nextVal)
    setQueueDelta30m(d => d + 2)
    const nowLabel = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
    setQueueHistory(prev => [...prev.slice(1), { time: nowLabel, value: nextVal }])
    if (nextVal >= queueThreshold) {
      playQueueAlertSound('critical')
    }
  }

  const filteredCollaborators = useMemo(() => {
    const q = skillSearch.trim().toLowerCase()
    if (!q) return collaborators
    return collaborators.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.skills.some(s => s.toLowerCase().includes(q)) ||
        c.status.toLowerCase().includes(q)
    )
  }, [collaborators, skillSearch])

  const toggleSkillOnCollaborator = (collabId: string, skill: string) => {
    const next = collaborators.map(c => {
      if (c.id !== collabId) return c
      const has = c.skills.includes(skill)
      return {
        ...c,
        skills: has ? c.skills.filter(s => s !== skill) : [...c.skills, skill]
      }
    })
    saveCollaborators(next)
  }

  const editingCollaborator = useMemo(
    () => collaborators.find(c => c.id === editingCollabId) || collaborators[0],
    [collaborators, editingCollabId]
  )

  return (
    <div
      className="min-h-screen bg-[#F5F7FA] dark:bg-[#0B1018] text-[#111827] dark:text-[#F7F9FC] rounded-2xl border border-[#DCE2EA] dark:border-[#344154] shadow-xl overflow-hidden flex flex-col lg:flex-row font-sans transition-colors"
      data-testid="sac-dashboard-enterprise"
    >
      {/* =====================================================================
          SIDEBAR INTERNA DO MÓDULO SAC — GRAFITE EM AMBOS OS TEMAS (#161D29 / #0B1018)
          ITEM ATIVO EM AZUL ELÉTRICO (#155EEF) E DETALHES NEON
      ===================================================================== */}
      <aside className="w-full lg:w-60 bg-[#161D29] dark:bg-[#0B1018] border-b lg:border-b-0 lg:border-r border-[#263142] dark:border-[#1E293B] flex flex-col justify-between p-4 shrink-0 text-[#F7F9FC]">
        <div className="space-y-5">
          {/* Logo SafeSaff ERP (Azul Elétrico + Violeta Neon) */}
          <div className="px-2 pt-1 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#24DEFF] via-[#155EEF] to-[#7942D8] flex items-center justify-center text-white font-black text-xs shadow">
              S
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black tracking-tight text-white">
                SafeSaff
              </span>
              <span className="text-sm font-semibold text-[#94A3B8]">ERP</span>
            </div>
          </div>

          {/* Menu SAC */}
          <nav className="space-y-1">
            {(
              [
                { id: 'dashboard' as const, label: 'Dashboard', icon: Layers },
                { id: 'atendimentos' as const, label: 'SAC / Atendimentos', icon: Headphones },
                { id: 'fila' as const, label: 'Fila de Atendimento', icon: Activity },
                { id: 'sla_itil' as const, label: 'Protocolos & SLA', icon: ShieldCheck },
                { id: 'skills' as const, label: 'Skills da Equipe', icon: Users },
                { id: 'ia_sac' as const, label: 'Conhecimento (IA)', icon: Bot },
                { id: 'relatorios' as const, label: 'Relatórios', icon: TrendingUp },
                { id: 'configuracoes' as const, label: 'Configurações', icon: Settings }
              ] as const
            ).map(item => {
              const Icon = item.icon
              const isActive = activeNav === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'atendimentos' && onOpenLiveChat) {
                      onOpenLiveChat()
                      return
                    }
                    if (item.id === 'skills') {
                      setShowManageSkillsModal(true)
                    }
                    setActiveNav(item.id)
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#155EEF] to-[#1D4ED8] text-white shadow-md'
                      : 'text-[#CBD5E1] hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <Icon size={17} className={isActive ? 'text-white' : 'text-[#388BFF]'} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Canais Integrados (como na referência aprovada B) */}
          <div className="pt-3 border-t border-white/10 space-y-2 px-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8E9BAE] block">
              Canais integrados
            </span>
            {[
              { label: 'WhatsApp', dot: 'bg-[#24DEFF]' },
              { label: 'E-mail', dot: 'bg-[#388BFF]' },
              { label: 'Chat do Site', dot: 'bg-[#B66CFF]' }
            ].map(ch => (
              <div
                key={ch.label}
                className="flex items-center justify-between text-xs text-[#CBD5E1] py-1"
              >
                <span>{ch.label}</span>
                <span className={`w-2 h-2 rounded-full ${ch.dot}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé SAC – Supervisão */}
        <div className="mt-6 p-3 rounded-2xl bg-[#1D2735] border border-[#344154] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#155EEF]/25 border border-[#388BFF]/40 text-[#388BFF] flex items-center justify-center shrink-0">
            <Headphones size={18} />
          </div>
          <div className="min-w-0">
            <strong className="text-xs font-extrabold text-white block truncate">
              SAC – Supervisão
            </strong>
            <span className="text-[10px] text-[#B5C0D0] leading-tight block">
              SLA, ITIL, Skills & IA Copiloto
            </span>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          ÁREA PRINCIPAL DO DASHBOARD SAC (ADAPTÁVEL CLARO #F5F7FA / ESCURO #0B1018)
      ===================================================================== */}
      <div className="flex-1 p-5 lg:p-6 space-y-5 overflow-y-auto">
        {/* TOPO: TÍTULO + FILTRO HOJE + NOTIFICAÇÃO + PERFIL SUPERVISOR */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#111827] dark:text-[#F7F9FC] tracking-tight">
              SAC — Dashboard de Atendimento
            </h1>
            <p className="text-xs text-[#526074] dark:text-[#B5C0D0] mt-0.5">
              Visão geral do atendimento multicanal (Chat, WhatsApp e E-mail), SLA, fila, ITIL e produtividade
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Botão para testar o som do alerta imediatamente */}
            <button
              type="button"
              onClick={() => playQueueAlertSound('critical')}
              data-testid="btn-test-queue-sound"
              className="px-3 py-2 rounded-xl bg-[#FFF7ED] dark:bg-[#FF9A35]/15 hover:bg-[#FFEDD5] text-[#BD5D00] dark:text-[#FF9A35] border border-[#FED7AA] dark:border-[#FF9A35]/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Tocar som de alerta de crescimento da fila agora"
            >
              <Volume2 size={15} />
              <span>Testar Som de Fila</span>
            </button>

            <button
              type="button"
              onClick={handleSimulateQueueGrowth}
              data-testid="btn-simulate-queue-growth"
              className="px-3 py-2 rounded-xl bg-[#EFF6FF] dark:bg-[#388BFF]/15 hover:bg-[#DBEAFE] text-[#155EEF] dark:text-[#388BFF] border border-[#BFDBFE] dark:border-[#388BFF]/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Simular chegada de novos chamados na fila e disparar alerta sonoro"
            >
              <Plus size={14} />
              <span>Simular +Fila ({queueCurrent})</span>
            </button>

            {/* Seletor de Data */}
            <div className="flex items-center gap-2 bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#111827] dark:text-[#F7F9FC]">
              <Calendar size={15} className="text-[#155EEF] dark:text-[#388BFF]" />
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

            {/* Sino de Alerta */}
            <button
              type="button"
              onClick={() => setSoundEnabled(prev => !prev)}
              className="relative w-10 h-10 rounded-xl bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] flex items-center justify-center text-[#526074] dark:text-[#B5C0D0] hover:border-[#155EEF] cursor-pointer"
              title={soundEnabled ? 'Alerta sonoro ativado (clique para silenciar)' : 'Alerta sonoro silenciado'}
            >
              {soundEnabled ? <Bell size={18} /> : <VolumeX size={18} className="text-[#C1273C] dark:text-[#FF5A78]" />}
              <span
                className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                  soundEnabled ? 'bg-[#7942D8] dark:bg-[#B66CFF]' : 'bg-[#C1273C]'
                }`}
              />
            </button>

            {/* Badge AS Supervisor SAC (Azul/Violeta corporativo) */}
            <div className="flex items-center gap-2.5 bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] rounded-full pl-1.5 pr-3.5 py-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#155EEF] to-[#7942D8] text-white font-black text-xs flex items-center justify-center">
                AS
              </div>
              <div className="leading-tight">
                <span className="text-xs font-bold text-[#111827] dark:text-[#F7F9FC] block">
                  Admin SafeSaff
                </span>
                <span className="text-[10px] text-[#526074] dark:text-[#B5C0D0] block">
                  Supervisor SAC
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ===================================================================
            LINHA 1: 4 CARDS CORPORATIVOS COM ÍCONES EM AZUL, VIOLETA, LARANJA E CIANO
            (IDÊNTICOS À REFERÊNCIA APROVADA B — BASE NEUTRA + ACENTO NEON)
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
                <strong className="text-2xl font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                  187
                </strong>
                <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] dark:bg-[#388BFF]/20 text-[#155EEF] dark:text-[#388BFF] text-[11px] font-extrabold">
                  ↗ +12%
                </span>
              </div>
              <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block mt-0.5">
                vs. dia anterior (Chat, Whats e E-mail)
              </span>
            </div>
          </div>

          {/* Card 2: Eficiência / Resolvidos (Violeta Neon) */}
          <div className="rounded-2xl bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] p-4 flex items-center gap-3.5 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7942D8] to-[#5B21B6] text-white flex items-center justify-center shadow-md shrink-0">
              <CheckCircle2 size={26} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#526074] dark:text-[#B5C0D0]">
                  Eficiência & Resolução
                </span>
                <Info size={12} className="text-[#8E9BAE]" />
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <strong className="text-2xl font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                  92%
                </strong>
                <span className="px-2 py-0.5 rounded-full bg-[#F3E8FF] dark:bg-[#B66CFF]/20 text-[#7942D8] dark:text-[#B66CFF] text-[11px] font-extrabold">
                  ↗ +2 p.p.
                </span>
              </div>
              <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block mt-0.5">
                Taxa de resolução no 1º contato
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
                  08m 42s
                </strong>
                <span className="px-2 py-0.5 rounded-full bg-[#FFF7ED] dark:bg-[#FF9A35]/20 text-[#BD5D00] dark:text-[#FF9A35] text-[11px] font-extrabold">
                  ↘ -11%
                </span>
              </div>
              <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block mt-0.5">
                vs. período anterior
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
                  96,4%
                </strong>
                <span className="px-2 py-0.5 rounded-full bg-[#ECFEFF] dark:bg-[#24DEFF]/20 text-[#009AC2] dark:text-[#24DEFF] text-[11px] font-extrabold">
                  ↗ +2,1 p.p.
                </span>
              </div>
              <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block mt-0.5">
                Meta ITIL: 95,0%
              </span>
            </div>
          </div>
        </section>

        {/* ===================================================================
            LINHA 2: FAIXA OPERACIONAL GRAFITE DE ALTO CONTRASTE (COMO NA REFERÊNCIA B)
            (FILA DE ATENDIMENTO COM SOM | ATENDENTES | PRODUTIVIDADE & IA)
        =================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Bloco 1: Fila de Atendimento + Alerta Sonoro */}
          <div className="lg:col-span-5 rounded-2xl bg-[#161D29] dark:bg-[#151C27] border border-[#263142] dark:border-[#344154] p-4 text-white flex flex-col justify-between gap-3 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#B5C0D0]">
                <BellRing size={16} className="text-[#FF9A35]" />
                <span>Fila de Atendimento & Alerta Sonoro</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSoundEnabled(true)
                  playQueueAlertSound('critical')
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer border ${
                  soundEnabled
                    ? 'bg-[#FF9A35]/20 text-[#FF9A35] border-[#FF9A35]/40'
                    : 'bg-white/10 text-[#B5C0D0] border-white/15'
                }`}
              >
                <Volume2 size={12} />
                <span>{soundEnabled ? 'Alerta sonoro ativo' : 'Som silenciado'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center pt-1">
              <div className="border-r border-white/10 pr-3">
                <div className="flex items-baseline gap-2">
                  <strong
                    className="text-3xl font-black text-white tabular-nums"
                    data-testid="kpi-queue-current"
                  >
                    {queueCurrent}
                  </strong>
                  <span className="px-2 py-0.5 rounded-full bg-[#FF9A35]/20 text-[#FF9A35] text-[11px] font-extrabold">
                    +{queueDelta30m} (30m)
                  </span>
                </div>
                <span className="text-[11px] text-[#B5C0D0] block mt-0.5">
                  em espera na fila central
                </span>
              </div>

              <div className="pl-1 space-y-1">
                <span className="text-[11px] text-[#B5C0D0] flex items-center gap-1">
                  <Clock size={12} className="text-[#24DEFF]" /> Limite p/ som:{' '}
                  <input
                    type="number"
                    min={3}
                    max={50}
                    value={queueThreshold}
                    onChange={e => setQueueThreshold(Number(e.target.value))}
                    className="w-12 px-1.5 py-0.5 rounded border border-[#344154] bg-[#0B1018] text-center font-bold text-white text-xs"
                  />
                </span>
                <span className="text-[11px] text-[#8E9BAE] block">
                  Último disparo: <strong className="text-white">{lastSoundAlertAt}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Bloco 2: Atendentes (Online / Pausa / Offline) */}
          <div className="lg:col-span-4 rounded-2xl bg-[#161D29] dark:bg-[#151C27] border border-[#263142] dark:border-[#344154] p-4 text-white flex flex-col justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2 text-xs font-bold text-[#B5C0D0]">
              <Users size={16} className="text-[#388BFF]" />
              <span>Atendentes (Limite 3 chats/operador)</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <strong className="text-2xl font-black text-white block tabular-nums">
                  8
                </strong>
                <span className="text-[11px] text-[#43D9A3] font-semibold">
                  ● Disponíveis
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <strong className="text-2xl font-black text-white block tabular-nums">
                  12
                </strong>
                <span className="text-[11px] text-[#388BFF] font-semibold">
                  ● Atendendo
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <strong className="text-2xl font-black text-white block tabular-nums">
                  2
                </strong>
                <span className="text-[11px] text-[#FF9A35] font-semibold">
                  ● Pausa
                </span>
              </div>
            </div>
          </div>

          {/* Bloco 3: Produtividade da Equipe & Modo IA */}
          <div className="lg:col-span-3 rounded-2xl bg-[#161D29] dark:bg-[#151C27] border border-[#263142] dark:border-[#344154] p-4 text-white flex flex-col justify-between gap-2 shadow-md">
            <div className="flex items-center justify-between text-xs font-bold text-[#B5C0D0]">
              <span className="flex items-center gap-1.5">
                <Sparkles size={15} className="text-[#B66CFF]" />
                Produtividade & IA
              </span>
              <select
                value={aiMode}
                onChange={e => setAiMode(e.target.value as typeof aiMode)}
                className="px-2 py-0.5 rounded-lg border border-[#344154] bg-[#0B1018] text-[11px] text-white font-bold cursor-pointer"
              >
                <option value="copiloto">IA Copiloto</option>
                <option value="triagem">IA Triagem</option>
                <option value="autonomia_faq">IA Autônoma</option>
              </select>
            </div>

            <div className="flex items-end justify-between gap-2 pt-1">
              <div>
                <strong className="text-3xl font-black text-white tabular-nums">
                  88,7%
                </strong>
                <span className="text-[11px] text-[#B5C0D0] block">
                  Ocupação saudável SAC
                </span>
              </div>
              <svg className="w-28 h-10" viewBox="0 0 120 40">
                <path
                  d="M4,32 Q25,18 45,24 T85,12 T116,8"
                  fill="none"
                  stroke="#B66CFF"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </section>

        {/* ===================================================================
            LINHA 3: ATENDIMENTOS POR CANAL + EVOLUÇÃO DOS ATENDIMENTOS (AZUL ELÉTRICO)
        =================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Card Esquerdo: Atendimentos por Canal */}
          <div className="lg:col-span-5 bg-white dark:bg-[#151C27] rounded-2xl border border-[#DCE2EA] dark:border-[#344154] p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-extrabold text-[#111827] dark:text-[#F7F9FC]">
                Atendimentos por Canal
              </h2>
              <p className="text-xs text-[#526074] dark:text-[#B5C0D0]">
                Distribuição diária por canal de entrada (Chat, WhatsApp e E-mail)
              </p>
            </div>

            <div className="space-y-3.5">
              {/* Canal 1: Chat */}
              <div className="grid grid-cols-12 items-center gap-2 text-xs">
                <div className="col-span-5 flex items-center gap-2.5 font-bold text-[#111827] dark:text-[#F7F9FC]">
                  <span className="w-7 h-7 rounded-lg bg-[#EFF6FF] dark:bg-[#388BFF]/15 text-[#155EEF] dark:text-[#388BFF] border border-[#BFDBFE] dark:border-[#388BFF]/30 flex items-center justify-center">
                    <MessageSquare size={14} />
                  </span>
                  <span>Chat SafeSaff</span>
                </div>
                <div className="col-span-2 text-right font-black text-sm text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                  76
                </div>
                <div className="col-span-5">
                  <div className="flex justify-between text-[10px] text-[#526074] dark:text-[#B5C0D0] font-semibold mb-1">
                    <span>41% do total</span>
                    <span className="text-[#155EEF] dark:text-[#388BFF] font-bold">+18%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#EEF2F6] dark:bg-[#1D2735] overflow-hidden">
                    <div className="h-full bg-[#155EEF] dark:bg-[#388BFF] rounded-full" style={{ width: '41%' }} />
                  </div>
                </div>
              </div>

              {/* Canal 2: WhatsApp */}
              <div className="grid grid-cols-12 items-center gap-2 text-xs pt-2 border-t border-[#DCE2EA]/60 dark:border-[#344154]/60">
                <div className="col-span-5 flex items-center gap-2.5 font-bold text-[#111827] dark:text-[#F7F9FC]">
                  <span className="w-7 h-7 rounded-lg bg-[#ECFEFF] dark:bg-[#24DEFF]/15 text-[#009AC2] dark:text-[#24DEFF] border border-[#A5F3FC] dark:border-[#24DEFF]/30 flex items-center justify-center">
                    <MessageCircle size={14} />
                  </span>
                  <span>WhatsApp</span>
                </div>
                <div className="col-span-2 text-right font-black text-sm text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                  59
                </div>
                <div className="col-span-5">
                  <div className="flex justify-between text-[10px] text-[#526074] dark:text-[#B5C0D0] font-semibold mb-1">
                    <span>31% do total</span>
                    <span className="text-[#009AC2] dark:text-[#24DEFF] font-bold">+9%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#EEF2F6] dark:bg-[#1D2735] overflow-hidden">
                    <div className="h-full bg-[#009AC2] dark:bg-[#24DEFF] rounded-full" style={{ width: '31%' }} />
                  </div>
                </div>
              </div>

              {/* Canal 3: E-mail */}
              <div className="grid grid-cols-12 items-center gap-2 text-xs pt-2 border-t border-[#DCE2EA]/60 dark:border-[#344154]/60">
                <div className="col-span-5 flex items-center gap-2.5 font-bold text-[#111827] dark:text-[#F7F9FC]">
                  <span className="w-7 h-7 rounded-lg bg-[#F3E8FF] dark:bg-[#B66CFF]/15 text-[#7942D8] dark:text-[#B66CFF] border border-[#D8B4FE] dark:border-[#B66CFF]/30 flex items-center justify-center">
                    <Mail size={14} />
                  </span>
                  <span>E-mail</span>
                </div>
                <div className="col-span-2 text-right font-black text-sm text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                  52
                </div>
                <div className="col-span-5">
                  <div className="flex justify-between text-[10px] text-[#526074] dark:text-[#B5C0D0] font-semibold mb-1">
                    <span>28% do total</span>
                    <span className="text-[#7942D8] dark:text-[#B66CFF] font-bold">-6%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#EEF2F6] dark:bg-[#1D2735] overflow-hidden">
                    <div className="h-full bg-[#7942D8] dark:bg-[#B66CFF] rounded-full" style={{ width: '28%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card Direito: Evolução dos Atendimentos (Gráfico Azul Elétrico + Violeta) */}
          <div className="lg:col-span-7 bg-white dark:bg-[#151C27] rounded-2xl border border-[#DCE2EA] dark:border-[#344154] p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-[#111827] dark:text-[#F7F9FC]">
                  Evolução dos Atendimentos ao Longo do Dia
                </h2>
                <p className="text-xs text-[#526074] dark:text-[#B5C0D0]">
                  Comparativo entre demanda recebida e atendimentos solucionados (08h às 18h)
                </p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-[#161D29] text-white text-xs font-bold tabular-nums">
                Pico: 214 atendimentos
              </span>
            </div>

            <svg viewBox="0 0 600 155" className="w-full h-40 overflow-visible">
              <defs>
                <linearGradient id="sacBlueArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#155EEF" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#155EEF" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[20, 50, 80, 110, 135].map((y, idx) => (
                <g key={y}>
                  <line x1="32" y1={y} x2="585" y2={y} stroke="#DCE2EA" strokeOpacity="0.35" />
                  <text x="24" y={y + 3} fontSize="9" fill="#8E9BAE" textAnchor="end">
                    {(5 - idx) * 50}
                  </text>
                </g>
              ))}
              <path
                d="M40,120 C90,108 140,82 190,76 C240,72 290,94 340,86 C390,78 440,42 490,34 C530,44 560,62 580,56 L580,135 L40,135 Z"
                fill="url(#sacBlueArea)"
              />
              <path
                d="M40,120 C90,108 140,82 190,76 C240,72 290,94 340,86 C390,78 440,42 490,34 C530,44 560,62 580,56"
                fill="none"
                stroke="#155EEF"
                strokeWidth="3"
              />
              <path
                d="M40,126 C90,115 140,94 190,88 C240,86 290,104 340,96 C390,90 440,56 490,48 C530,58 560,74 580,68"
                fill="none"
                stroke="#7942D8"
                strokeWidth="2.2"
                strokeDasharray="4,4"
              />
              {['08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h', '18h'].map(
                (h, i) => (
                  <text
                    key={h}
                    x={40 + i * 54}
                    y="150"
                    fontSize="9"
                    fill="#8E9BAE"
                    textAnchor="middle"
                  >
                    {h}
                  </text>
                )
              )}
            </svg>
          </div>
        </section>

        {/* ===================================================================
            LINHA 4: SLA POR PRIORIDADE & ITIL (ESQUERDA) + SKILLS DA EQUIPE (DIREITA)
        =================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Card Esquerdo: SLA por Prioridade & ITIL (Azul, Violeta, Laranja) */}
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
                    Cumprimento de prazo por criticidade (P1 Alta, P2 Média, P3 Baixa)
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-[#EFF6FF] dark:bg-[#388BFF]/15 text-[#155EEF] dark:text-[#388BFF] border border-[#BFDBFE] dark:border-[#388BFF]/30 text-[11px] font-extrabold">
                ITIL v4 Ativo
              </span>
            </div>

            {/* 3 Anéis de Prioridade como na Referência B (98,7% Alta Azul | 96,1% Média Violeta | 93,2% Baixa Laranja) */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              {[
                { label: 'Alta (P1)', pct: '98,7%', color: '#155EEF', offset: 251.2 * (1 - 0.987) },
                { label: 'Média (P2)', pct: '96,1%', color: '#7942D8', offset: 251.2 * (1 - 0.961) },
                { label: 'Baixa (P3)', pct: '93,2%', color: '#EA580C', offset: 251.2 * (1 - 0.932) }
              ].map(ring => (
                <div
                  key={ring.label}
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
                        strokeDashoffset={ring.offset}
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <strong className="absolute text-sm font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                      {ring.pct}
                    </strong>
                  </div>
                  <span className="text-xs font-bold text-[#526074] dark:text-[#B5C0D0] mt-1.5">
                    {ring.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Principais Demandas (Top 5) */}
            <div className="pt-2 border-t border-[#DCE2EA] dark:border-[#344154] space-y-2">
              <strong className="text-xs font-extrabold text-[#111827] dark:text-[#F7F9FC] block">
                Principais Demandas do Dia (Top 4)
              </strong>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                {[
                  { name: 'Reembolso', pct: '28,4%', bar: 'bg-[#155EEF]' },
                  { name: 'Cancelamento de show', pct: '18,7%', bar: 'bg-[#7942D8]' },
                  { name: 'Troca / 2ª via de ingresso', pct: '14,9%', bar: 'bg-[#009AC2]' },
                  { name: 'Alteração de evento', pct: '11,6%', bar: 'bg-[#EA580C]' }
                ].map(d => (
                  <div
                    key={d.name}
                    className="p-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154]"
                  >
                    <div className="flex justify-between font-bold text-[#111827] dark:text-[#F7F9FC] mb-1">
                      <span className="truncate">{d.name}</span>
                      <span className="tabular-nums">{d.pct}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#DCE2EA] dark:bg-[#101620] overflow-hidden">
                      <div className={`h-full rounded-full ${d.bar}`} style={{ width: d.pct.replace(',', '.') }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card Direito: Skills da Equipe (Com Busca, Tabela e Menu Gerenciar Skills do Supervisor) */}
          <div className="lg:col-span-6 bg-white dark:bg-[#151C27] rounded-2xl border border-[#DCE2EA] dark:border-[#344154] p-5 shadow-xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#F3E8FF] dark:bg-[#B66CFF]/15 text-[#7942D8] dark:text-[#B66CFF] flex items-center justify-center">
                  <Users size={18} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#111827] dark:text-[#F7F9FC]">
                    Skills da Equipe SAC
                  </h2>
                  <p className="text-xs text-[#526074] dark:text-[#B5C0D0]">
                    Gerencie as competências dos colaboradores para roteamento inteligente
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingCollabId(collaborators[0]?.id || null)
                  setShowManageSkillsModal(true)
                }}
                data-testid="btn-open-manage-skills"
                className="px-3.5 py-2 rounded-xl bg-[#155EEF] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Gerenciar Skills</span>
              </button>
            </div>

            {/* Busca de Colaborador */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[#8E9BAE]" />
              <input
                type="text"
                value={skillSearch}
                onChange={e => setSkillSearch(e.target.value)}
                placeholder="Buscar colaborador ou skill (ex: Financeiro, ITIL, N2)..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#DCE2EA] dark:border-[#344154] bg-[#F5F7FA] dark:bg-[#101620] text-xs text-[#111827] dark:text-[#F7F9FC] focus:outline-hidden"
              />
            </div>

            {/* Tabela de Colaboradores & Skills */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#DCE2EA] dark:border-[#344154] text-[11px] font-bold text-[#526074] dark:text-[#B5C0D0]">
                    <th className="py-2 pr-2">Colaborador</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2 text-center">Chats</th>
                    <th className="py-2 pl-2">Skills</th>
                    <th className="py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE2EA]/60 dark:divide-[#344154]/60">
                  {filteredCollaborators.map(collab => (
                    <tr key={collab.id} className="hover:bg-[#F5F7FA] dark:hover:bg-[#1D2735]">
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-[#EFF6FF] dark:bg-[#388BFF]/20 text-[#155EEF] dark:text-[#388BFF] font-bold text-[11px] flex items-center justify-center shrink-0">
                            {collab.initials}
                          </span>
                          <strong className="font-bold text-[#111827] dark:text-[#F7F9FC]">
                            {collab.name}
                          </strong>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            collab.status === 'Disponível'
                              ? 'bg-[#ECFDF5] dark:bg-[#43D9A3]/15 text-[#16734A] dark:text-[#43D9A3] border border-[#A7F3D0] dark:border-[#43D9A3]/30'
                              : 'bg-[#EFF6FF] dark:bg-[#388BFF]/15 text-[#155EEF] dark:text-[#388BFF] border border-[#BFDBFE] dark:border-[#388BFF]/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              collab.status === 'Disponível' ? 'bg-[#16734A]' : 'bg-[#155EEF]'
                            }`}
                          />
                          {collab.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-black text-[#111827] dark:text-[#F7F9FC] tabular-nums">
                        {collab.activeChats}/3
                      </td>
                      <td className="py-2.5 pl-2">
                        <div className="flex flex-wrap gap-1">
                          {collab.skills.map(sk => (
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
                            setEditingCollabId(collab.id)
                            setShowManageSkillsModal(true)
                          }}
                          title={`Editar skills de ${collab.name}`}
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
                    Inteligência Artificial no Atendimento (Cliente + Copiloto SAC)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F3E8FF] dark:bg-[#B66CFF]/20 text-[#7942D8] dark:text-[#B66CFF] border border-[#D8B4FE] dark:border-[#B66CFF]/40 text-[10px] font-extrabold">
                    IA Dupla Ativa • Governança SLA & ITIL
                  </span>
                </div>
                <p className="text-xs text-[#526074] dark:text-[#B5C0D0]">
                  A IA atende o cliente por temas (Cancelamento de show, Reembolso, Ingressos, Alteração de evento, Pagamento) e apoia os atendentes do SAC como Copiloto.
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

          {/* 4 Cards de Indicadores da IA no Dashboard SAC */}
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
                Resolução pela IA
              </span>
              <strong className="text-3xl font-black text-[#155EEF] dark:text-[#388BFF] block tabular-nums">
                {aiMetrics.resolvedByAiPercent}%
              </strong>
              <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block">
                Dúvidas resolvidas sem fila humana
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
                SLA IA → Humano
              </span>
              <strong className="text-3xl font-black text-[#009AC2] dark:text-[#24DEFF] block tabular-nums">
                {aiMetrics.slaAiToHumanPercent}%
              </strong>
              <span className="text-[11px] text-[#526074] dark:text-[#8E9BAE] block">
                Transições dentro do tempo de SLA
              </span>
            </div>
          </div>

          {/* Painel Duplo: Demonstração Interativa da IA para o Cliente + Base de Conhecimento da IA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
            <div className="lg:col-span-7 rounded-2xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-xs font-extrabold text-[#111827] dark:text-[#F7F9FC] block">
                    🤖 Como o Cliente conversa com a IA no Chat SafeSaff
                  </strong>
                  <span className="text-[11px] text-[#526074] dark:text-[#B5C0D0]">
                    Selecione um tema abaixo para visualizar as perguntas e respostas automáticas configuradas
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#F3E8FF] dark:bg-[#B66CFF]/20 text-[#7942D8] dark:text-[#B66CFF] text-[10px] font-bold">
                  Online · IA + Equipe SAC
                </span>
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
                  <div className="rounded-xl bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154] p-3.5 space-y-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#155EEF] text-white ml-8">
                      <span className="text-[10px] opacity-85 block font-bold">
                        Cliente escolheu o tema: {currentTopic.label}
                      </span>
                      <p className="mt-0.5">{currentTopic.initialQuestion}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F3E8FF]/60 dark:bg-[#7942D8]/15 border border-[#D8B4FE] dark:border-[#B66CFF]/35 text-[#111827] dark:text-[#F7F9FC] mr-6 space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-[#526074] dark:text-[#B5C0D0]">
                        <strong className="text-[#7942D8] dark:text-[#B66CFF]">
                          🤖 Assistente Virtual SafeSaff (IA)
                        </strong>
                        <span>
                          Skill: <strong>{currentTopic.requiredSkill}</strong> • Prioridade {currentTopic.priority}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {currentTopic.guidedAnswer}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {currentTopic.followUpPrompts.map(fp => (
                          <span
                            key={fp.id}
                            className="px-2.5 py-1 rounded-full bg-white dark:bg-[#1D2735] text-[#7942D8] dark:text-[#B66CFF] border border-[#D8B4FE] dark:border-[#B66CFF]/40 text-[10px] font-bold"
                          >
                            {fp.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Direita: Base de Conhecimento Oficial da IA & Copiloto dos Atendentes */}
            <div className="lg:col-span-5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-extrabold text-[#111827] dark:text-[#F7F9FC]">
                    📚 Base de Conhecimento da IA & Copiloto
                  </strong>
                  <span className="px-2 py-0.5 rounded bg-[#EFF6FF] dark:bg-[#388BFF]/20 text-[#155EEF] dark:text-[#388BFF] text-[10px] font-bold">
                    {knowledgeArticles.filter(a => a.status === 'approved').length || 6} artigos aprovados
                  </span>
                </div>
                <p className="text-[11px] text-[#526074] dark:text-[#B5C0D0] leading-relaxed">
                  A IA utiliza exclusivamente estes temas validados pelo supervisor tanto para responder ao cliente quanto para sugerir respostas privadas ao atendente do SAC:
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { title: 'Cancelamento de show', desc: 'Regras, comunicados e prazos' },
                    { title: 'Reembolso', desc: 'Política CDC, prazos PIX/Cartão' },
                    { title: 'Ingressos', desc: '2ª via QR Code e titularidade' },
                    { title: 'Alteração de evento', desc: 'Nova data, horário ou local' },
                    { title: 'Problemas de pagamento', desc: 'PIX, cartão e duplicidade' },
                    { title: 'Reclamações', desc: 'Registro, prioridade e SLA/ITIL' }
                  ].map(topic => (
                    <div
                      key={topic.title}
                      className="p-2.5 rounded-xl bg-white dark:bg-[#151C27] border border-[#DCE2EA] dark:border-[#344154]"
                    >
                      <strong className="text-[#111827] dark:text-[#F7F9FC] block text-xs">
                        {topic.title}
                      </strong>
                      <span className="text-[10px] text-[#526074] dark:text-[#B5C0D0] block mt-0.5">
                        {topic.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F3E8FF]/70 dark:bg-[#7942D8]/20 border border-[#D8B4FE] dark:border-[#B66CFF]/40 flex items-center justify-between text-xs">
                <div>
                  <strong className="text-[#7942D8] dark:text-[#B66CFF] block">
                    Copiloto do Atendente Ativo
                  </strong>
                  <span className="text-[11px] text-[#111827] dark:text-[#F7F9FC]">
                    {aiMetrics.copilotAcceptedCount}/{aiMetrics.copilotSuggestionsTotal} sugestões aproveitadas pela equipe SAC
                  </span>
                </div>
                {onOpenLiveChat && (
                  <button
                    type="button"
                    onClick={onOpenLiveChat}
                    className="px-3 py-1.5 rounded-lg bg-[#7942D8] hover:bg-[#6D28D9] text-white font-bold text-[11px] cursor-pointer"
                  >
                    Gerenciar Base
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* =====================================================================
          MODAL DO SUPERVISOR: GERENCIAR SKILLS DOS COLABORADORES DO SAC
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
                  Atribuição de Skills (Competências) aos Colaboradores
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
                  1. Selecione o Colaborador do SAC:
                </label>
                <div className="flex flex-wrap gap-2">
                  {collaborators.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditingCollabId(c.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold border flex items-center gap-2 cursor-pointer ${
                        editingCollaborator?.id === c.id
                          ? 'bg-[#155EEF] text-white border-[#155EEF]'
                          : 'bg-[#F5F7FA] dark:bg-[#1D2735] text-[#111827] dark:text-[#F7F9FC] border-[#DCE2EA] dark:border-[#344154]'
                      }`}
                    >
                      <span>{c.name}</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-black/15 text-[10px]">
                        {c.skills.length} skills
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {editingCollaborator && (
                <div className="p-4 rounded-xl bg-[#F5F7FA] dark:bg-[#1D2735] border border-[#DCE2EA] dark:border-[#344154] space-y-3">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm text-[#111827] dark:text-[#F7F9FC]">
                      Skills de {editingCollaborator.name}
                    </strong>
                    <span className="text-[11px] text-[#526074] dark:text-[#B5C0D0]">
                      Clique nas competências para habilitar ou remover
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skillCatalog.map(skill => {
                      const active = editingCollaborator.skills.includes(skill)
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() =>
                            toggleSkillOnCollaborator(editingCollaborator.id, skill)
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
                      placeholder="Cadastrar nova skill no catálogo (ex: Reembolso PIX, Bilheteria, Meia-Entrada)..."
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
                        toggleSkillOnCollaborator(editingCollaborator.id, clean)
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
