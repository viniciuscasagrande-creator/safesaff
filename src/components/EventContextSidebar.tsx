import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import {
  Activity, ArrowLeft, BarChart3, CalendarDays, ChevronRight, ChevronDown, CircleGauge, FileBarChart2,
  Link2, MapPin, Megaphone, MousePointerClick, ScanLine, ScrollText, Settings2, ShieldCheck,
  Tags, Ticket, UserCog, Users, WalletCards, Waves, Boxes, ContactRound, Siren, Brain, Search, Gauge, Network, ClipboardCheck, Shield, LineChart, RadioTower, Split, Scale
} from 'lucide-react'
import type { EventItem } from '../data/events'
import type { PageKey } from './ModuleSidebar'
import type { ProducerEvent } from '../types/context.types'
import GlobalEventSelector from './context/GlobalEventSelector'

type Item = { key: PageKey; label: string; icon: ComponentType<{ size?: number }> }
type Props = {
  event: EventItem
  page: PageKey
  onNavigate: (page: PageKey) => void
  onBack: () => void
  onSelectOtherEvent?: (event: ProducerEvent) => void
  canAdmin?: boolean
}

const eventItems: Item[] = [
  { key: 'event-command-center', label: 'Cockpit Operacional', icon: Activity },
  { key: 'event-inventory', label: 'Inventário e Lotes', icon: Boxes },
  { key: 'event-customer-360', label: 'Consulta de Clientes', icon: ContactRound },
  { key: 'event-live-ops', label: 'Live Operations', icon: RadioTower },
  { key: 'event-incidents', label: 'Incident Center', icon: Siren },
  { key: 'event-revenue-intel', label: 'Revenue Intelligence', icon: LineChart },
  { key: 'event-global-search', label: 'Busca Global', icon: Search },
  { key: 'event-intelligence', label: 'Disk Intelligence', icon: Brain },
  { key: 'event-readiness', label: 'Readiness / Go-Live', icon: ClipboardCheck },
  { key: 'event-forecast', label: 'Forecast Center', icon: Gauge },
  { key: 'event-day-command', label: 'Event Day Command', icon: Activity },
  { key: 'event-producer-executive', label: 'Executive Dashboard', icon: BarChart3 },
  { key: 'event-platform-noc', label: 'Platform NOC', icon: Network },
  { key: 'event-dashboard', label: 'Dashboard', icon: CircleGauge },
  { key: 'event-tickets', label: 'Consultar Ingresso', icon: Ticket },
  { key: 'event-courtesy', label: 'Cortesias', icon: Tags },
  { key: 'event-reports', label: 'Relatórios', icon: FileBarChart2 },
  { key: 'event-details', label: 'Detalhes', icon: Settings2 },
  { key: 'event-commercial-conditions', label: 'Condições Comerciais', icon: Scale },
]

const marketingItems: Item[] = [
  { key: 'event-pixel', label: 'Pixel GA', icon: ScanLine },
  { key: 'event-utm', label: 'Central UTM & Conversões', icon: Link2 },
  { key: 'event-ga4', label: 'Analytics GA4', icon: BarChart3 },
  { key: 'event-traffic', label: 'Tráfego Site', icon: MousePointerClick },
  { key: 'event-meta-ads', label: 'Campanhas Meta Ads', icon: Megaphone },
  { key: 'event-remarketing', label: 'Remarketing', icon: Waves },
]

const financeItems: Item[] = [
  { key: 'finance-bordero', label: 'Borderô do Evento', icon: WalletCards },
  { key: 'finance-cost-centers', label: 'Custos & Orçamento', icon: Boxes },
  { key: 'finance-split', label: 'Divisão de Receitas', icon: Split }
]

const configItems: Item[] = [
  { key: 'event-users', label: 'Usuários', icon: Users },
  { key: 'event-audit', label: 'Logs', icon: ScrollText },
  { key: 'event-permissions', label: 'Permissões', icon: ShieldCheck },
  { key: 'event-permission-engine', label: 'Permission Engine', icon: Shield },
  { key: 'event-compliance', label: 'Audit & Compliance', icon: ScrollText },
]

