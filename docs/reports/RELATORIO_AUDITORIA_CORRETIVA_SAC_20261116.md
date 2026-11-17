# SafeSaff — Auditoria corretiva do Dashboard SAC
**Data:** 16/11/2026  
**Escopo:** vídeo da implantação `20261116-1820-50.5639952.mp4`; backup `SafeSaff_BACKUP_GERAL_OFICIAL_20261116.zip`; patches `SafeSaff_Chat_SAC_Patch_20261116.zip` e `SafeSaff_IA_Copiloto_SAC_Patch_20261116.zip`.  
**Natureza:** auditoria estática e visual; **não** inclui acesso ao código atualmente implantado, banco Neon, tráfego HTTP, logs de produção ou teste E2E autenticado.  
**Atenção:** o vídeo mostra implantação posterior aos pacotes examinados; não se pode afirmar que todos os defeitos de patch persistam na versão publicada.

## Resumo executivo
**Parecer: implantação não homologada.** A tela apresenta navegação duplicada e dados de demonstração na operação. O código disponível revela lacunas importantes de presença, SLA, skills, IA cliente e cobertura de testes. Recomenda-se interromper novas funcionalidades até a correção e validação com dados reais.

## Evidências visuais (confirmadas na gravação)
| ID | Severidade | Evidência | Correção exigida |
|---|---|---|---|
| VIS-01 | P0 | Dashboard SAC incorpora segunda navegação própria, além do menu global do ERP (captura ~41 s) | Remover shell/sidebar interna do SAC; usar apenas layout global SafeSaff |
| VIS-02 | P0 | Dashboard exibe 187 atendimentos e fila de 14–16; Chat SAC é mostrado com 0 conversas. Não há conciliação visível entre métricas | Substituir dados de exemplo por API com escopo, origem, janela temporal e status de atualização; apresentar `Sem dados` quando não houver resultados |
| VIS-03 | P1 | Botões `Testar Som de Fila` e `Simular +Fila` visíveis no painel operacional (captura ~41 s) | Retirar da produção ou isolar em modo de homologação restrito |
| VIS-04 | P1 | Gestão de skills abre janela, mas o vídeo não comprova persistência nem uso no roteamento | Validar POST/PUT, leitura após recarregar, isolamento de produtora e distribuição por skills |
| VIS-05 | P1 | Navegação entre Dashboard SAC, Central SAC e Chat SAC com experiências visuais distintas | Padronizar shell e tokens globais; validar tema claro/escuro em todos os estados |

## Análise de código dos pacotes disponíveis
| ID | Severidade | Evidência de código | Impacto / correção |
|---|---|---|---|
| COD-01 | P1 | `chat_patch/src/components/sac/SacChatPage.tsx`: heartbeat por `setInterval` de 20 s apenas enquanto a página está montada e `availability !== 'offline'`; `server/src/services/sacDispatcher.ts`: expiração da presença aos 60 s | Atendente pode ficar inelegível ao navegar pelo ERP. Criar serviço de presença no layout autenticado ou conexão global, limpeza de estado, reconciliação ao reconectar |
| COD-02 | P1 | `chat_patch/src/components/sac/SacChatPage.tsx`: estado inicial de disponibilidade `offline` e ausência de carregamento inicial de `SacAgentState` | Status salvo no backend pode divergir do status exibido após recarregar. Consultar estado real ao iniciar |
| COD-03 | P0 | `chat_patch/server/src/routes/sacChat.ts`: novos tickets criados com prioridade `P3`, SLA de resposta `120 min` e resolução `1440 min` fixos | SLA não acompanha calendário, prioridade, políticas por categoria/produtora. Resolver `SlaPolicy` efetiva, calendário e motivo de pausa com rastreabilidade |
| COD-04 | P1 | `chat_patch/server/src/routes/sacChat.ts`: `/agents` só consulta estados; não existem endpoints de cadastro de skills nem skills no dispatcher | Gestão de skills exibida na implantação não está demonstrada como backend real pelos patches. Criar tabelas/CRUD com auditoria e roteamento por competência |
| COD-05 | P0 | `ai_patch/server/src/routes/sacAi.ts`: `suggest` só admite conversa ativa e operadores SAC; `server/src/services/sacAiCopilot.ts` manda IA não enviar ao cliente | A IA cliente de N1 acordada não está implementada neste patch. Criar fluxo cliente autenticado, assuntos autorizados, transferências e registro de histórico/protocolo |
| COD-06 | P1 | `chat_patch/src/components/sac/SacChatPage.tsx`: lista consultada a cada 3 s e mensagens a cada 2,5 s | Sem push real; múltiplos navegadores podem gerar consultas desnecessárias e atraso. Implementar eventos e paginação/atualização incremental |
| COD-07 | P1 | `chat_patch/server/src/routes/sacChat.ts`: listagem de até 150 conversas; mensagens de até 500, sem paginação/cursor | Histórico pode ser truncado e relatórios deixar de cobrir o universo de dados. Paginar e documentar escopo |
| COD-08 | P1 | `chat_patch/server/src/routes/sacChat.ts`: fechamento faz `findUnique` antes da transação; retorna `{ok:true}` mesmo se `updateMany` não alterar linha | Respostas podem reportar êxito em condições concorrentes. Retornar conflito se atualização não executar; obter estado relevante dentro da transação |
| COD-09 | P1 | `chat_patch/server/src/routes/sacChat.ts`: consulta `visible()` permite qualquer usuário SAC da produtora ver conversa; ações exigem responsável/supervisor em parte dos endpoints | Confirmar matriz RBAC/ABAC por cargo, assignedAgent, privacidade e necessidade de acesso. Testar perfis e produtora cruzada |
| COD-10 | P1 | Ausência de rota de KPIs SAC multicanal, alerta e agregação nos patches; pacote de dashboard anterior contém contratos e documentação, não implantação de backend | Criar API real de métricas por canal, estados e prazos; reconciliar com banco. Não inferir dados de capturas |
| COD-11 | P2 | `base/src/pages/support/SupportPage.tsx`: cards de relatório exibem exemplos fixos (`FCR 78.4%`, `MTTA 12 min`, `MTTR 2.4 horas`, `CSAT 4.9 / 5.0`) em seção do componente | Identificar o contexto de exibição e substituir exemplos visíveis na produção por cálculos reais ou estado não disponível |

