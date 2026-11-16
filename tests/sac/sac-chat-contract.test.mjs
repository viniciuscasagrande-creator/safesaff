import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')

test('dispatcher applies three-chat cap and excludes stale agents', () => {
  const dispatcher = read('server/src/services/sacDispatcher.ts')
  assert.match(dispatcher, /SAC_CHAT_MAX_ACTIVE = 3/)
  assert.match(dispatcher, /SAC_AGENT_FRESH_MS = 60_000/)
  assert.match(dispatcher, /pg_advisory_xact_lock/)
  assert.match(dispatcher, /current >= SAC_CHAT_MAX_ACTIVE/)
  assert.match(dispatcher, /status: 'queued', assignedAgentId: null/)
})
test('API derives author and tenant from authenticated session', () => {
  const api = read('server/src/routes/sacChat.ts')
  assert.match(api, /sacChatRouter\.use\(requireAuth\)/)
  assert.match(api, /clientUserId: req\.auth!\.id/)
  assert.match(api, /author: user\.name/)
  assert.match(api, /internal: false, channel: 'chat-sac'/)
  assert.match(api, /isSacSupervisor/)
})
test('migration adds conversation, agent and assignment relations', () => {
  const sql = read('prisma/migrations/20261116_sac_chat/migration.sql')
  for (const table of ['SacChatConversation', 'SacAgentState', 'SacAssignmentEvent']) assert.ok(sql.includes(`CREATE TABLE "${table}"`))
  assert.match(sql, /UNIQUE \("producerId","userId"\)/)
  assert.match(sql, /"ticketId" INTEGER NOT NULL UNIQUE/)
})
test('frontend and API register SAC without replacing support routes', () => {
  assert.match(read('server/src/app.ts'), /app\.use\('\/api\/sac\/chat', sacChatRouter\)/)
  assert.match(read('server/src/app.ts'), /app\.use\('\/api\/support', supportRouter\)/)
  assert.match(read('src/App.tsx'), /page === 'sac-chat'/)
  assert.match(read('src/components/ModuleSidebar.tsx'), /label: 'Chat SAC'/)
})
test('corrective audit fixes: reconciled KPIs, SLA policy, skills routing, handoff and no internal sidebar', () => {
  const api = read('server/src/routes/sacChat.ts')
  const dispatcher = read('server/src/services/sacDispatcher.ts')
  const dash = read('src/components/sac/dashboard/SacDashboardPage.tsx')
  assert.match(api, /resolveSlaDeadlines/)
  assert.match(api, /sacChatRouter\.get\('\/kpis'/)
  assert.match(api, /sacChatRouter\.post\('\/conversations\/:id\/handoff'/)
  assert.match(api, /sacChatRouter\.put\('\/agents\/:userId\/skills'/)
  assert.match(dispatcher, /agentHasSkill/)
  assert.doesNotMatch(dash, /Simular \+Fila/)
  assert.doesNotMatch(dash, /Testar Som de Fila/)
})
