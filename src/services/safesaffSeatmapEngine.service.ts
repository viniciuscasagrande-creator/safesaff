// ============================================================================
// MOTOR PRÓPRIO DE MAPAS SAFESAFF (INSPIRADO NO SEATS.IO — 100% NATIVO)
// Gerencia Setores, Fileiras, Assentos, Lotes, Reservas Hold, Emissão de
// Pedidos/Ingressos (8 dígitos) e Controle de Acesso (Check-in Catraca) em
// tempo real sem recarregar a página e sem depender de plataforma externa.
// ============================================================================

import type {
  SeatShapeType,
  SeatStatusType,
  SeatmapSeatPoint,
  SeatmapZoneElement
} from '../data/events'
import { ticketsAccessService } from './ticketsAccess.service'
import type { TicketRecord } from '../types/tickets-access.types'

export interface SeatTicketBinding {
  seatId: string
  seatKey: string // Ex: "PLATEIA B - Central::FILA A::Polt. 01"
  eventCode: string
  eventName: string
  sectorName: string
  rowLabel: string
  seatLabel: string
  lotId: string
  lotName: string
  categoryId: string
  categoryName: string
  modality: 'INTEIRA' | 'MEIA_ENTRADA' | 'CORTESIA' | 'PROMO'
  priceBRL: number
  orderId: string
  ticketId: string
  sequentialNumber: string
  credentialCode: string
  holderName: string
  holderDocument: string
  holderEmail: string
  holderPhone: string
  salesChannel: 'online_web' | 'box_office_pos' | 'promoters' | 'courtesy_vip'
  status: 'RESERVED_HOLD' | 'SOLD_ACTIVE' | 'CHECKED_IN' | 'CANCELED_REFUNDED'
  holdExpiresAt?: string
  checkInAt?: string
  checkInGate?: string
  checkInDevice?: string
  createdAt: string
  updatedAt: string
}

export interface SeatmapLotRule {
  id: string
  name: string
  sectorName: string
  basePriceBRL: number
  halfPriceBRL: number
  capacity: number
  soldCount: number
  reservedCount: number
  status: 'ativo' | 'agendado' | 'esgotado'
  gateName: string
}

const STORAGE_BINDINGS_KEY = 'safesaff_seatmap_ticket_bindings_v1'
const STORAGE_LOTS_KEY = 'safesaff_seatmap_lots_v1'
const REALTIME_EVENT_NAME = 'safesaff:seatmap-realtime-sync'

export const DEFAULT_SEATMAP_LOTS: SeatmapLotRule[] = [
  {
    id: 'lot-premium-1',
    name: '1º Lote — Plateia Premium Ouro',
    sectorName: 'PLATEIA B - Premium',
    basePriceBRL: 180,
    halfPriceBRL: 90,
    capacity: 120,
    soldCount: 18,
    reservedCount: 2,
    status: 'ativo',
    gateName: 'Portão Principal A (Tapete Vermelho)'
  },
  {
    id: 'lot-central-1',
    name: '1º Lote — Plateia Central',
    sectorName: 'PLATEIA B - Central',
    basePriceBRL: 140,
    halfPriceBRL: 70,
    capacity: 240,
    soldCount: 24,
    reservedCount: 3,
    status: 'ativo',
    gateName: 'Portão Central B'
  },
  {
    id: 'lot-lateral-1',
    name: '1º Lote — Plateias Laterais A/C',
    sectorName: 'PLATEIA A - Lateral Esquerda',
    basePriceBRL: 110,
    halfPriceBRL: 55,
    capacity: 180,
    soldCount: 12,
    reservedCount: 1,
    status: 'ativo',
    gateName: 'Portão Lateral Sul'
  },
  {
    id: 'lot-camarote-1',
    name: 'Lote Único — Camarotes D / E / F',
    sectorName: 'CAMAROTE D',
    basePriceBRL: 220,
    halfPriceBRL: 110,
    capacity: 84,
    soldCount: 15,
    reservedCount: 2,
    status: 'ativo',
    gateName: 'Portão Mezzanino VIP'
  }
]

