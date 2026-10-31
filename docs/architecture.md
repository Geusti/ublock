# NEXUS IT ASSET MANAGER — Arquitetura MVP 1

## Decisões
- Frontend: React + TypeScript + Vite + Tailwind CSS.
- API própria: Python + FastAPI + Pydantic.
- Persistência: PostgreSQL + SQLAlchemy 2.x + Alembic.
- Testes: pytest e testes frontend com Vitest quando viável.
- Agente local: fora do escopo do MVP 1.
- Controle de acesso remoto: simulação persistida, sem execução no endpoint.
- Tema escuro padrão e tema claro alternável.

## Componentes
1. Browser: interface administrativa, sem segredos de backend.
2. API: autenticação, autorização, validação e regras de negócio.
3. PostgreSQL: fonte persistente de dados.
4. Seed demo: dados sintéticos marcados como demonstração.
5. Comandos simulados: fila persistente e resultado simulado com trilha de auditoria.

## Princípios de segurança
- Todas as consultas a recursos de negócio devem ser escopadas por organização.
- Nunca confiar no organization_id enviado pelo browser.
- Não aceitar comandos de shell arbitrários.
- Não armazenar senha de conta local dos funcionários.
- Registrar ações críticas em auditoria.
- Em produção, usar TLS, segredos gerenciados, backups e políticas de retenção.
- Não habilitar cadastro público de administradores.
- Não declarar um endpoint online com base apenas em dados de demonstração.

## Fluxo de ação simulada
1. Administrador cria uma solicitação.
2. API verifica papel, organização e recurso.
3. API grava command com mode=SIMULATION.
4. API grava audit log.
5. Usuário autorizado solicita simular resultado.
6. API atualiza status para SUCCEEDED_SIMULATED ou FAILED_SIMULATED e grava auditoria.

## Fases futuras
- Fase 2: agente Windows em modo de coleta.
- Fase 3: enrolment seguro, credenciais de dispositivo e telemetria real.
- Fase 4: ações específicas, allowlist, confirmação, rollback e testes em laboratório.
- Fase 5: Linux/macOS, distribuição assinada e operação de produção.