## Testes executados nesta auditoria
- `node --test tests/sac/sac-chat-contract.test.mjs` no patch original extraído: **4/4 aprovados**.
- `node --test tests/sac/copilot-contract.test.mjs` no patch de IA extraído: **5/5 aprovados**.
- **Limitação importante:** são testes que inspecionam padrões de código; não são testes de integração ou comportamento real com Neon.
- Não foram executados: build/TypeScript completo da implantação atual, migrations Neon, testes E2E, APIs autenticadas, performance ou monitoramento.

## Correções propostas — execução em ondas
### Onda 0 — Bloqueios operacionais
1. Congelar novos widgets e salvar snapshot/backup verificável da versão implantada.
2. Remover shell duplicado, flags de simulação e números fictícios de produção.
3. Expor o estado `Indisponível/Não integrado` em vez de valores inventados quando uma integração não estiver configurada.
4. Revisar acesso cruzado e isolamento por produtora antes de ligar integrações externas.

### Onda 1 — Dados reais e SLA
1. Criar contrato unificado de evento de atendimento com `id`, `producerId`, `ticketId`, `channel`, `origin`, timestamps, `status` e ator.
2. Criar KPIs por `producerId`, canal, janela horária e fuso, com definição de denominador. `Atendimentos hoje` não deve somar clientes e mensagens indistintamente.
3. Unificar estados de fila, ativo, encerrado e transferido, refletidos no dashboard e chat.
4. Recalcular SLA com política, calendário, prioridade, pausas e transição IA → humano; auditar cálculo e violação.

### Onda 2 — Operação e skills
1. Presença independente de telas; restauração de estado e expiração previsível.
2. CRUD de skills com auditoria do supervisor, limite 3 por atendente e matchmaking transacional.
3. Alertas sonoros apenas por evento real de crescimento/risco, com limiares, cooldown e consentimento de áudio.
4. Paginação de histórico, reconexão e idempotência de mensagens externas.

### Onda 3 — IA e multicanal
1. Cliente: árvore de assuntos + artigos aprovados + atendimento N1 + opção humana sempre disponível.
2. Transição para SAC sem trocar protocolo ou perder histórico; registrar tempo em IA e fila separadamente.
3. WhatsApp e e-mail: ingestão oficial, deduplicação, autorização e métricas somente após integração validada.
4. Copiloto permanece com envio sujeito ao atendente.

## Matriz mínima de homologação
| Teste | Critério de aceite |
|---|---|
| Navegação | Apenas um menu e cabeçalho globais; nenhum shell SAC duplicado |
| Dados do dashboard | KPIs conciliam com contagens da API e banco para mesmo tenant, canal, período e timezone |
| Fila automática | Com 4 chats e 1 agente disponível, 3 ativos e 1 aguardando |
| Assumir manualmente | Duas tentativas simultâneas resultam em exatamente uma atribuição |
| Presença | Operador permanece elegível ao trocar para outra tela do ERP, conforme estado online |
| Skills | Mudança feita pelo supervisor persiste e afeta roteamento de forma auditável |
| SLA | Prazos derivados da política aplicável e calendário; mudanças de status auditadas |
| Alertas | Evento real de fila acima do limiar toca som uma vez por janela configurada; sem simulação em produção |
| IA cliente → SAC | Mesmo protocolo, histórico completo, resumo visível e transferência autorizada |
| Segurança | Nenhum acesso a conversas/skills de outra produtora; testes com perfis cliente, agente, supervisor e admin |
| Temas | Contraste e navegação corretos nos modos claro e escuro |
| Falhas externas | Indisponibilidade do provedor WhatsApp/IA não bloqueia a API central do ERP |

## Evidências adicionais necessárias para um laudo conclusivo da implantação
- Código/commit efetivamente publicado e ambiente de homologação da mesma versão.
- Respostas de rede de `/api/support` e `/api/sac/*` com dados anonimizados.
- Logs das chamadas problemáticas (sem tokens ou dados de clientes), configurações de rotas e resultado das migrations no Neon.
- Execução automatizada com três perfis (cliente, atendente e supervisor) e duas produtoras fictícias.

## Veredito
**Não liberar o Dashboard SAC para decisões operacionais baseadas em fila, eficiência ou SLA antes da conciliação de dados e validação das ações.** O desenho grafite/neon pode ser mantido. Este relatório é uma auditoria de vídeo e código disponível; não equivale à homologação da implantação atual.
