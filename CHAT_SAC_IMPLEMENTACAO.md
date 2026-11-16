# Chat SAC — SafeSaff — patch de implementação

## Escopo

- Conversas abertas por usuários autenticados, vinculadas a `ServiceTicket` e `TicketMessage` existentes.
- Atendimento privativo do SAC, segregado por `producerId` e por cliente autenticado.
- Distribuição automática aos atendentes `sac-agent` / `sac-supervisor` e administradores, apenas se disponíveis e com heartbeat recente (60 s).
- Capacidade máxima **3 conversas ativas por agente**, filas mantidas quando não há capacidade.
- Assumir manualmente apenas conversas disponíveis; ações serializadas no PostgreSQL por lock transacional por produtora.
- Supervisor pode ver a fila e transferir conversas; protocolos e auditoria de atribuições ficam persistidos.
- Tela `Chat SAC` integrada à navegação de atendimento; atualizações por polling de 2,5 a 3 segundos e heartbeat de 20 segundos. **Não usa WebSocket nesta entrega.**

## Instalação / homologação (antes de produção)

1. Faça backup do banco de produção e crie um ambiente de homologação. O ZIP contém **apenas arquivos novos/modificados**, e não substitui o backup completo.
2. Copie os arquivos para o caminho correspondente no repositório original; não sobrescreva outros arquivos do projeto.
3. Instale dependências do projeto original com `npm ci` em ambiente com acesso ao registro npm.
4. Configure `DATABASE_URL` para PostgreSQL de homologação.
5. Aplique a migração PostgreSQL com `npx prisma migrate deploy --schema prisma/schema.postgresql.prisma`, **após validar o histórico de migrações existente**. Se o banco atual for mantido por `prisma db push` (sem migrações versionadas prévias), planeje baseline antes de usar migrate deploy; alternativamente revise e execute exclusivamente o SQL `prisma/migrations/20261116_sac_chat/migration.sql` via ferramenta de migração do ambiente.
6. Rode `npx prisma generate --schema prisma/schema.postgresql.prisma` para gerar as classes do cliente utilizadas pela API. O `schema.prisma` SQLite também recebeu os modelos, para manter o desenvolvimento local consistente, mas o SQL entregue é PostgreSQL.
7. Cadastre usuários de perfil `sac-agent` e/ou `sac-supervisor` com a mesma produtora a ser atendida. Administradores globais precisam selecionar a produtora ao entrar no chat.
8. Faça login com atendente e selecione **Disponível**. Clientes autenticados podem abrir conversa na página **Chat SAC**.
9. Valide os testes de contrato `node --test tests/sac/sac-chat-contract.test.mjs`, e execute o build/typecheck, migração e testes com um banco real no seu ambiente antes de publicar.

## Rotas

`GET /api/sac/chat/conversations?producerId=` — lista por perfil;
`POST /api/sac/chat/conversations` — inicia chat;
`GET /api/sac/chat/conversations/:id/messages` — histórico;
`POST /api/sac/chat/conversations/:id/messages` — envia mensagem;
`PUT /api/sac/chat/agents/me/status` — altera presença/heartbeat;
`POST /api/sac/chat/conversations/:id/claim` — assumir;
`POST /api/sac/chat/conversations/:id/close` — encerrar;
`POST /api/sac/chat/conversations/:id/transfer` — supervisor;
`GET /api/sac/chat/agents` — supervisão.

## Limites conhecidos desta entrega

- Sem upload de arquivos, notificações push, indicador de digitação ou recibos de leitura.
- Atualização por polling periódico: boa compatibilidade com o frontend e infraestrutura atual, mas não é instantânea como um WebSocket.
- Não há testes end-to-end executados com PostgreSQL real nesta sessão; os testes entregues verificam contratos estáticos, não o comportamento completo em execução.
- O patch não altera autenticação ou regras dos módulos de atendimento legados; a API nova possui checagens próprias.
- Em múltiplas instâncias, o lock do PostgreSQL protege a alocação. A atualização da tela se dá pelo polling.
