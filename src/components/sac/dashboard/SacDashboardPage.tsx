import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
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
  TrendingDown,
  TrendingUp,
  UserCheck,
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
    activeChats: 4,
    maxChats: 4,
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
  const [soundMutedMinutes, setSoundMutedMinutes] = useState<number>(0)
  const [lastSoundAlertAt, setLastSoundAlertAt] = useState<string>('10:00')
  const [queueHistory, setQueueHistory] = useState<
    { time: string; value: number }[]
  >([
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

  // Reprodutor de Alerta Sonoro Sintetizado (Web Audio API — não depende de arquivo externo)
  const playQueueAlertSound = (severity: 'warning' | 'critical' = 'critical') => {
    if (!soundEnabled || soundMutedMinutes > 0) return
    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
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

      // Alerta duplo ascendente padrão supervisão de call center / NOC
      const baseFreq = severity === 'critical' ? 587.33 : 440 // D5 ou A4
      const secondFreq = severity === 'critical' ? 880 : 659.25 // A5 ou E5

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
      // Fallback silencioso caso o navegador bloqueie autoplay antes de clique
    }
  }

  // Simular crescimento da fila e disparar o som de alerta se ultrapassar o limite configurado
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
      className="min-h-screen bg-[#F4F7F6] text-slate-800 rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden flex flex-col lg:flex-row font-sans"
      data-testid="sac-dashboard-enterprise"
    >
      {/* =====================================================================
          SIDEBAR INTERNA DO MÓDULO SAC (IDÊNTICA À IMAGEM APROVADA)
      ===================================================================== */}
      <aside className="w-full lg:w-60 bg-[#F8FAF9] border-b lg:border-b-0 lg:border-r border-slate-200/80 flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-5">
          {/* Logo SafeSaff ERP */}
          <div className="px-2 pt-1 flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tight text-[#0F6E4B]">
              SafeSaff
            </span>
            <span className="text-lg font-medium text-slate-400">ERP</span>
          </div>

          {/* Menu SAC */}
          <nav className="space-y-1">
            {(
              [
                { id: 'dashboard' as const, label: 'Dashboard SAC', icon: Layers },
                { id: 'atendimentos' as const, label: 'Atendimentos', icon: Headphones },
                { id: 'fila' as const, label: 'Fila', icon: Activity },
                { id: 'sla_itil' as const, label: 'SLA & ITIL', icon: ShieldCheck },
                { id: 'skills' as const, label: 'Skills da Equipe', icon: Users },
                { id: 'ia_sac' as const, label: 'IA do SAC (Copiloto)', icon: Bot },
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
                      ? 'bg-[#D3EFE2] text-[#0E5E40] shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Icon size={17} className={isActive ? 'text-[#0E5E40]' : 'text-slate-500'} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Rodapé SAC – Supervisão */}
        <div className="mt-6 p-3 rounded-2xl bg-[#EEF4F1] border border-slate-200/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#D3EFE2] text-[#0E5E40] flex items-center justify-center shrink-0">
            <Headphones size={18} />
          </div>
          <div className="min-w-0">
            <strong className="text-xs font-extrabold text-slate-800 block truncate">
              SAC – Supervisão
            </strong>
            <span className="text-[10px] text-slate-500 leading-tight block">
              Atendimento multicanal com controle de SLA e ITIL
            </span>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          ÁREA PRINCIPAL DO DASHBOARD SAC
      ===================================================================== */}
      <div className="flex-1 p-5 lg:p-6 space-y-5 overflow-y-auto">
        {/* TOPO: TÍTULO + FILTRO HOJE + NOTIFICAÇÃO + PERFIL SUPERVISOR */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Dashboard SAC
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoramento diário de atendimento (Chat, E-mail e WhatsApp) • Baseado em SLA e ITIL
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Botão para testar o som do alerta imediatamente */}
            <button
              type="button"
              onClick={() => playQueueAlertSound('critical')}
              data-testid="btn-test-queue-sound"
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Tocar som de alerta de crescimento da fila agora"
            >
              <Volume2 size={15} className="text-rose-600" />
              <span>Testar Som de Fila</span>
            </button>

            <button
              type="button"
              onClick={handleSimulateQueueGrowth}
              data-testid="btn-simulate-queue-growth"
              className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Simular chegada de novos chamados na fila e disparar alerta sonoro"
            >
              <Plus size={14} />
              <span>Simular +Fila ({queueCurrent})</span>
            </button>

            {/* Seletor de Data (Hoje) */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-2xs text-xs font-semibold text-slate-700">
              <Calendar size={15} className="text-slate-400" />
              <select
                value={periodFilter}
                onChange={e => setPeriodFilter(e.target.value as typeof periodFilter)}
                className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="Hoje">Hoje</option>
                <option value="Últimas 24h">Últimas 24h</option>
                <option value="Últimos 7 dias">Últimos 7 dias</option>
              </select>
            </div>

            {/* Sino de Alerta com Ponto Verde */}
            <button
              type="button"
              onClick={() => setSoundEnabled(prev => !prev)}
              className="relative w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer shadow-2xs"
              title={soundEnabled ? 'Alerta sonoro ativado (clique para silenciar)' : 'Alerta sonoro silenciado'}
            >
              {soundEnabled ? <Bell size={18} /> : <VolumeX size={18} className="text-rose-500" />}
              <span
                className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                  soundEnabled ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
            </button>

            {/* Badge SP Supervisor SAC */}
            <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-full pl-1.5 pr-3.5 py-1 shadow-2xs">
              <div className="w-8 h-8 rounded-full bg-[#157347] text-white font-black text-xs flex items-center justify-center">
                SP
              </div>
              <span className="text-xs font-bold text-slate-800">Supervisor SAC</span>
            </div>
          </div>
        </header>

        {/* ===================================================================
            LINHA 1: 5 CARDS GRANDES (EFICIÊNCIA | FILA ATUAL | SLA NO PRAZO | TMA | ATENDIMENTOS DO DIA)
        =================================================================== */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5">
          {/* Card 1: Eficiência */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#E6F7EE] to-[#D4F0E2] border border-[#BFE6D3] p-4 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <div className="w-7 h-7 rounded-lg bg-[#15803D]/15 text-[#15803D] flex items-center justify-center">
                <Target size={16} />
              </div>
              <span>Eficiência</span>
              <Info size={13} className="text-slate-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2.5">
              <strong className="text-3xl font-black text-slate-900">92%</strong>
              <span className="px-2 py-0.5 rounded-full bg-[#BCEAD2] text-[#0E6235] text-[11px] font-extrabold">
                ▲ +2 p.p.
              </span>
            </div>
            <svg className="w-full h-7 mt-2 opacity-45" viewBox="0 0 200 32" preserveAspectRatio="none">
              <path d="M0,26 Q45,18 90,22 T160,12 T200,6 L200,32 L0,32 Z" fill="#10B981" />
            </svg>
          </div>

          {/* Card 2: Fila Atual */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FDF1E6] to-[#FBE4D2] border border-[#F5D0B5] p-4 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <div className="w-7 h-7 rounded-lg bg-[#D97706]/15 text-[#B45309] flex items-center justify-center">
                <Users size={16} />
              </div>
              <span>Fila Atual</span>
              <Info size={13} className="text-slate-400" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-2.5">
              <strong className="text-3xl font-black text-slate-900" data-testid="kpi-queue-current">
                {queueCurrent}
              </strong>
              <span className="px-2 py-0.5 rounded-full bg-[#FCD5CE] text-[#B91C1C] text-[11px] font-extrabold">
                ▲ +{queueDelta30m}
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-600 block mt-1">
              Chamados aguardando atendimento
            </span>
          </div>

          {/* Card 3: SLA no Prazo */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#E6F7EE] to-[#D4F0E2] border border-[#BFE6D3] p-4 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <div className="w-7 h-7 rounded-lg bg-[#15803D]/15 text-[#15803D] flex items-center justify-center">
                <ShieldCheck size={16} />
              </div>
              <span>SLA no Prazo</span>
              <Info size={13} className="text-slate-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2.5">
              <strong className="text-3xl font-black text-slate-900">96%</strong>
              <span className="px-2 py-0.5 rounded-full bg-[#BCEAD2] text-[#0E6235] text-[11px] font-extrabold">
                ▲ +1 p.p.
              </span>
            </div>
            <svg className="w-full h-7 mt-2 opacity-45" viewBox="0 0 200 32" preserveAspectRatio="none">
              <path d="M0,25 Q55,20 110,16 T200,8 L200,32 L0,32 Z" fill="#10B981" />
            </svg>
          </div>

          {/* Card 4: TMA */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#EBF3FE] to-[#DCEAFE] border border-[#C3Dafe] p-4 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <div className="w-7 h-7 rounded-lg bg-blue-600/15 text-blue-700 flex items-center justify-center">
                <Clock size={16} />
              </div>
              <span>TMA</span>
              <Info size={13} className="text-slate-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <strong className="text-2xl font-black text-slate-900">08m 42s</strong>
              <span className="px-2 py-0.5 rounded-full bg-[#BCEAD2] text-[#0E6235] text-[10px] font-extrabold">
                ▼ -01m 18s
              </span>
            </div>
            <svg className="w-full h-7 mt-2 opacity-45" viewBox="0 0 200 32" preserveAspectRatio="none">
              <path d="M0,22 Q65,12 130,18 T200,9 L200,32 L0,32 Z" fill="#3B82F6" />
            </svg>
          </div>

          {/* Card 5: Atendimentos do Dia */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#F3EEFD] to-[#E7DDFB] border border-[#D5C5F7] p-4 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <div className="w-7 h-7 rounded-lg bg-purple-600/15 text-purple-700 flex items-center justify-center">
                <Headphones size={16} />
              </div>
              <span>Atendimentos do Dia</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2.5">
              <strong className="text-3xl font-black text-slate-900">187</strong>
              <span className="px-2 py-0.5 rounded-full bg-[#BCEAD2] text-[#0E6235] text-[11px] font-extrabold">
                ▲ +12%
              </span>
            </div>
            <svg className="w-full h-7 mt-2 opacity-45" viewBox="0 0 200 32" preserveAspectRatio="none">
              <path d="M0,26 Q60,22 120,14 T200,7 L200,32 L0,32 Z" fill="#8B5CF6" />
            </svg>
          </div>
        </section>

        {/* ===================================================================
            LINHA 2: ATENDIMENTO POR CANAL (CHAT, E-MAIL, WHATSAPP) + ALERTA DE FILA COM SOM
        =================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Card Esquerdo: Atendimento por Canal */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Atendimento por Canal
              </h2>
              <p className="text-xs text-slate-500">
                Volume de atendimentos do dia por canal (multicanal)
              </p>
            </div>

            <div className="space-y-3.5">
              {/* Canal 1: Chat */}
              <div className="grid grid-cols-12 items-center gap-2 text-xs">
                <div className="col-span-4 flex items-center gap-2.5 font-bold text-slate-800">
                  <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                    <MessageSquare size={14} />
                  </span>
                  <span>Chat</span>
                </div>
                <div className="col-span-2 text-right font-black text-base text-slate-900">
                  76
                </div>
                <div className="col-span-2">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                    ▲ +18%
                  </span>
                </div>
                <div className="col-span-4">
                  <span className="text-[10px] text-slate-500 font-semibold block mb-1">
                    41% do total
                  </span>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-[#15803D] rounded-full" style={{ width: '41%' }} />
                  </div>
                </div>
              </div>

              {/* Canal 2: E-mail */}
              <div className="grid grid-cols-12 items-center gap-2 text-xs pt-2 border-t border-slate-100">
                <div className="col-span-4 flex items-center gap-2.5 font-bold text-slate-800">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                    <Mail size={14} />
                  </span>
                  <span>E-mail</span>
                </div>
                <div className="col-span-2 text-right font-black text-base text-slate-900">
                  52
                </div>
                <div className="col-span-2">
                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold text-[10px]">
                    ▼ -6%
                  </span>
                </div>
                <div className="col-span-4">
                  <span className="text-[10px] text-slate-500 font-semibold block mb-1">
                    28% do total
                  </span>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-[#15803D] rounded-full" style={{ width: '28%' }} />
                  </div>
                </div>
              </div>

              {/* Canal 3: WhatsApp */}
              <div className="grid grid-cols-12 items-center gap-2 text-xs pt-2 border-t border-slate-100">
                <div className="col-span-4 flex items-center gap-2.5 font-bold text-slate-800">
                  <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                    <MessageCircle size={14} />
                  </span>
                  <span>WhatsApp</span>
                </div>
                <div className="col-span-2 text-right font-black text-base text-slate-900">
                  59
                </div>
                <div className="col-span-2">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                    ▲ +9%
                  </span>
                </div>
                <div className="col-span-4">
                  <span className="text-[10px] text-slate-500 font-semibold block mb-1">
                    31% do total
                  </span>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-[#15803D] rounded-full" style={{ width: '31%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card Direito: Alerta de Fila (com Alerta Sonoro Ativo + Gráfico Evolução da Fila) */}
          <div className="lg:col-span-7 bg-gradient-to-r from-[#FFF5F5] via-white to-white rounded-2xl border border-rose-200/90 p-5 shadow-2xs grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-2xs">
                    <BellRing size={24} className="animate-bounce" />
                  </div>
                  <h2 className="text-base font-black text-slate-900">
                    Alerta de Fila
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSoundEnabled(true)
                    playQueueAlertSound('critical')
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer ${
                    soundEnabled
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <Volume2 size={13} />
                  <span>{soundEnabled ? 'Alerta sonoro ativo' : 'Som silenciado'}</span>
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                O sistema emite um som de alerta quando a fila de atendimentos cresce acima do limite configurado (<strong>{queueThreshold} chamados</strong> • último disparo às {lastSoundAlertAt}).
              </p>

              <div className="p-3 rounded-xl bg-rose-50/90 border border-rose-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <TrendingUp size={18} className="text-rose-600 shrink-0" />
                  <div>
                    <strong className="text-xs font-extrabold text-rose-800 block">
                      Fila em crescimento
                    </strong>
                    <span className="text-[11px] text-slate-600">
                      +{queueDelta30m} chamados nos últimos 30 min
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-slate-500">Limite:</span>
                  <input
                    type="number"
                    min={3}
                    max={50}
                    value={queueThreshold}
                    onChange={e => setQueueThreshold(Number(e.target.value))}
                    className="w-12 px-1.5 py-0.5 rounded border border-rose-300 bg-white text-center font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Mini-Gráfico: Evolução da Fila (última hora) */}
            <div className="md:col-span-5 bg-white rounded-xl border border-slate-200/80 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-700">
                  Evolução da Fila (última hora)
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-xs">
                  {queueCurrent}
                </span>
              </div>
              <svg viewBox="0 0 240 100" className="w-full h-24 overflow-visible">
                <defs>
                  <linearGradient id="queueAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {/* Linhas horizontais de grade */}
                {[20, 45, 70, 90].map(y => (
                  <line
                    key={y}
                    x1="20"
                    y1={y}
                    x2="230"
                    y2={y}
                    stroke="#E2E8F0"
                    strokeDasharray="2,2"
                  />
                ))}
                {/* Área e Linha */}
                <path
                  d="M25,78 L58,70 L92,68 L125,54 L158,46 L192,39 L225,22 L225,90 L25,90 Z"
                  fill="url(#queueAreaGrad)"
                />
                <path
                  d="M25,78 L58,70 L92,68 L125,54 L158,46 L192,39 L225,22"
                  fill="none"
                  stroke="#DC2626"
                  strokeWidth="2.5"
                />
                {[
                  { x: 25, y: 78, t: '09:00' },
                  { x: 58, y: 70, t: '09:10' },
                  { x: 92, y: 68, t: '09:20' },
                  { x: 125, y: 54, t: '09:30' },
                  { x: 158, y: 46, t: '09:40' },
                  { x: 192, y: 39, t: '09:50' },
                  { x: 225, y: 22, t: '10:00' }
                ].map((pt, i) => (
                  <g key={pt.t}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={i === 6 ? 4.5 : 3}
                      fill={i === 6 ? '#DC2626' : '#FFFFFF'}
                      stroke="#DC2626"
                      strokeWidth="2"
                    />
                    <text
                      x={pt.x}
                      y="99"
                      fontSize="7.5"
                      fill="#64748B"
                      textAnchor="middle"
                    >
                      {pt.t}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </section>

        {/* ===================================================================
            LINHA 3: FILA E ATENDIMENTO AO LONGO DO DIA + SUPERVISÃO EM TEMPO REAL
        =================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Gráfico Comparativo ao Longo do Dia */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Fila e Atendimento ao Longo do Dia
              </h2>
              <p className="text-xs text-slate-500">
                Comparativo entre demanda recebida e atendimentos solucionados (08:00 às 18:00)
              </p>
            </div>

            <svg viewBox="0 0 600 170" className="w-full h-44 overflow-visible">
              <defs>
                <linearGradient id="solvedBlueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {[25, 55, 85, 115, 145].map((y, idx) => (
                <g key={y}>
                  <line x1="32" y1={y} x2="585" y2={y} stroke="#F1F5F9" />
                  <text x="24" y={y + 3} fontSize="9" fill="#94A3B8" textAnchor="end">
                    {(5 - idx) * 10}
                  </text>
                </g>
              ))}
              {/* Curva Azul: Atendimentos Solucionados */}
              <path
                d="M40,128 C90,115 140,85 190,82 C240,80 290,112 340,108 C390,104 440,62 490,68 C530,74 560,102 580,108 L580,145 L40,145 Z"
                fill="url(#solvedBlueGrad)"
              />
              <path
                d="M40,128 C90,115 140,85 190,82 C240,80 290,112 340,108 C390,104 440,62 490,68 C530,74 560,102 580,108"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.5"
              />
              {/* Curva Verde: Demanda (Entradas) */}
              <path
                d="M40,125 C90,102 140,65 190,62 C240,60 290,98 340,94 C390,90 440,46 490,52 C530,58 560,88 580,96"
                fill="none"
                stroke="#16A34A"
                strokeWidth="2.5"
              />
              {[
                '08:00',
                '09:00',
                '10:00',
                '11:00',
                '12:00',
                '13:00',
                '14:00',
                '15:00',
                '16:00',
                '17:00',
                '18:00'
              ].map((h, i) => (
                <text
                  key={h}
                  x={40 + i * 54}
                  y="162"
                  fontSize="9"
                  fill="#64748B"
                  textAnchor="middle"
                >
                  {h}
                </text>
              ))}
            </svg>

            <div className="flex items-center justify-center gap-6 text-xs font-bold pt-1">
              <span className="flex items-center gap-2 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
                Demanda (entradas) – <strong>198</strong>
              </span>
              <span className="flex items-center gap-2 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                Atendimentos (solucionados) – <strong>187</strong>
              </span>
            </div>
          </div>

          {/* Card Supervisão (Situação da equipe e da fila em tempo real) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Supervisão</h2>
                <p className="text-xs text-slate-500">
                  Situação da equipe e da fila em tempo real
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-[#EAF8F0] border border-[#C6E9D6] p-4 text-center space-y-1">
                <span className="text-xs font-bold text-slate-700 block">
                  Agentes disponíveis
                </span>
                <strong className="text-3xl font-black text-[#15803D] block">8</strong>
              </div>

              <div className="rounded-2xl bg-[#EEF5FF] border border-[#CFE0FC] p-4 text-center space-y-1">
                <span className="text-xs font-bold text-slate-700 block">
                  Agentes em atendimento
                </span>
                <strong className="text-3xl font-black text-[#1D4ED8] block">12</strong>
              </div>

              <div className="rounded-2xl bg-[#FFF0F0] border border-[#FCD2D2] p-4 text-center space-y-1">
                <span className="text-xs font-bold text-slate-700 block">
                  Clientes em fila
                </span>
                <strong className="text-3xl font-black text-[#DC2626] block">
                  {queueCurrent}
                </strong>
              </div>
            </div>

            {/* Controle Rápido da IA do SAC pelo Supervisor */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-[#0F6E4B]" />
                <div>
                  <strong className="text-slate-800 block">
                    IA do SAC: Modo {aiMode === 'copiloto' ? 'Copiloto Assistido' : aiMode === 'triagem' ? 'Triagem + Skills' : 'Autonomia FAQ'}
                  </strong>
                  <span className="text-[11px] text-slate-500">
                    Limite de 3 conversas/agente + roteamento por Skill ativo
                  </span>
                </div>
              </div>
              <select
                value={aiMode}
                onChange={e => setAiMode(e.target.value as typeof aiMode)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-bold text-xs text-slate-800 cursor-pointer"
              >
                <option value="copiloto">1. IA Copiloto (Recomendado)</option>
                <option value="triagem">2. IA Triagem & Skills</option>
                <option value="autonomia_faq">3. IA FAQ Autônomo</option>
              </select>
            </div>
          </div>
        </section>

        {/* ===================================================================
            LINHA 4: SLA & ITIL (ESQUERDA) + SKILLS DA EQUIPE COM EDIÇÃO DO SUPERVISOR (DIREITA)
        =================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Card Esquerdo: SLA & ITIL */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">SLA & ITIL</h2>
                  <p className="text-xs text-slate-500">
                    Conformidade, prioridades e indicadores de atendimento
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-[#E6F7EE] text-[#0E6235] border border-[#BFE6D3] text-[11px] font-extrabold flex items-center gap-1">
                <Check size={13} /> Operação baseada em SLA e ITIL
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-1">
              {/* Donut 96% SLA no Prazo */}
              <div className="md:col-span-3 flex flex-col items-center justify-center">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#E2E8F0"
                      strokeWidth="10"
                      fill="none"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#15803D"
                      strokeWidth="10"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 * (1 - 0.96)}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <strong className="text-xl font-black text-slate-900">96%</strong>
                    <span className="text-[10px] font-semibold text-slate-500">
                      SLA no Prazo
                    </span>
                  </div>
                </div>
              </div>

              {/* Prioridades (P1, P2, P3) + Prazo 1ª Resposta e Resolução */}
              <div className="md:col-span-5 space-y-2.5">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Prioridades (chamados do dia)
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-black text-[11px]">
                      P1
                    </span>
                    <span className="font-bold text-slate-800">7 (4%)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-black text-[11px]">
                      P2
                    </span>
                    <span className="font-bold text-slate-800">32 (17%)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[11px]">
                      P3
                    </span>
                    <span className="font-bold text-slate-800">148 (79%)</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      Em atraso (aging)
                    </span>
                    <strong className="text-lg font-black text-rose-600">4</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      SLA 1ª Resp.
                    </span>
                    <strong className="text-lg font-black text-[#15803D]">98%</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      SLA Resolução
                    </span>
                    <strong className="text-lg font-black text-[#15803D]">96%</strong>
                  </div>
                </div>
              </div>

              {/* Checklist Baseado em SLA e ITIL */}
              <div className="md:col-span-4 space-y-1.5 text-[11px] text-slate-700 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
                <strong className="text-xs font-extrabold text-slate-900 block mb-2">
                  Baseado em SLA e ITIL
                </strong>
                {[
                  'Priorização por criticidade (P1, P2, P3)',
                  'Controle de prazos (1ª resposta e resolução)',
                  'Gestão de fila e escalonamento',
                  'Registro e categorização de chamados',
                  'Conformidade com práticas ITIL'
                ].map(item => (
                  <div key={item} className="flex items-start gap-1.5">
                    <Check size={13} className="text-[#15803D] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card Direito: Skills da Equipe (Com Busca, Tabela e Menu Gerenciar Skills do Supervisor) */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Users size={18} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Skills da Equipe
                  </h2>
                  <p className="text-xs text-slate-500">
                    Gerencie as skills (competências) dos colaboradores do SAC
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
                className="px-3.5 py-2 rounded-xl bg-[#157347] hover:bg-[#115c39] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Gerenciar Skills</span>
              </button>
            </div>

            {/* Busca de Colaborador */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={skillSearch}
                onChange={e => setSkillSearch(e.target.value)}
                placeholder="Buscar colaborador ou skill (ex: Financeiro, ITIL, N2)..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-800 focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Tabela de Colaboradores & Skills */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500">
                    <th className="py-2 pr-2">Colaborador</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2 text-center">Atendimentos Ativos</th>
                    <th className="py-2 pl-2">Skills (editar)</th>
                    <th className="py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCollaborators.map(collab => (
                    <tr key={collab.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                            {collab.initials}
                          </span>
                          <strong className="font-bold text-slate-800">
                            {collab.name}
                          </strong>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            collab.status === 'Disponível'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              collab.status === 'Disponível'
                                ? 'bg-emerald-600'
                                : 'bg-blue-600'
                            }`}
                          />
                          {collab.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-black text-slate-800">
                        {collab.activeChats}
                      </td>
                      <td className="py-2.5 pl-2">
                        <div className="flex flex-wrap gap-1">
                          {collab.skills.map(sk => (
                            <span
                              key={sk}
                              className="px-2 py-0.5 rounded-md bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6] text-[10px] font-bold"
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
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
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
            LINHA 5: INTELIGÊNCIA ARTIFICIAL NO ATENDIMENTO SAC
            (IA PARA O CLIENTE POR TEMA/ASSUNTO + COPILOTO DO ATENDENTE + 4 CARDS DE INDICADORES DA IA)
        =================================================================== */}
        <section
          className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4"
          data-testid="sac-dashboard-ai-section"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#D3EFE2] text-[#0E5E40] flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900">
                    Inteligência Artificial no Atendimento (Cliente + Copiloto SAC)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#E6F7EE] text-[#0E6235] border border-[#BFE6D3] text-[10px] font-extrabold">
                    Ativo • Governança SLA & ITIL
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  A IA atende o cliente por temas (Cancelamento de show, Reembolso, Ingressos, Alteração de evento, Pagamento) e também apoia os atendentes do SAC como Copiloto.
                </p>
              </div>
            </div>

            {onOpenLiveChat && (
              <button
                type="button"
                onClick={onOpenLiveChat}
                className="px-3.5 py-2 rounded-xl bg-[#157347] hover:bg-[#115c39] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Sparkles size={14} />
                <span>Abrir Chat com IA & Copiloto</span>
              </button>
            )}
          </div>

          {/* 4 Cards de Indicadores da IA no Dashboard SAC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="rounded-2xl bg-[#F8FAF9] border border-slate-200/90 p-4 space-y-1">
              <span className="text-xs font-bold text-slate-600 block">
                Atendimentos pela IA
              </span>
              <strong className="text-3xl font-black text-[#0F6E4B] block">
                {aiMetrics.totalAiAttendances}
              </strong>
              <span className="text-[11px] text-slate-500 block">
                Conversas iniciadas com triagem da IA
              </span>
            </div>

            <div className="rounded-2xl bg-[#F8FAF9] border border-slate-200/90 p-4 space-y-1">
              <span className="text-xs font-bold text-slate-600 block">
                Resolução pela IA
              </span>
              <strong className="text-3xl font-black text-[#0F6E4B] block">
                {aiMetrics.resolvedByAiPercent}%
              </strong>
              <span className="text-[11px] text-slate-500 block">
                Dúvidas resolvidas sem fila humana
              </span>
            </div>

            <div className="rounded-2xl bg-[#F8FAF9] border border-slate-200/90 p-4 space-y-1">
              <span className="text-xs font-bold text-slate-600 block">
                Transferidos ao SAC
              </span>
              <strong className="text-3xl font-black text-[#D97706] block">
                {aiMetrics.transferredToSacPercent}%
              </strong>
              <span className="text-[11px] text-slate-500 block">
                Encaminhados com resumo e skill
              </span>
            </div>

            <div className="rounded-2xl bg-[#F8FAF9] border border-slate-200/90 p-4 space-y-1">
              <span className="text-xs font-bold text-slate-600 block">
                SLA IA → Humano
              </span>
              <strong className="text-3xl font-black text-[#1D4ED8] block">
                {aiMetrics.slaAiToHumanPercent}%
              </strong>
              <span className="text-[11px] text-slate-500 block">
                Transições dentro do tempo de SLA
              </span>
            </div>
          </div>

          {/* Painel Duplo: Demonstração Interativa da IA para o Cliente + Base de Conhecimento da IA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
            {/* Esquerda: Temas e Respostas da IA para o Cliente */}
            <div className="lg:col-span-7 rounded-2xl bg-[#F8FAF9] border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-xs font-extrabold text-slate-900 block">
                    🤖 Como o Cliente conversa com a IA no Chat SafeSaff
                  </strong>
                  <span className="text-[11px] text-slate-500">
                    Selecione um tema abaixo para visualizar as perguntas e respostas automáticas configuradas
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#D3EFE2] text-[#0E5E40] text-[10px] font-bold">
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
                        ? 'bg-[#157347] text-white border-[#157347]'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
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
                  <div className="rounded-xl bg-white border border-slate-200 p-3.5 space-y-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#157347] text-white ml-8">
                      <span className="text-[10px] opacity-80 block font-bold">
                        Cliente escolheu o tema: {currentTopic.label}
                      </span>
                      <p className="mt-0.5">{currentTopic.initialQuestion}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 mr-6 space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <strong className="text-[#0F6E4B]">
                          🤖 Assistente Virtual SafeSaff
                        </strong>
                        <span>
                          Skill vinculada: <strong>{currentTopic.requiredSkill}</strong> • Prioridade {currentTopic.priority}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {currentTopic.guidedAnswer}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {currentTopic.followUpPrompts.map(fp => (
                          <span
                            key={fp.id}
                            className="px-2.5 py-1 rounded-full bg-[#E6F4EA] text-[#0E5E40] border border-[#BFE6D3] text-[10px] font-bold"
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
            <div className="lg:col-span-5 rounded-2xl bg-[#F8FAF9] border border-slate-200 p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-extrabold text-slate-900">
                    📚 Base de Conhecimento da IA & Copiloto
                  </strong>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    {knowledgeArticles.filter(a => a.status === 'approved').length || 6} artigos aprovados
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
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
                      className="p-2.5 rounded-xl bg-white border border-slate-200/90"
                    >
                      <strong className="text-slate-900 block text-xs">
                        {topic.title}
                      </strong>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {topic.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#E6F7EE] border border-[#BFE6D3] flex items-center justify-between text-xs">
                <div>
                  <strong className="text-[#0E6235] block">
                    Copiloto do Atendente Ativo
                  </strong>
                  <span className="text-[11px] text-slate-700">
                    {aiMetrics.copilotAcceptedCount}/{aiMetrics.copilotSuggestionsTotal} sugestões aproveitadas pela equipe SAC
                  </span>
                </div>
                {onOpenLiveChat && (
                  <button
                    type="button"
                    onClick={onOpenLiveChat}
                    className="px-3 py-1.5 rounded-lg bg-[#157347] text-white font-bold text-[11px] cursor-pointer"
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
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowManageSkillsModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
            data-testid="modal-manage-sac-skills"
          >
            <div className="bg-[#0F6E4B] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 block">
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
              {/* Seleção do Colaborador */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
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
                          ? 'bg-[#0F6E4B] text-white border-[#0F6E4B]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
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

              {/* Grade de Skills para Ativar/Desativar no Colaborador */}
              {editingCollaborator && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm text-slate-900">
                      Skills de {editingCollaborator.name}
                    </strong>
                    <span className="text-[11px] text-slate-500">
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
                              ? 'bg-[#157347] text-white border-[#157347] shadow-2xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {active && <Check size={13} />}
                          <span>{skill}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Criar nova Skill no Catálogo */}
                  <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                    <input
                      type="text"
                      value={newCustomSkill}
                      onChange={e => setNewCustomSkill(e.target.value)}
                      placeholder="Cadastrar nova skill no catálogo (ex: Reembolso PIX, Bilheteria, Meia-Entrada)..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800"
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
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                    >
                      + Adicionar Skill
                    </button>
                  </div>
                </div>
              )}

              {/* Regras de Roteamento por Skill + IA */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
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

                <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
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
                  className="px-4 py-2 rounded-xl bg-[#157347] hover:bg-[#115c39] text-white font-bold cursor-pointer"
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
