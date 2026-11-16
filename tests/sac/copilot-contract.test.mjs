import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const route = read('server/src/routes/sacAi.ts')
const core = read('server/src/services/sacAiCopilot.ts')
const ui = read('src/components/sac/SacChatPage.tsx')
const schema = read('prisma/schema.postgresql.prisma')
const app = read('server/src/app.ts')
test('isolamento por produtora e verificação de atendente responsável', () => {
  assert.match(route, /canWork\(req, conversation\.producerId\)/)
  assert.match(route, /conversation\.assignedAgentId !== req\.auth!\.id/)
  assert.match(route, /status: 'approved'/)
})
test('somente supervisão gerencia e aprova artigos', () => {
  assert.match(route, /canManage\(req, tenant\)/)
  assert.match(route, /status: 'draft'/)
  assert.match(ui, /Aprovar/)
})
test('IA não envia mensagens automaticamente', () => {
  assert.doesNotMatch(route, /ticketMessage\.create|sacChatRouter|send_message/)
  assert.match(ui, /Copiar para editor/)
  assert.match(ui, /Copiloto: não envia mensagens automaticamente/)
})
test('serviço protege credenciais e evita respostas não fundamentadas', () => {
  assert.match(core, /SAC_AI_API_KEY/)
  assert.match(core, /url\.protocol !== 'https:'/)
  assert.match(core, /!input\.references\.length/)
  assert.match(core, /maskSensitive/)
})
test('migração e roteador integrados', () => {
  assert.match(schema, /model SacKnowledgeArticle/)
  assert.match(schema, /model SacAiSuggestion/)
  assert.match(app, /app\.use\('\/api\/sac\/ai', sacAiRouter\)/)
})
