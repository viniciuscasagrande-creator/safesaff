# Arquitetura técnica — Dashboard de Supervisão SAC + IA (SafeSaff)

**Versão:** 1.0 · **Data:** 16/11/2026 · **Status:** proposta de arquitetura, não implantada.

## 1. Objetivo e restrições

Implementar o layout do Dashboard SAC já aprovado, preservando os chamados e o Chat SAC existentes. Unificar **chat, e-mail e WhatsApp** por canal de origem; permitir monitoramento em tempo quase real, alarmes sonoros configuráveis, governança de skills, metas de SLA e automação com IA assistida.

Regras herdadas do patch: **distribuição automática habilitada**, **assumir manualmente habilitado**, **até 3 conversas ativas por atendente humano**, **fila preservada quando não há atendente disponível**, **supervisão habilitada**. O canal precisa distinguir tickets criados manualmente de interações vindas de conectores reais.

## 2. Integração no ERP existente (confirmado nos arquivos)

- Frontend: React/TypeScript; `src/pages/support/SupportPage.tsx` e página `sac-dashboard` na navegação. Criar `src/components/sac/dashboard/SacDashboardPage.tsx` e substituir somente o render da opção `sac-dashboard`, mantendo páginas legadas intactas.
- Backend: Node/Express em `server/src`, com a rota do patch `server/src/routes/sacChat.ts`. Criar `server/src/routes/sacDashboard.ts`, `sacSkills.ts`, `sacAlerts.ts` e `sacAi.ts`, adicionadas em `server/src/app.ts` com `requireAuth` e checagem rigorosa de papéis/tenant.
- Persistência: PostgreSQL + Prisma `prisma/schema.postgresql.prisma`; reutilizar `ServiceTicket`, `TicketMessage`, `SlaPolicy`, `SacChatConversation`, `SacAgentState`, `SacAssignmentEvent` do patch. Não duplicar tickets do chat.
- A tela de chat do patch usa **polling (2,5–3 s)**, não WebSocket. Para o dashboard v1, polling de 10–15 s para KPIs e 5 s para fila; SSE/WebSocket posteriormente, quando houver servidor persistente e eventos de publicação confiáveis. Informar latência no painel.
- A geração de SLA para chat no patch está inicialmente fixa em `P3`/prazos definidos na rota: migrar para resolução centralizada da `SlaPolicy` por tenant/prioridade/horário. Não reescrever prazos anteriores sem auditoria.

## 3. Desenho lógico

```
Portal Chat ---\
E-mail -------+--> Adaptadores de canal --> Normalização e deduplicação --> ServiceTicket/TicketMessage
WhatsApp -----/                                      |
                                                    +--> Evento de fila / atribuição --> Dispatcher com Skills
                                                    +--> Serviço de métricas/alertas --> Dashboard SAC
                                                    +--> Orquestrador de IA <--> Base de conhecimento validada
                                                                                |
                                                                     humano / escalonamento
```

E-mail e WhatsApp **ainda são fontes propostas**; o backup possui recursos de integrações/registro de canal, mas isso não comprova conectores funcionais, recebendo webhooks em produção. Cada conector deve suportar verificação de assinatura, deduplicação/idempotência, mapeamento de identidade e auditoria.

## 4. Dashboard: componentes e contratos de métricas

Filtros: dia (padrão hoje no fuso `America/Sao_Paulo`), período, canal, prioridade, skill, produtor/tenant autorizado, colaborador e status. Mostrar **instante da última atualização**. Nunca somar eventos de mensagem como se fossem atendimentos distintos.

| Card/painel | Definição operacional v1 | Denominador / observação |
|---|---|---|
| Atendimentos do dia | Tickets únicos `ServiceTicket` abertos no intervalo | Segmentados por `channel` canônico; excluir duplicações de webhook |
| Fila atual | Conversas/chamados aguardando operador, ainda não assumidos | Uma conversa = 1 item; fila de outros canais exige estados normalizados |
| Eficiência | `resolvidos_no_periodo / (resolvidos_no_periodo + pendentes_vencidos_no_periodo) × 100` | **Proposta**, a aprovar como KPI interno; não chamar de indicador ITIL normativo |
| SLA 1ª resposta | Casos com primeira resposta dentro do prazo / casos cujo prazo de 1ª resposta venceu no intervalo | Expor amostra e casos ainda dentro do prazo separados; horários úteis conforme política |
| SLA resolução | Casos resolvidos no prazo / casos resolvidos ou vencidos no intervalo | Definição de coorte fixa; evitar ocultar violação de tickets abertos |
| SLA no prazo | Casos não violados entre casos com prazo já aferível, conforme política | Não usar porcentagem 100% em dia sem amostra: exibir “Sem dados” |
| TMA | Tempo médio **ativo de atendimento humano** das conversas encerradas | Necessita registrar sessões/pausas; se indisponível exibir “Não calculado”, não usar duração bruta de ticket |
| Demanda por canal | Tickets distintos criados no período por chat / e-mail / WhatsApp | Só dados integrados e com fonte rastreável |
| Crescimento da fila | `fila_agora - fila_30_min_atrás` e taxa por janela | snapshots persistidos a cada minuto, comparação com mesma população |
| Agentes disponíveis | `SacAgentState.status=available` e heartbeat recente | Pode ter 1–3 chats ativos; não confundir com ocioso |
| Prioridades / aging | P1–P4 e tempo esperando/ultrapassagem de prazo | Política de impacto/urgência e SLA por tenant |
| IA: taxa de transferência | Conversas encaminhadas da IA ao humano / conversas atendidas pela IA | Não confundir com eficiência da equipe |
| IA: resolução validada | Encerramentos após confirmação do usuário ou critério auditável / conversas tratadas pela IA | Não atribuir sucesso só porque a IA respondeu |