export default function EventContextSidebar({
  event,
  page,
  onNavigate,
  onBack,
  onSelectOtherEvent,
  canAdmin = true
}: Props) {
  const getActiveEventGroup = (currentPage: PageKey): string => {
    if (['event-inventory', 'event-customer-360', 'event-revenue-intel', 'event-global-search', 'event-intelligence', 'event-forecast', 'event-producer-executive', 'event-reports'].includes(currentPage)) return 'gestao'
    if (['event-tickets', 'event-courtesy'].includes(currentPage)) return 'vendas'
    if (marketingItems.some(item => item.key === currentPage)) return 'marketing'
    if (financeItems.some(item => item.key === currentPage)) return 'financeiro'
    if (configItems.some(item => item.key === currentPage) || ['event-details', 'event-commercial-conditions'].includes(currentPage)) return 'governanca'
    return 'operacao'
  }
  const [openGroup, setOpenGroup] = useState(() => getActiveEventGroup(page))
  useEffect(() => {
    setOpenGroup(getActiveEventGroup(page))
  }, [page])
  const toggleGroup = (key: string) => setOpenGroup(current => current === key ? '' : key)
  return (
    <aside className="module-sidebar event-context-sidebar" data-testid="event-context-sidebar">
      <button className="back-module event-back" onClick={onBack} title="Voltar a Todos os Eventos" data-testid="event-sidebar-back">
        <ArrowLeft size={18} />
        <span>← Todos os Eventos</span>
      </button>

      {/* Seletor rápido de evento no topo da sidebar individual */}
      <div className="p-2 border-b border-[#1e293b] bg-[#0b1222]" data-testid="event-sidebar-switcher-wrap">
        <GlobalEventSelector
          compact
          onEventChange={(newEvent) => {
            if (!newEvent) {
              onBack()
            } else if (onSelectOtherEvent) {
              onSelectOtherEvent(newEvent)
            }
          }}
        />
      </div>

      <div className="event-context-summary">
        <div className={`event-context-cover ${event.cover}`}>
          <span>{event.code || `#${event.id}`}</span>
        </div>
        <div className="event-context-copy">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-[#06b6d4] bg-[#0891b2]/20 px-1.5 py-0.5 rounded">
              ID {event.code || `#${event.id}`}
            </span>
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/50">
              Evento Ativo
            </span>
          </div>
          <strong className="truncate max-w-[190px] text-xs text-white mt-1" title={event.title}>
            {event.title}
          </strong>
          {event.venue && <span><MapPin size={11} /> {event.venue}</span>}
          {event.date && <span><CalendarDays size={11} /> {event.date}</span>}
        </div>
      </div>

      <nav className="module-nav event-context-nav safesaff-event-mega-nav">
        <div className="module-caption">CENTRAL DO EVENTO</div>
        <EventMegaGroup id="operacao" label="Visão Geral e Operações" icon={Activity} open={openGroup === 'operacao'} onToggle={() => toggleGroup('operacao')}>
          {eventItems.filter(item => ['event-command-center','event-dashboard','event-live-ops','event-incidents','event-readiness','event-day-command','event-platform-noc'].includes(item.key)).map(item => <Nav key={item.key} item={item} page={page} onNavigate={onNavigate} />)}
        </EventMegaGroup>
        <EventMegaGroup id="gestao" label="Gestão e Inteligência" icon={Brain} open={openGroup === 'gestao'} onToggle={() => toggleGroup('gestao')}>
          {eventItems.filter(item => ['event-inventory','event-customer-360','event-revenue-intel','event-global-search','event-intelligence','event-forecast','event-producer-executive','event-reports'].includes(item.key)).map(item => <Nav key={item.key} item={item} page={page} onNavigate={onNavigate} />)}
        </EventMegaGroup>
        <EventMegaGroup id="vendas" label="Vendas e Participantes" icon={Ticket} open={openGroup === 'vendas'} onToggle={() => toggleGroup('vendas')}>
          {eventItems.filter(item => ['event-tickets','event-courtesy'].includes(item.key)).map(item => <Nav key={item.key} item={item} page={page} onNavigate={onNavigate} />)}
        </EventMegaGroup>
        <EventMegaGroup id="marketing" label="Marketing e Aquisição" icon={Megaphone} open={openGroup === 'marketing'} onToggle={() => toggleGroup('marketing')}>
          {marketingItems.map(item => <Nav key={item.key} item={item} page={page} onNavigate={onNavigate} />)}
        </EventMegaGroup>
        <EventMegaGroup id="financeiro" label="Financeiro do Evento" icon={WalletCards} open={openGroup === 'financeiro'} onToggle={() => toggleGroup('financeiro')}>
          {financeItems.map(item => <Nav key={item.key} item={item} page={page} onNavigate={onNavigate} />)}
        </EventMegaGroup>
        <EventMegaGroup id="governanca" label="Configurações e Governança" icon={ShieldCheck} open={openGroup === 'governanca'} onToggle={() => toggleGroup('governanca')}>
          {configItems.filter(item => canAdmin || !['event-users','event-permissions','event-permission-engine'].includes(item.key)).map(item => <Nav key={item.key} item={item} page={page} onNavigate={onNavigate} />)}
          <Nav item={{key:'event-details',label:'Detalhes do Evento',icon:Settings2}} page={page} onNavigate={onNavigate} />
          <Nav item={{key:'event-commercial-conditions',label:'Condições Comerciais',icon:Scale}} page={page} onNavigate={onNavigate} />
        </EventMegaGroup>
        {canAdmin && <>
          <div className="nav-divider" />
          <div className="module-caption">ATALHOS OPERACIONAIS</div>
          <button className="module-nav-item" onClick={() => onNavigate('lots')}><WalletCards size={18} /><span>Configurar Lotes</span></button>
          <button className="module-nav-item" onClick={() => onNavigate('participants')}><UserCog size={18} /><span>Participantes</span></button>
          <button className="module-nav-item" onClick={() => onNavigate('operations')}><Activity size={18} /><span>Núcleo Operacional</span></button>
        </>}
      </nav>
    </aside>
  )
}

function Nav({ item, page, onNavigate }: { item: Item; page: PageKey; onNavigate: (p: PageKey) => void }) {
  const Icon = item.icon
  return (
    <button
      className={`module-nav-item ${page === item.key ? 'active' : ''}`}
      onClick={() => onNavigate(item.key)}
      data-testid={`event-nav-${item.key}`}
    >
      <Icon size={18} />
      <span>{item.label}</span>
    </button>
  )
}


function EventMegaGroup({ id, label, icon: Icon, open, onToggle, children }: { id: string; label: string; icon: ComponentType<{ size?: number }>; open: boolean; onToggle: () => void; children: ReactNode }) {
  return <section className={`safesaff-event-mega-group ${open ? 'open' : ''}`}>
    <button type="button" className="safesaff-event-mega-trigger" onClick={onToggle} aria-expanded={open} data-testid={`event-mega-${id}`}>
      <Icon size={17} /><span>{label}</span>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
    </button>
    {open && <div className="safesaff-event-mega-content">{children}</div>}
  </section>
}
