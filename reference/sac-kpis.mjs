/** Regras puras para métricas de referência. Integração com Prisma ainda não realizada. */
export const percent = (num, den) => den > 0 ? Math.round((num / den) * 1000) / 10 : null
export function efficiency({resolved, overduePending}) {
  if (![resolved, overduePending].every(x => Number.isInteger(x) && x >= 0)) throw new Error('Contagem inválida')
  return percent(resolved, resolved + overduePending)
}
export function slaRate({inTime, eligible}) {
  if (![inTime, eligible].every(x => Number.isInteger(x) && x >= 0) || inTime > eligible) throw new Error('Coorte SLA inválida')
  return percent(inTime, eligible)
}
export function countUniqueByChannel(tickets) {
  const seen = new Set(), result = { chat: 0, email: 0, whatsapp: 0 }
  for (const t of tickets) {
    if (t && ['chat', 'email', 'whatsapp'].includes(t.channel) && Number.isSafeInteger(t.id) && !seen.has(t.id)) {
      seen.add(t.id); result[t.channel]++
    }
  }
  return result
}
export function queueAlert({now, previous, oldestWaitSeconds, p1AtRisk, thresholds = {warningGrowth:3, criticalGrowth:5, criticalTotal:10, warningWait:300}}) {
  if (![now,previous,oldestWaitSeconds].every(x => Number.isFinite(x) && x >= 0)) throw new Error('Fila inválida')
  const delta = now - previous
  const level = p1AtRisk || delta >= thresholds.criticalGrowth || now > thresholds.criticalTotal ? 'critical'
    : delta >= thresholds.warningGrowth || oldestWaitSeconds > thresholds.warningWait ? 'warning' : 'normal'
  return {level, delta, shouldNotify: level !== 'normal'}
}
export function eligibleAgent({status, heartbeatAgeMs, activeCount, skills = []}, requiredSkills = [], maxActive = 3) {
  return status === 'available' && heartbeatAgeMs >= 0 && heartbeatAgeMs <= 60000 && activeCount < maxActive && requiredSkills.every(s => skills.includes(s))
}
