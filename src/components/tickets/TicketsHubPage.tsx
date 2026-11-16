// ============================================================================
// FASE 29.10+: CENTRAL ENTERPRISE DE INGRESSOS & GOVERNANÇA (DISK CORE)
// Sequencial Numérico de 8 Dígitos, Regra CDC 7 Dias vs SAC, Cortesia Suporte Eventos
// e Restrição de Consulta de CPF (Exclusivo SAC, Estorno e Financeiro)
// ============================================================================

import React, { useState, useEffect } from 'react'
import {
  Ticket,
  Search,
  Filter,
  RefreshCw,
  ArrowRightLeft,
  ShieldCheck,
  ShieldAlert,
  QrCode,
  Lock,
  History,
  Plus,
  Ban,
  CheckCircle2,
  Clock,
  Gift,
  Headphones,
  UserCheck,
  Hash
} from 'lucide-react'
import type {
  TicketRecord,
  TicketsAccessSummary,
  OperatorDepartment
} from '../../types/tickets-access.types'
import {
  ticketsAccessService,
  canDepartmentConsultCpf,
  isCpfSearchTerm
} from '../../services/ticketsAccess.service'
import { TransferTicketModal } from './TransferTicketModal'
import { ReissueTicketModal } from './ReissueTicketModal'

const DEPARTMENT_OPTIONS: {
  id: OperatorDepartment
  label: string
  shortDesc: string
  cpfAllowed: boolean
  cancelRuleText: string
}[] = [
  {
    id: 'SAC',
    label: 'Atendimento SAC',
    shortDesc: 'Consulta CPF Liberada • Cancela ingressos (inclusive após 7 dias) e cortesias',
    cpfAllowed: true,
    cancelRuleText: 'Acesso total ao cancelamento (dentro e após 7 dias da compra)'
  },
  {
    id: 'ESTORNO',
    label: 'Setor de Estorno',
    shortDesc: 'Consulta CPF Liberada • Cancela e processa estornos pós-7 dias via protocolo SAC',
    cpfAllowed: true,
    cancelRuleText: 'Autorizado para cancelamento e estorno financeiro'
  },
  {
    id: 'FINANCEIRO',
    label: 'Setor Financeiro',
    shortDesc: 'Consulta CPF Liberada • Auditoria de pagamentos, borderô e conciliação',
    cpfAllowed: true,
    cancelRuleText: 'Consulta financeira e validação de estornos'
  },
  {
    id: 'SUPORTE_EVENTOS',
    label: 'Suporte de Eventos',
    shortDesc: 'Consulta Ingresso (8 dígitos) • Cancela CORTESIA • Ingresso de Cliente NÃO • Sem CPF',
    cpfAllowed: false,
    cancelRuleText: 'Pode cancelar apenas CORTESIA (ingresso de cliente bloqueado)'
  },
  {
    id: 'CLIENTE',
    label: 'Cliente (Autoatendimento)',
    shortDesc: 'Consulta Ingresso (8 dígitos) • Cancela até 7 dias após compra • Após 7d somente SAC',
    cpfAllowed: false,
    cancelRuleText: 'Cancelamento direto até 7 dias após a compra; após 7 dias somente via SAC'
  }
]

