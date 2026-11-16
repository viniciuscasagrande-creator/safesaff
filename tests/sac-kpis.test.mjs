import test from 'node:test'
import assert from 'node:assert/strict'
import { percent, efficiency, slaRate, countUniqueByChannel, queueAlert, eligibleAgent } from '../reference/sac-kpis.mjs'
test('sem amostra percentual não inventa 100%', () => assert.equal(percent(0, 0), null))
test('eficiência usa resolvidos e pendentes vencidos', () => assert.equal(efficiency({resolved:21, overduePending:3}), 87.5))
test('SLA rejeita numerador maior que denominador', () => assert.throws(() => slaRate({inTime:11,eligible:10})))
test('contagem por canal deduplica tickets', () => assert.deepEqual(countUniqueByChannel([{id:1,channel:'chat'},{id:1,channel:'chat'},{id:2,channel:'email'},{id:3,channel:'whatsapp'}]),{chat:1,email:1,whatsapp:1}))
test('fila crescente aciona warning', () => assert.equal(queueAlert({now:7, previous:4, oldestWaitSeconds:0, p1AtRisk:false}).level,'warning'))
test('fila crítica aciona critical', () => assert.equal(queueAlert({now:12,previous:6,oldestWaitSeconds:0,p1AtRisk:false}).level,'critical'))
test('agente com três conversas não é elegível', () => assert.equal(eligibleAgent({status:'available',heartbeatAgeMs:1000,activeCount:3,skills:['ERP']},['ERP']),false))
test('skill obrigatória exclui agente sem competência', () => assert.equal(eligibleAgent({status:'available',heartbeatAgeMs:1000,activeCount:1,skills:['ERP']},['Financeiro']),false))
test('agente disponível com skill, heartbeat e capacidade é elegível', () => assert.equal(eligibleAgent({status:'available',heartbeatAgeMs:1000,activeCount:2,skills:['ERP','Financeiro']},['ERP']),true))