Preferir indicadores separados para **eficiência operacional**, **SLA de resposta**, **SLA de resolução** e **qualidade (CSAT)**. A “eficiência” do mockup é apenas a apresentação; a fórmula será configurável, auditável e documentada.

## 5. SLA e práticas ITIL

- `SlaPolicy` já contém `priority`, `responseMinutes`, `resolutionMinutes`, `businessHours`, `producerId`. Criar serviço central de calendário para fusos, feriados e horários úteis; política versionada e aplicada na abertura do ticket.
- `firstResponseAt` é preenchido apenas por primeira resposta útil/permitida pela política (definir se IA conta: sugestão **não contar IA para SLA humano**, e apresentar indicador de resposta automatizada separado).
- Registrar `resolvedAt`, pausas válidas, reaberturas, escalonamento e ações. P1/P2/P3/P4 derivadas de impacto x urgência e revisáveis com trilha de auditoria.
- Os processos seguem práticas ITIL de gerenciamento de incidentes, requisições de serviço, nível de serviço, conhecimento e melhoria contínua; não afirmar “certificação ITIL” do software.
- Dashboard de risco proativo: próximo do vencimento, vencido, fila crescendo e concentração por skill. Permitir drill-down a protocolo, histórico e política efetiva.

## 6. Alertas sonoros inteligentes (supervisor)

**Motor de regras server-side**, com execução por tenant e cooldown; som reproduzido **somente no navegador do supervisor que habilitou notificações e ativou áudio por interação** (restrições dos navegadores). Não enviar áudio para clientes.

Configuração inicial proposta: alerta **amarelo** quando a fila cresce `>= 3` em 10 minutos ou a maior espera supera 5 min; **vermelho** quando cresce `>= 5` em 10 minutos, fila > 10, ou existe P1 com risco iminente. Limites são **ajustáveis**, não fatos atuais da operação. Só tocar se novo estado de alerta ou escalonamento, com cooldown padrão de 5 min; permitir silenciar por 15/30/60 min. Exibir cor, texto, causa, horário e confirmação visual, inclusive com áudio desligado.

Persistir `SacQueueSnapshot` e `SacAlertEvent`; usar índice único de disparo (`tenant + regra + janela + severidade`), registrar quem reconheceu e quando. Não usar polling local isolado para decidir alertas pois os supervisores receberiam estados divergentes.

## 7. Skills e distribuição

Cadastro supervisor: catálogo `SacSkill` (nome, categoria, ativo, tenant), vínculo `SacAgentSkill` (nível N1/N2/N3 ou escala 1–5, habilitado, validadoPor, validade) e histórico de mudanças. O supervisor cria/edita e habilita skills apenas para colaboradores SAC autorizados de seu tenant.

**Algoritmo v1:** identificar habilidades necessárias por assunto/categoria ou triagem da IA; escolher **disponíveis com heartbeat recente e carga < 3** que atendam às skills obrigatórias. Ordenar por menor carga; desempatar por menor tempo desde última atribuição. A operação deve permanecer transacional sob o mesmo lock de `sacDispatcher.ts` do patch para preservar capacidade. Caso ninguém corresponda, manter fila; supervisor pode ampliar critérios ou reatribuir por exceção auditada. Ações manuais passam pelas mesmas validações de permissão e teto. Habilidades não mudam papéis nem permissões de acesso.

Não usar LLM para decidir autorização ou executar atribuição diretamente: ele pode **sugerir skills**, mas o servidor valida contra catálogo permitido e aplica as regras determinísticas.

## 8. IA no chat: modos e guardrails

**Modos configuráveis por tenant**:
1. **Copiloto (padrão inicial):** IA sugere respostas privadas para aprovação do atendente; não envia automaticamente.
2. **Triagem automática:** IA propõe intenção, resumo e skills; roteamento/atribuição via backend, auditável.
3. **Autonomia restrita para FAQ:** apenas tópicos autorizados em base validada, com limite de tentativas e opção clara “Falar com atendente”.

Componentes: `SacAiSession` (modo, estado e versão de política), `SacAiInteraction` (prompt/template/versionamento, fontes, custo/tokens, decisão, feedback), `SacKnowledgeArticle` (artigos aprovados com tenant e versão), `SacAiHandoff` (motivo, resumo, agente e timestamps). Definir adaptação para fornecedor por interface (`AiProvider`) sem fixar fornecedor nem expor chaves no frontend.

