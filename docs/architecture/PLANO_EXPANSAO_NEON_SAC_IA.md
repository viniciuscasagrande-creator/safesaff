# Plano de Expansão de Infraestrutura — SafeSaff ERP (Neon PostgreSQL + Chat SAC + IA + Multicanal)

## 1. Visão Geral e Premissa Principal

O banco **PostgreSQL hospedado no Neon** permanece como o banco de dados principal e oficial do **SafeSaff ERP**, atendendo tanto os módulos críticos de ingressos, lotes, mapas de assentos e financeiro quanto a **Central SAC — Chat**, a **IA de Atendimento ao Cliente (N1)**, o **Copiloto IA dos Atendentes**, a **Base de Conhecimento aprovada pelo Supervisor** e o **Dashboard SAC (SLA & ITIL)**.

O objetivo desta arquitetura de expansão é **isolar o tráfego de alta frequência** (mensagens instantâneas, presença de atendentes, webhooks de WhatsApp/e-mail, chamadas a provedores de IA e alertas sonoros de fila) das **transações críticas de venda de ingressos e controle de acesso**.

---

## 2. Componentes da Arquitetura Recomendada

| Componente | Configuração Proposta | Prioridade | Função no Ecossistema SafeSaff |
| :--- | :--- | :--- | :--- |
| **Neon PostgreSQL** | Instância principal com índices dedicados SAC + IA | **Essencial** | Persistência oficial de chamados (`ServiceTicket`), conversas (`SacConversation`), mensagens (`TicketMessage`), skills, SLA (`SlaPolicy`), sugestões (`SacAiSuggestion`) e artigos (`SacKnowledgeArticle`). |
| **Endpoint Pooled Neon (`-pooler`)** | PgBouncer nativo do Neon na `DATABASE_URL` da API | **Essencial** | Evita exaustão de conexões durante picos de acesso (ex.: abertura de vendas ou cancelamento de show). |
| **Endpoint Direct Neon** | `DIRECT_URL` exclusiva para `prisma migrate` | **Essencial** | Execução segura de migrações de schema sem interferir no pool transacional. |
| **Branching do Neon (Homologação)** | Branch isolada com anonimização/mascaramento de PII | **Essencial** | Validação de migrações (`20261116_sac_chat_core`, `20261116_sac_ai_copilot`) e testes de carga antes da produção. |
| **Redis Gerenciado** | Cache de presença, fila ativa, rate-limit e pub/sub | **Alta** | Controle de heartbeat dos atendentes SAC, distribuição rápida com trava transacional no PostgreSQL e disparo de eventos de alerta sonoro. |
| **Workers Assíncronos** | Filas dedicadas para IA, WhatsApp, E-mail e SLA | **Alta** | Desacopla chamadas externas de LLMs e webhooks da thread principal da API do ERP. |
| **Armazenamento S3** | Bucket privado com URLs pré-assinadas | **Alta** | Armazenamento de anexos, comprovantes PIX e prints enviados no SAC sem sobrecarregar o banco. |
| **Réplica de Leitura Neon** | Read Replica sob demanda | **Expansão futura** | Isolamento de relatórios analíticos pesados e exportações históricas de auditoria ITIL. |

---

## 3. Fluxo das Duas Camadas de Inteligência Artificial no SAC

1. **IA para o Cliente (Assistente Virtual SafeSaff — N1):**
   - Apresenta os temas autorizados pelo supervisor (`Cancelamento de show`, `Solicitar reembolso`, `Ingressos e acesso`, `Alteração de evento`, `Problemas de pagamento`, `Falar com o SAC`).
   - Responde apenas com base nos artigos com `status = 'approved'` na tabela `SacKnowledgeArticle`.
   - Não inventa políticas financeiras nem executa estornos sem validação.
   - Transfere para a fila humana preservando o mesmo protocolo (`ServiceTicket`), todo o histórico de mensagens, o resumo da triagem e a *skill* recomendada, respeitando o limite de **3 conversas simultâneas por atendente**.

2. **IA para o Atendente (Copiloto SAC):**
   - Acionada sob demanda pelo botão `"Sugerir resposta com IA"` apenas pelo atendente responsável ou supervisor.
   - Mascara dados sensíveis (CPF, e-mail, cartões, tokens) antes de consultar o provedor externo via HTTPS.
   - Gera sugestão privada (`SacAiSuggestion`) com fontes citadas e exige revisão humana (`Copiar para editor` ou `Descartar`).

---

## 4. Metas de Homologação e Testes de Carga Progressivos

- **Cenários de teste de carga:** `50` → `200` → `500` → `1.000` sessões simultâneas.
- **SLOs de aprovação:**
  - Taxa de erro nas APIs SAC: `< 0,5%`
  - Latência de consultas comuns do chat (`p95`): `< 500 ms`
  - Atribuição automática respeitando limite de 3 chats + skills (`p95`): `< 2 s`
  - Mensagens em tempo real (`p95`): `< 2 s`
  - Perda de mensagens confirmadas: `0`
  - Isolamento multi-tenant (`producerId`): `0` acessos cruzados indevidos