export const TicketsHubPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'transfers' | 'credentials'>('tickets')
  const [activeDepartment, setActiveDepartment] = useState<OperatorDepartment>('SAC')
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [summary, setSummary] = useState<TicketsAccessSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('TODOS')
  const [selectedModality, setSelectedModality] = useState('TODOS')
  const [governanceAlert, setGovernanceAlert] = useState<{
    type: 'error' | 'success' | 'warning'
    message: string
  } | null>(null)

  // Modal / Drawer de Emissão de Novo Ingresso / Cortesia (Sequencial 8 Dígitos)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [issueForm, setIssueForm] = useState({
    modality: 'INTEIRA' as 'INTEIRA' | 'MEIA_ENTRADA' | 'PROMO' | 'CORTESIA',
    holderName: '',
    holderDocument: '',
    holderEmail: '',
    sector: 'Plateia Premium A',
    seat: 'Fileira C - Poltrona 08',
    priceCents: 34000
  })

  // Modais de Transferência e Reemissão
  const [transferTarget, setTransferTarget] = useState<TicketRecord | null>(null)
  const [reissueTarget, setReissueTarget] = useState<TicketRecord | null>(null)

  const currentDeptInfo =
    DEPARTMENT_OPTIONS.find(d => d.id === activeDepartment) || DEPARTMENT_OPTIONS[0]
  const cpfAllowed = canDepartmentConsultCpf(activeDepartment)

  const loadData = async (overrideDepartment?: OperatorDepartment, overrideQuery?: string) => {
    const dept = overrideDepartment || activeDepartment
    const q = overrideQuery !== undefined ? overrideQuery : searchQuery
    setLoading(true)
    try {
      const [ticketsRes, summaryRes] = await Promise.all([
        ticketsAccessService.getTickets({
          q,
          status: selectedStatus,
          modality: selectedModality,
          department: dept
        }),
        ticketsAccessService.getAccessSummary()
      ])

      if (ticketsRes.error) {
        setGovernanceAlert({
          type: 'error',
          message: ticketsRes.error
        })
      }
      setTickets(ticketsRes.data)
      setSummary(summaryRes)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(activeDepartment)
  }, [selectedStatus, selectedModality, activeDepartment])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setGovernanceAlert(null)
    if (searchQuery.trim() && isCpfSearchTerm(searchQuery) && !canDepartmentConsultCpf(activeDepartment)) {
      setGovernanceAlert({
        type: 'error',
        message: `Acesso Negado para [${currentDeptInfo.label}]: A consulta por CPF é permitida exclusivamente pelos setores de SAC, Estorno e Financeiro. Utilize o número sequencial de 8 dígitos do ingresso (ex.: 00010481).`
      })
      return
    }
    loadData(activeDepartment, searchQuery)
  }

  const handleCancelTicket = async (ticket: TicketRecord) => {
    setGovernanceAlert(null)
    const days = ticket.daysSincePurchase ?? 0
    const within7 = ticket.within7DaysWindow ?? days <= 7

    // Validação preventiva de governança no frontend com mensagem clara
    if (activeDepartment === 'SUPORTE_EVENTOS' && ticket.modality !== 'CORTESIA') {
      setGovernanceAlert({
        type: 'error',
        message: `Bloqueio de Governança [Suporte de Eventos]: O Suporte de Eventos pode consultar qualquer ingresso (#${ticket.sequentialNumber}) e cancelar CORTESIAS, mas NÃO possui permissão para cancelar ingressos pagos de clientes (${ticket.modality}).`
      })
      return
    }

    if (activeDepartment === 'CLIENTE') {
      if (ticket.modality === 'CORTESIA') {
        setGovernanceAlert({
          type: 'error',
          message: `Ingresso #${ticket.sequentialNumber} é uma CORTESIA. O cancelamento de cortesias deve ser realizado pelo Suporte de Eventos ou SAC.`
        })
        return
      }
      if (!within7) {
        setGovernanceAlert({
          type: 'error',
          message: `Prazo de 7 dias encerrado para o ingresso #${ticket.sequentialNumber} (comprado há ${days} dias). Após 7 dias da compra, o cancelamento somente é realizado via atendimento do SAC.`
        })
        return
      }
    }

    const sacProtocol =
      activeDepartment === 'SAC' || activeDepartment === 'ESTORNO'
        ? `SAC-2026-${ticket.sequentialNumber.slice(-4)}`
        : undefined

    const res = await ticketsAccessService.blockTicket(
      ticket.id,
      'CANCELAR',
      `Cancelamento efetuado pelo setor ${activeDepartment}`,
      activeDepartment,
      sacProtocol
    )

    if (!res.success) {
      setGovernanceAlert({
        type: 'error',
        message: res.message || res.error || 'Não foi possível cancelar o ingresso.'
      })
      return
    }

    setGovernanceAlert({
      type: 'success',
      message: res.message
    })
    await loadData(activeDepartment)
  }

  const handleIssueNewTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!issueForm.holderName.trim() || !issueForm.holderDocument.trim()) return

    const res = await ticketsAccessService.issueTicket({
      modality: issueForm.modality,
      holderName: issueForm.holderName.trim(),
      holderDocument: issueForm.holderDocument.trim(),
      holderEmail: issueForm.holderEmail.trim() || 'titular@safesaff.com.br',
      sector: issueForm.sector,
      seat: issueForm.seat,
      priceCents: issueForm.modality === 'CORTESIA' ? 0 : issueForm.priceCents
    })

    if (res.success) {
      setGovernanceAlert({
        type: 'success',
        message: res.message
      })
      setShowIssueModal(false)
      setIssueForm({
        modality: 'INTEIRA',
        holderName: '',
        holderDocument: '',
        holderEmail: '',
        sector: 'Plateia Premium A',
        seat: 'Fileira C - Poltrona 09',
        priceCents: 34000
      })
      await loadData(activeDepartment)
    }
  }

  return (
    <div className="space-y-3 w-full max-w-none animate-fadeIn">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              Disk Core • Sequencial 8 Dígitos
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Prazo Legal 7 Dias + Governança SAC / Suporte Eventos
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Ticket className="w-7 h-7 text-indigo-600" />
            Central de Ingressos, Cortesias & Governança de Cancelamento
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-4xl">
            Todo ingresso gerado recebe um <strong>número sequencial de 8 dígitos numéricos</strong> (consulta universal para todos os setores). Cancelamento pelo cliente em até <strong>7 dias após a compra</strong> (após 7 dias somente via <strong>SAC</strong>). <strong>Suporte de Eventos</strong> cancela <strong>Cortesias</strong> (ingresso de cliente não). <strong>Consulta de CPF exclusiva para SAC, Estorno e Financeiro</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowIssueModal(v => !v)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Emitir Ingresso / Cortesia (8 Dígitos)</span>
          </button>
          <button
            type="button"
            onClick={() => loadData(activeDepartment)}
            disabled={loading}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Painel de Governança Operacional por Setor */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                Simulador de Perfil / Setor Operacional Ativo
              </span>
              <p className="text-xs text-slate-300">
                Selecione o setor para validar as travas de <strong>Consulta de CPF</strong>, <strong>Prazo de 7 Dias</strong> e <strong>Cancelamento de Cortesia vs Cliente</strong>:
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                cpfAllowed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {cpfAllowed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Consulta CPF Liberada ({activeDepartment})</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>CPF Restrito (Apenas SAC, Estorno e Financeiro)</span>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {DEPARTMENT_OPTIONS.map(dept => {
            const isSelected = activeDepartment === dept.id
            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => {
                  setGovernanceAlert(null)
                  setActiveDepartment(dept.id)
                }}
                className={`text-left p-3 rounded-xl border transition ${
                  isSelected
                    ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-sm'
                    : 'bg-slate-800/70 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-extrabold text-xs">{dept.label}</span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      dept.cpfAllowed
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {dept.cpfAllowed ? 'CPF OK' : 'SEM CPF'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 leading-snug">{dept.shortDesc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Emissor Rápido de Ingresso / Cortesia com Sequencial de 8 Dígitos */}
      {showIssueModal && (
        <form
          onSubmit={handleIssueNewTicket}
          className="bg-indigo-50/90 border-2 border-indigo-200 rounded-2xl p-5 space-y-4 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                <Hash className="w-4 h-4 text-indigo-600" />
                Gerar Novo Ingresso ou Cortesia (Número Sequencial de 8 Dígitos Automático)
              </h3>
              <p className="text-xs text-indigo-700">
                O sistema atribuirá automaticamente o próximo número sequencial de 8 dígitos numéricos (ex.: <code>00010487</code>) com prazo de 7 dias iniciado hoje.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowIssueModal(false)}
              className="text-xs font-bold text-indigo-700 hover:underline"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Modalidade</label>
              <select
                value={issueForm.modality}
                onChange={e =>
                  setIssueForm(prev => ({
                    ...prev,
                    modality: e.target.value as any,
                    priceCents: e.target.value === 'CORTESIA' ? 0 : 34000
                  }))
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
              >
                <option value="INTEIRA">Inteira (Cliente Pago)</option>
                <option value="MEIA_ENTRADA">Meia-Entrada (Cliente Pago)</option>
                <option value="PROMO">Promocional (Cliente Pago)</option>
                <option value="CORTESIA">Cortesia (Suporte de Eventos)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Nome do Titular</label>
              <input
                type="text"
                required
                placeholder="Ex.: Rafael Mendonça"
                value={issueForm.holderName}
                onChange={e => setIssueForm(prev => ({ ...prev, holderName: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">CPF do Titular</label>
              <input
                type="text"
                required
                placeholder="000.000.000-00"
                value={issueForm.holderDocument}
                onChange={e => setIssueForm(prev => ({ ...prev, holderDocument: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Setor / Assento</label>
              <input
                type="text"
                value={issueForm.seat}
                onChange={e => setIssueForm(prev => ({ ...prev, seat: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-sm"
              >
                Gerar Sequencial 8 Dígitos
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Alerta de Governança / Feedback */}
      {governanceAlert && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 text-xs font-semibold ${
            governanceAlert.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : governanceAlert.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{governanceAlert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setGovernanceAlert(null)}
            className="text-[11px] font-bold underline shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Filtros e Busca (Por 8 Dígitos Numéricos ou CPF restrito ao SAC/Estorno/Financeiro) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={
                cpfAllowed
                  ? 'Consultar por Nº Sequencial de 8 dígitos (ex.: 00010481), CPF (liberado p/ SAC/Estorno/Financeiro), Pedido ou Nome...'
                  : 'Consultar por Nº Sequencial de 8 dígitos (ex.: 00010481) ou Pedido (Consulta por CPF restrita ao SAC, Estorno e Financeiro)...'
              }
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition"
          >
            Consultar Ingresso
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setGovernanceAlert(null)
                loadData(activeDepartment, '')
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition"
            >
              Limpar
            </button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>Modalidade:</span>
          </div>
          <select
            value={selectedModality}
            onChange={e => setSelectedModality(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="TODOS">Todas (Pagos + Cortesias)</option>
            <option value="CORTESIA">Somente Cortesias</option>
            <option value="INTEIRA">Inteira</option>
            <option value="MEIA_ENTRADA">Meia-Entrada</option>
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="ATIVO">Ativos para Entrada</option>
            <option value="UTILIZADO">Check-in Realizado</option>
            <option value="CANCELADO">Cancelados</option>
            <option value="BLOQUEADO">Bloqueados</option>
          </select>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 ${
            activeTab === 'tickets'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>Ingressos & Cortesias ({tickets.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transfers')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 ${
            activeTab === 'transfers'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Histórico de Transferências</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 ${
            activeTab === 'credentials'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Credenciais QR & Segurança</span>
        </button>
      </div>

      {/* Tabela Principal de Ingressos com Governança de 8 Dígitos, 7 Dias e Cortesia */}
      {activeTab === 'tickets' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nº Sequencial (8 Dígitos)</th>
                  <th className="py-3 px-4">Modalidade & Evento</th>
                  <th className="py-3 px-4">Titular / CPF ({cpfAllowed ? 'Visível' : 'Mascarado'})</th>
                  <th className="py-3 px-4 text-center">Janela de Compra (Regra 7 Dias)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Governança de Cancelamento ({currentDeptInfo.label})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                      Nenhum ingresso localizado com os critérios informados.
                    </td>
                  </tr>
                ) : (
                  tickets.map(t => {
                    const isCortesia = t.modality === 'CORTESIA'
                    const days = t.daysSincePurchase ?? 0
                    const within7 = t.within7DaysWindow ?? days <= 7
                    const isCanceledOrUsed =
                      t.status === 'CANCELADO' || t.status === 'BLOQUEADO' || t.status === 'UTILIZADO'

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition">
                        {/* Coluna 1: Sequencial de 8 dígitos */}
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950 text-white font-mono font-black text-xs tracking-wider shadow-2xs">
                            <Hash className="w-3.5 h-3.5 text-indigo-300" />
                            <span>{t.sequentialNumber}</span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400 block mt-1">
                            ID: {t.id} • Pedido #{t.orderId}
                          </span>
                        </td>

                        {/* Coluna 2: Modalidade & Evento */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                isCortesia
                                  ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300'
                                  : t.modality === 'MEIA_ENTRADA'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {isCortesia ? 'CORTESIA' : t.modality.replace('_', '-')}
                            </span>
                            <span className="text-[11px] font-bold text-slate-700">
                              {isCortesia
                                ? 'R$ 0,00 (Cortesia)'
                                : `R$ ${(t.priceCents / 100).toFixed(2).replace('.', ',')}`}
                            </span>
                          </div>
                          <strong className="text-slate-800 block text-xs">{t.eventName}</strong>
                          <span className="text-[11px] text-slate-500">
                            {t.sector} {t.seat ? `• ${t.seat}` : ''}
                          </span>
                        </td>

                        {/* Coluna 3: Titular e CPF com governança */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{t.holderName}</span>
                          <span className="text-[11px] font-mono text-slate-600 flex items-center gap-1 mt-0.5">
                            <span>CPF: {t.holderDocument}</span>
                            {!cpfAllowed && (
                              <span
                                title="Consulta de CPF restrita a SAC, Estorno e Financeiro"
                                className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-sans font-bold"
                              >
                                Protegido
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Comprador: {t.buyerName}
                          </span>
                        </td>

                        {/* Coluna 4: Prazo de 7 dias */}
                        <td className="py-3.5 px-4 text-center">
                          {isCortesia ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-fuchsia-100 text-fuchsia-800 flex items-center gap-1">
                                <Gift className="w-3 h-3" />
                                <span>Ingresso Cortesia</span>
                              </span>
                              <span className="text-[10px] text-slate-500 mt-1">
                                Cancelável por Suporte de Eventos ou SAC
                              </span>
                            </div>
                          ) : within7 ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Dentro de 7 dias ({days}d)</span>
                              </span>
                              <span className="text-[10px] text-emerald-700 font-semibold mt-1">
                                Cliente ou SAC podem cancelar
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-center">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 flex items-center gap-1">
                                <Headphones className="w-3 h-3" />
                                <span>Após 7 dias ({days}d da compra)</span>
                              </span>
                              <span className="text-[10px] text-rose-700 font-bold mt-1">
                                Somente via Atendimento SAC
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Coluna 5: Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              t.status === 'ATIVO'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.status === 'UTILIZADO'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {t.statusLabelPtBr}
                          </span>
                        </td>

                        {/* Coluna 6: Ações de Cancelamento conforme Setor */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {/* Botão de Cancelamento governado pelo Setor */}
                            {!isCanceledOrUsed && (
                              <>
                                {activeDepartment === 'SUPORTE_EVENTOS' ? (
                                  isCortesia ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCancelTicket(t)}
                                      className="px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg font-bold text-[11px] transition flex items-center gap-1 shadow-2xs"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                      <span>Cancelar Cortesia (Suporte Eventos)</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleCancelTicket(t)}
                                      className="px-2.5 py-1.5 bg-slate-100 text-slate-500 border border-slate-300 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-not-allowed"
                                      title="Suporte de Eventos não pode cancelar ingresso de cliente"
                                    >
                                      <Lock className="w-3 h-3 text-rose-500" />
                                      <span>Ingresso Cliente (Bloqueado p/ Suporte)</span>
                                    </button>
                                  )
                                ) : activeDepartment === 'CLIENTE' ? (
                                  isCortesia ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCancelTicket(t)}
                                      className="px-2.5 py-1.5 bg-slate-100 text-slate-500 border border-slate-300 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-not-allowed"
                                    >
                                      <Lock className="w-3 h-3 text-slate-500" />
                                      <span>Cortesia (Solicitar Suporte Eventos)</span>
                                    </button>
                                  ) : within7 ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCancelTicket(t)}
                                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] transition flex items-center gap-1 shadow-2xs"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                      <span>Cancelar (No Prazo de 7 Dias)</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleCancelTicket(t)}
                                      className="px-2.5 py-1.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-lg font-bold text-[10px] flex items-center gap-1"
                                    >
                                      <Headphones className="w-3 h-3 text-amber-700" />
                                      <span>Prazo 7d Expirado → Acionar SAC</span>
                                    </button>
                                  )
                                ) : (
                                  /* SAC, ESTORNO, FINANCEIRO */
                                  <button
                                    type="button"
                                    onClick={() => handleCancelTicket(t)}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] transition flex items-center gap-1 shadow-2xs"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                    <span>
                                      {isCortesia
                                        ? `Cancelar Cortesia (${activeDepartment})`
                                        : within7
                                        ? `Cancelar Ingresso (${activeDepartment})`
                                        : `Cancelar via SAC (> 7 Dias)`}
                                    </span>
                                  </button>
                                )}
                              </>
                            )}

                            <button
                              type="button"
                              disabled={isCanceledOrUsed}
                              onClick={() => setTransferTarget(t)}
                              title="Transferir Titularidade"
                              className="px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 disabled:opacity-40 text-violet-700 rounded-lg font-bold text-[11px] transition flex items-center gap-1"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Transferir</span>
                            </button>

                            <button
                              type="button"
                              disabled={isCanceledOrUsed}
                              onClick={() => setReissueTarget(t)}
                              title="Reemissão Segura Antifraude"
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-800 rounded-lg font-bold text-[11px] transition flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Reemitir</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aba de Histórico de Transferências */}
      {activeTab === 'transfers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-800">
              Cadeia de Custódia e Histórico de Transferências
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Registro indelével de todas as transferências de titularidade vinculadas ao número sequencial de 8 dígitos do ingresso.
          </p>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-indigo-700">TRF-2026-001</span>
                <span className="text-xs text-slate-500 ml-2">
                  • Ingresso Sequencial <strong>#00010481</strong> (TKT-2026-00010481)
                </span>
              </div>
              <span className="text-xs text-slate-400">Auditoria Ativa</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block">De (Titular Anterior):</span>
                <strong className="text-slate-800">Maria Silva Santos</strong>
                <span className="text-[11px] text-slate-500 block">
                  CPF: {cpfAllowed ? '049.281.938-12' : '***.281.938-**'}
                </span>
                <span className="text-[10px] text-rose-600 font-bold block mt-1">
                  Credencial v1 Revogada
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block">Para (Novo Titular):</span>
                <strong className="text-slate-800">Lucas Fernandes Pereira</strong>
                <span className="text-[11px] text-slate-500 block">
                  CPF: {cpfAllowed ? '512.981.234-99' : '***.981.234-**'}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                  Credencial v2 Emitida
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block">Auditoria:</span>
                <span className="text-slate-700 block">Canal: Aplicativo do Comprador</span>
                <span className="text-slate-500 block text-[11px]">
                  IP: 187.55.12.89 • Autenticação MFA
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aba de Credenciais Seguras */}
      {activeTab === 'credentials' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-800">
              Auditoria Criptográfica de Credenciais QR (8 Dígitos)
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            O payload do QR Code referencia o número sequencial de 8 dígitos sem expor o CPF do titular (LGPD Compliant).
          </p>

          <div className="space-y-3">
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-800">
                    CRED-TKT-00010481-V2 (Ingresso #00010481)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ATIVA
                  </span>
                </div>
                <span className="text-[11px] text-slate-600 block mt-1">
                  Payload Ótico:{' '}
                  <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                    DI|TKT-2026-00010481|V2|7d8a9ef01234
                  </code>
                </span>
              </div>
              <div className="text-right text-xs">
                <span className="text-emerald-700 font-bold block">
                  Pronta para Validação no Portão
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modais */}
      {transferTarget && (
        <TransferTicketModal
          isOpen={true}
          ticket={transferTarget}
          onClose={() => setTransferTarget(null)}
          onSuccess={() => {
            setTransferTarget(null)
            loadData(activeDepartment)
          }}
        />
      )}

      {reissueTarget && (
        <ReissueTicketModal
          isOpen={true}
          ticket={reissueTarget}
          onClose={() => setReissueTarget(null)}
          onSuccess={() => {
            setReissueTarget(null)
            loadData(activeDepartment)
          }}
        />
      )}
    </div>
  )
}