Fluxo: entrada do cliente -> filtro de dados sensíveis e política -> busca de conhecimento autorizada por tenant -> resposta candidata com referências -> decisão de responder/sugerir/encaminhar -> log de auditoria sem armazenar segredos. Transferir a humano em caso de solicitação explícita, baixa confiança, falha de ferramenta, risco sensível, SLA crítico ou repetição sem resolução. Em handoff, preservar histórico e dar contexto ao humano.

Segurança: mascaramento de dados sensíveis, retenção configurável, consentimento/transparência de automação, defesa contra prompt injection em documentos e mensagens, limitação de taxa/custo, proibição de ações de alto impacto sem fluxo determinístico autorizado, isolamento por `producerId`, acesso de operador restrito e revisão jurídica de LGPD e contratos com provedores.

## 9. Interfaces e navegação

Reusar estilo da imagem aprovada (cinco grandes KPIs, painéis por canal, alerta de fila, gráfico de dia, SLA/ITIL, supervisão e skills). Menu SAC sugerido: `Dashboard SAC`, `Atendimentos`, `Fila`, `SLA & ITIL`, `Skills da Equipe`, `IA do SAC`, `Relatórios`, `Configurações`. Não modificar navegação fora de SAC.

Componentes sugeridos:
`SacKpiCards`, `SacChannelMetrics`, `SacQueueAlert`, `SacQueueTrendChart`, `SacSlaPanel`, `SacTeamPresence`, `SacSkillsManager`, `SacAiHealth`, `SacDashboardFilters`. O painel de IA mostra automações, handoffs, taxa de aceitação de sugestões, escalonamentos e custo por conversa.

## 10. API proposta (autenticada)

| Método | Endpoint | Acesso |
|---|---|---|
| GET | `/api/sac/dashboard/summary?date=YYYY-MM-DD&producerId=...` | supervisor SAC/admin do tenant |
| GET | `/api/sac/dashboard/timeline?date=...` | supervisor SAC/admin |
| GET | `/api/sac/dashboard/channels?date=...` | supervisor SAC/admin |
| GET | `/api/sac/dashboard/queue` | agente SAC limitado / supervisor completo |
| GET | `/api/sac/dashboard/agents` | supervisor SAC/admin |
| GET,POST,PATCH | `/api/sac/skills` | supervisor SAC/admin |
| PUT,DELETE | `/api/sac/agents/:id/skills/:skillId` | supervisor SAC/admin |
| GET,PUT | `/api/sac/alerts/settings` | supervisor SAC/admin |
| GET,POST | `/api/sac/alerts/events/:id/ack` | supervisor SAC/admin |
| GET,PUT | `/api/sac/ai/settings` | supervisor SAC/admin |
| POST | `/api/sac/ai/suggestions` | atendente SAC responsável |
| POST | `/api/sac/ai/handoff` | serviço de IA / backend autorizado |
| GET | `/api/sac/ai/metrics` | supervisor SAC/admin |

Todas as respostas carregam `generatedAt`, `timeZone`, `producerId` e metadados de cobertura dos canais. `producerId` fornecido pelo cliente não substitui isolamento com token; administração global precisa de escopo explícito. Permissões obrigatórias no servidor.

## 11. Observabilidade, testes e implantação

Métricas: tempo de resposta da API, idade dos snapshots, lag de conectores, falhas de webhook, filas sem atendente, violações de SLA, eventos de áudio reconhecidos, custo/falha de IA, handoffs e erros de autorização. Não logar texto integral de conversas em logs de aplicação.

Testes mínimos: tenant A não enxerga B; clientes não veem dados de operadores; deduplicação por ID externo; 3 chats/operador sob concorrência; prioridade/skill; mudança de status no meio da distribuição; SLA no expediente/feriado; cenários sem amostra; tempo das consultas; alerta com cooldown/silenciar; autorização de som; prompt injection e handoff humano. Testes reais com PostgreSQL e sandbox de conectores são necessários antes de produção.

Fases: **(1)** dados, regras KPI, endpoint de leitura e dashboard com dados reais do chat; **(2)** skills, fila e alertas sonoros; **(3)** conectores e-mail/WhatsApp e métricas multicanal; **(4)** IA copiloto e base de conhecimento; **(5)** triagem IA e respostas automáticas autorizadas; **(6)** carga, segurança, homologação e rollout por tenant. Evitar lançar cartões de e-mail/WhatsApp com números fictícios: exibir “Não integrado” até ativação.

## 12. Decisões pendentes antes do código de produção

1. Quais provedores de **e-mail**, **WhatsApp Business/API** e **IA** serão usados e quem gerencia credenciais?
2. Definição operacional de “eficiência” (a fórmula deste documento é proposta) e de horários úteis/feriados do SLA.
3. Quais skills iniciais, níveis e regras de correspondência estrita/relaxada?
4. IA pode enviar FAQ autonomamente desde a primeira versão ou apenas sugerir? Recomendado começar com copiloto.
5. Política de retenção, consentimento, horário de atendimento e aceite de alertas sonoros.