function notifyRealtimeSubscribers(detail?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(REALTIME_EVENT_NAME, { detail }))
  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('safesaff_seatmap_channel')
      bc.postMessage({ type: 'SYNC', timestamp: Date.now(), ...detail })
      bc.close()
    }
  } catch {
    // Ignore BroadcastChannel errors in restricted contexts
  }
}

export const safesaffSeatmapEngine = {
  // 1. Carregar vínculos de Assentos <-> Pedidos / Ingressos / Controle de Acesso
  loadBindings(): Record<string, SeatTicketBinding> {
    if (typeof window === 'undefined') return {}
    try {
      const raw = localStorage.getItem(STORAGE_BINDINGS_KEY)
      if (!raw) return {}
      return JSON.parse(raw) as Record<string, SeatTicketBinding>
    } catch {
      return {}
    }
  },

  saveBindings(bindings: Record<string, SeatTicketBinding>) {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_BINDINGS_KEY, JSON.stringify(bindings))
    notifyRealtimeSubscribers({ source: 'bindings' })
  },

  // 2. Carregar e Salvar Lotes vinculados aos Setores do Mapa
  loadLots(): SeatmapLotRule[] {
    if (typeof window === 'undefined') return DEFAULT_SEATMAP_LOTS
    try {
      const raw = localStorage.getItem(STORAGE_LOTS_KEY)
      if (!raw) {
        localStorage.setItem(STORAGE_LOTS_KEY, JSON.stringify(DEFAULT_SEATMAP_LOTS))
        return DEFAULT_SEATMAP_LOTS
      }
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SEATMAP_LOTS
    } catch {
      return DEFAULT_SEATMAP_LOTS
    }
  },

  saveLots(lots: SeatmapLotRule[]) {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_LOTS_KEY, JSON.stringify(lots))
    notifyRealtimeSubscribers({ source: 'lots' })
  },

  // 3. Emitir Pedido + Ingresso Real (8 dígitos) para 1 ou mais Assentos e atualizar Disponibilidade em Tempo Real
  async sellOrReserveSeats(params: {
    seatsToProcess: SeatmapSeatPoint[]
    allSeats: SeatmapSeatPoint[]
    mode: 'SELL' | 'RESERVE_HOLD'
    eventCode: string
    eventName: string
    lotId?: string
    categoryId: string
    categoryName: string
    modality: 'INTEIRA' | 'MEIA_ENTRADA' | 'CORTESIA' | 'PROMO'
    unitPriceBRL: number
    holderName: string
    holderDocument: string
    holderEmail: string
    holderPhone: string
    salesChannel: 'online_web' | 'box_office_pos' | 'promoters' | 'courtesy_vip'
    holdMinutes?: number
  }): Promise<{
    updatedSeats: SeatmapSeatPoint[]
    issuedBindings: SeatTicketBinding[]
    orderId: string
  }> {
    const bindings = this.loadBindings()
    const lots = this.loadLots()
    const orderId =
      params.modality === 'CORTESIA'
        ? `CORT-${Date.now().toString().slice(-6)}`
        : `ORD-${Date.now().toString().slice(-6)}`
    const nowIso = new Date().toISOString()
    const holdExpiresAt =
      params.mode === 'RESERVE_HOLD'
        ? new Date(Date.now() + (params.holdMinutes || 15) * 60000).toISOString()
        : undefined

    const issuedBindings: SeatTicketBinding[] = []
    const targetIds = new Set(params.seatsToProcess.map(s => s.id))

    for (const seat of params.seatsToProcess) {
      const matchedLot =
        lots.find(l => l.id === params.lotId) ||
        lots.find(l => seat.sectorName.toLowerCase().includes(l.sectorName.toLowerCase())) ||
        lots[0]

      const seatFormatted = `${seat.rowLabel} - ${seat.label}`
      let ticketId = `TKT-2026-${Math.floor(10000000 + Math.random() * 89999999)}`
      let sequentialNumber = ticketId.slice(-8)
      let credentialCode = `SEC-TKT-${sequentialNumber}-V1-${Math.random().toString(16).slice(2, 8)}`

      // Se for venda confirmada, emite ingresso real no núcleo ticketsAccessService
      if (params.mode === 'SELL') {
        const res = await ticketsAccessService.issueTicket({
          eventName: params.eventName,
          sector: seat.sectorName,
          seat: seatFormatted,
          modality: params.modality,
          priceCents: Math.round(params.unitPriceBRL * 100),
          holderName: params.holderName || 'Comprador Bilheteria SafeSaff',
          holderDocument: params.holderDocument || '049.281.938-12',
          holderEmail: params.holderEmail || 'cliente@safesaff.com.br',
          holderPhone: params.holderPhone || '(41) 99811-2200'
        })
        if (res.ticket) {
          ticketId = res.ticket.id
          sequentialNumber = res.ticket.sequentialNumber
          credentialCode = res.ticket.currentCredentialCode
        }
      }

      const binding: SeatTicketBinding = {
        seatId: seat.id,
        seatKey: `${seat.sectorName}::${seat.rowLabel}::${seat.label}`,
        eventCode: params.eventCode,
        eventName: params.eventName,
        sectorName: seat.sectorName,
        rowLabel: seat.rowLabel,
        seatLabel: seat.label,
        lotId: matchedLot.id,
        lotName: matchedLot.name,
        categoryId: params.categoryId,
        categoryName: params.categoryName,
        modality: params.modality,
        priceBRL: params.modality === 'CORTESIA' ? 0 : params.unitPriceBRL,
        orderId,
        ticketId,
        sequentialNumber,
        credentialCode,
        holderName: params.holderName || 'Comprador Bilheteria SafeSaff',
        holderDocument: params.holderDocument || '049.281.938-12',
        holderEmail: params.holderEmail || 'cliente@safesaff.com.br',
        holderPhone: params.holderPhone || '(41) 99811-2200',
        salesChannel: params.salesChannel,
        status: params.mode === 'SELL' ? 'SOLD_ACTIVE' : 'RESERVED_HOLD',
        holdExpiresAt,
        createdAt: nowIso,
        updatedAt: nowIso
      }

      bindings[seat.id] = binding
      issuedBindings.push(binding)

      // Atualiza contadores do Lote
      if (params.mode === 'SELL') {
        matchedLot.soldCount += 1
      } else {
        matchedLot.reservedCount += 1
      }
    }

    this.saveBindings(bindings)
    this.saveLots(lots)

    const nextStatus: SeatStatusType = params.mode === 'SELL' ? 'sold' : 'reserved'
    const updatedSeats = params.allSeats.map(s =>
      targetIds.has(s.id)
        ? {
            ...s,
            status: nextStatus,
            priceBRL: params.unitPriceBRL
          }
        : s
    )

    notifyRealtimeSubscribers({
      source: 'sellOrReserveSeats',
      orderId,
      count: issuedBindings.length
    })

    return { updatedSeats, issuedBindings, orderId }
  },

  // 4. Converter Reserva Hold em Venda Confirmada (Emite Ingresso Definitivo)
  async confirmReservedSeat(
    seat: SeatmapSeatPoint,
    allSeats: SeatmapSeatPoint[]
  ): Promise<{ updatedSeats: SeatmapSeatPoint[]; binding?: SeatTicketBinding }> {
    const bindings = this.loadBindings()
    const existing = bindings[seat.id]
    if (!existing) {
      const updatedSeats = allSeats.map(s =>
        s.id === seat.id ? { ...s, status: 'sold' as const } : s
      )
      return { updatedSeats }
    }

    const res = await ticketsAccessService.issueTicket({
      eventName: existing.eventName,
      sector: existing.sectorName,
      seat: `${existing.rowLabel} - ${existing.seatLabel}`,
      modality: existing.modality,
      priceCents: Math.round(existing.priceBRL * 100),
      holderName: existing.holderName,
      holderDocument: existing.holderDocument,
      holderEmail: existing.holderEmail,
      holderPhone: existing.holderPhone
    })

    const updatedBinding: SeatTicketBinding = {
      ...existing,
      status: 'SOLD_ACTIVE',
      ticketId: res.ticket?.id || existing.ticketId,
      sequentialNumber: res.ticket?.sequentialNumber || existing.sequentialNumber,
      credentialCode: res.ticket?.currentCredentialCode || existing.credentialCode,
      holdExpiresAt: undefined,
      updatedAt: new Date().toISOString()
    }

    bindings[seat.id] = updatedBinding
    this.saveBindings(bindings)

    const updatedSeats = allSeats.map(s =>
      s.id === seat.id ? { ...s, status: 'sold' as const } : s
    )
    return { updatedSeats, binding: updatedBinding }
  },

  // 5. Registrar Check-in de Controle de Acesso (Catraca / Validador Ótico) no Assento
  performSeatAccessCheckIn(
    seatId: string,
    gateName = 'Portão Principal A',
    deviceName = 'Catraca Ótica 01'
  ): SeatTicketBinding | null {
    const bindings = this.loadBindings()
    const existing = bindings[seatId]
    if (!existing) return null

    const nowIso = new Date().toISOString()
    const updated: SeatTicketBinding = {
      ...existing,
      status: 'CHECKED_IN',
      checkInAt: nowIso,
      checkInGate: gateName,
      checkInDevice: deviceName,
      updatedAt: nowIso
    }
    bindings[seatId] = updated
    this.saveBindings(bindings)

    // Atualiza também na lista local do ticketsAccessService se existir
    try {
      const rawTickets = localStorage.getItem('safesaff_tickets_fallback_v1')
      if (rawTickets) {
        const list = JSON.parse(rawTickets) as TicketRecord[]
        const idx = list.findIndex(
          t => t.id === existing.ticketId || t.sequentialNumber === existing.sequentialNumber
        )
        if (idx >= 0) {
          list[idx] = {
            ...list[idx],
            status: 'UTILIZADO',
            statusLabelPtBr: 'Check-in Realizado no Mapa',
            checkInAt: nowIso,
            checkInGate: gateName,
            checkInDevice: deviceName,
            updatedAt: nowIso
          }
          localStorage.setItem('safesaff_tickets_fallback_v1', JSON.stringify(list))
        }
      }
    } catch {
      // Fallback silencioso
    }

    notifyRealtimeSubscribers({ source: 'checkIn', seatId })
    return updated
  },

  // 6. Cancelar / Estornar Ingresso ou Reserva e Liberar Poltrona Imediatamente para 'free'
  releaseAndRefundSeat(
    seatId: string,
    allSeats: SeatmapSeatPoint[],
    reason = 'Cancelamento / Estorno Operacional com liberação imediata de assento'
  ): { updatedSeats: SeatmapSeatPoint[] } {
    const bindings = this.loadBindings()
    const existing = bindings[seatId]
    if (existing) {
      try {
        const rawTickets = localStorage.getItem('safesaff_tickets_fallback_v1')
        if (rawTickets) {
          const list = JSON.parse(rawTickets) as TicketRecord[]
          const idx = list.findIndex(
            t => t.id === existing.ticketId || t.sequentialNumber === existing.sequentialNumber
          )
          if (idx >= 0) {
            list[idx] = {
              ...list[idx],
              status: 'CANCELADO',
              statusLabelPtBr: 'Cancelado (Assento Liberado)',
              cancellationReason: reason,
              updatedAt: new Date().toISOString()
            }
            localStorage.setItem('safesaff_tickets_fallback_v1', JSON.stringify(list))
          }
        }
      } catch {
        // Ignore
      }
      delete bindings[seatId]
      this.saveBindings(bindings)
    }

    const updatedSeats = allSeats.map(s =>
      s.id === seatId ? { ...s, status: 'free' as const } : s
    )
    notifyRealtimeSubscribers({ source: 'releaseSeat', seatId })
    return { updatedSeats }
  },

  // 7. Assinar atualizações em tempo real sem recarregar a página
  subscribeRealtime(callback: () => void): () => void {
    if (typeof window === 'undefined') return () => {}
    const handler = () => callback()
    window.addEventListener(REALTIME_EVENT_NAME, handler)
    let bc: BroadcastChannel | null = null
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('safesaff_seatmap_channel')
        bc.onmessage = () => callback()
      }
    } catch {
      bc = null
    }
    return () => {
      window.removeEventListener(REALTIME_EVENT_NAME, handler)
      if (bc) bc.close()
    }
  }
}
