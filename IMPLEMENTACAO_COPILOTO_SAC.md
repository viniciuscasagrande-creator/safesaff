# SafeSaff — Chat SAC com IA copiloto (fase inicial)

## Escopo do patch
Este ZIP é **incremental ao patch `SafeSaff_Chat_SAC_Patch_20261116.zip`**. Sobrepor somente seus caminhos relativos à mesma versão do projeto em homologação. Integra `sacAiRouter` em `server/src/app.ts` e o copiloto na `SacChatPage` existente. Não altera a lógica de distribuição automática (3 conversas), nem o SLA/ITIL já existente.

## Entregue
- CRUD mínimo de artigos: supervisor SAC cria rascunhos, aprova, arquiva ou atualiza por API; listagem restrita por produtora.
- Base de conhecimento **somente com artigos aprovados**; busca lexical limitada; se não houver referência relevante a IA não produz sugestão.
- Sugestão privada a partir das últimas mensagens do ticket; fontes exibidas ao atendente; aprovação/descartar auditada.
- Sugestão aceita **apenas preenche o editor**; o atendente pode editar e deve clicar em **Enviar** na rota normal do chat. IA nunca cria mensagem de cliente ou TicketMessage.
- Segredos ficam no backend; conexão HTTPS com endpoint do tipo Chat Completions compatível.

## Configuração de homologação
1. Aplicar **primeiro** o patch do Chat SAC e a migração `20261116_sac_chat`.
2. Aplicar este patch e a migração PostgreSQL `20261116_sac_ai_copilot`, utilizando processo Prisma do projeto. Backup e homologação obrigatórios.
3. Configurar variáveis **somente no backend**:
   - `SAC_AI_ENDPOINT=https://SEU-PROVEDOR/.../chat/completions`
   - `SAC_AI_MODEL=nome-do-modelo`
   - `SAC_AI_API_KEY=chave-secreta`
4. Iniciar servidor, autenticar como supervisor SAC e criar/aprovar um artigo na seção Base de conhecimento IA.
5. Assumir um chat como SAC, usar **Sugerir resposta com IA**, revisar a sugestão, **Copiar para editor** e depois clicar em Enviar.
6. Sem credenciais, o recurso retorna erro explícito. Não existe IA simulada/falsa no cliente.

## APIs
- `GET /api/sac/ai/knowledge` — SAC, somente aprovados para atendente; todos para supervisor.
- `POST /api/sac/ai/knowledge` — supervisor cria rascunho.
- `PATCH /api/sac/ai/knowledge/:id` — supervisor atualiza/aprova/arquiva.
- `POST /api/sac/ai/conversations/:id/suggest` — responsável ou supervisor solicita sugestão.
- `POST /api/sac/ai/suggestions/:id/review` — marca como accepted ou discarded, sem enviar ao cliente.

## Limitações conhecidas antes de produção
- **Sem integração ativa com provedor de IA** enquanto não houver URL, modelo e credenciais válidas.
- Máscara por expressões regulares é **proteção parcial**, não substitui DLP, revisão LGPD, consentimento, contratos de tratamento e políticas de retenção.
- Busca por termos simples, não é RAG semântico: deve ser aprimorada e testada com exemplos reais e casos de ausência de fonte.
- O conteúdo dos artigos e mensagens pode conter instruções maliciosas: o prompt trata ambos como dados não confiáveis, mas isso não elimina todo o risco de prompt injection.
- `accepted` indica que o texto foi colocado no editor, **não** significa que a mensagem foi enviada nem que o cliente foi atendido/resolvido.
- O recurso está no **Chat SAC**; não adiciona ainda os cards do dashboard aprovado, skills do colaborador nem os conectores reais de e-mail e WhatsApp.
- Build completo, compilação Prisma e testes integrados com PostgreSQL e provedor de IA ainda necessários em ambiente com dependências.

## Testes locais de contrato
`node --test tests/sac/copilot-contract.test.mjs`

**Não disponibilizar em produção sem validar controle de acesso, latência, custos, tratamento de dados e critérios de aceite.**
