# Ublock — Sistema RMM e Gestão de Ativos de TI (Ubook)
## Documento Inicial de Planejamento e Arquitetura

**Projeto:** Ublock (Ub = Ubook, Lock = Travar/Bloqueio Remoto Seguro)  
**Versão:** 1.0.0 (Fase 1: MVP Web, Backend, Inventário & Auditoria)  
**Data:** 2026-10-28  

---

### 1. Visão Geral do Sistema
O **Ublock** é uma plataforma de monitoramento remoto e gestão de ativos (RMM / Light MDM) concebida para atender à governança de TI e segurança de endpoints da **Ubook**.

A solução baseia-se em três pilares fundamentais:
1. **Painel Web Central (Dashboard & API Backend):** Gestão centralizada de inventário (hardware, SO, departamento, funcionário), telemetria, permissões administrativas e fila de comandos de segurança.
2. **Canal de Comunicação Seguro:** Comunicação iniciada pelo dispositivo cliente (evitando problemas de NAT/Firewall) via HTTPS e WebSockets com autenticação estrita por chave de máquina e mTLS.
3. **Agente Local (Daemon de Sistema):** Binário em Go de alta performance rodando com privilégios de sistema (`SYSTEM` no Windows, `root` no Linux/macOS) capaz de coletar telemetria e executar comandos de contenção e bloqueio de emergência (failsafe).

---

### 2. Estratégia de Desenvolvimento em Fases

Para garantir estabilidade, segurança e evitar retrabalho estrutural, o desenvolvimento segue o modelo **API-First** dividido em fases progressivas:

```
[FASE 1: MVP Web & Persistência] (FOCO ATUAL)
  ├── Backend FastAPI + PostgreSQL / SQLAlchemy 2.0 + Alembic
  ├── Modelagem de Organização, Dispositivos, Funcionários, Departamentos
  ├── Autenticação RBAC (SuperAdmin, Técnico, Visualizador) e Isolamento Multiempresa
  ├── Gestão de Inventário de Dispositivos e Contas Locais
  ├── Fila de Comandos em MODO SIMULADO (Sem execução real de OS)
  ├── Trilha de Auditoria Imutável
  └── Frontend Web em React + TypeScript + Vite + Tailwind CSS

[FASE 2: Agente Local em Go (Windows/Linux/macOS)]
  ├── Binário Go compilado com serviço de sistema (Windows Service / Systemd)
  ├── Coletor de telemetria periódico (CPU, RAM, Disco, Adaptadores de Rede)
  ├── Heartbeat e Enrolment seguro por token único
  └── Comunicação HTTPS / Polling inicial com o Backend

[FASE 3: Ações de Contenção & Failsafe Real]
  ├── Execução segura de bloqueio com failsafe ordenado:
  │     1º Suspender conta local / alterar senha
  │     2º Derrubar sessões ativas
  │     3º Reportar confirmação de sucesso à API
  │     4º Desativar adaptadores de rede (isolamento físico)
  ├── Anti-tampering e proteções de serviço
  └── Empacotamento de instaladores silenciosos (.msi, .deb, .pkg)
```

> [!IMPORTANT]
> **Limite de Segurança da Fase 1:** Toda ação de controle (`SUSPEND_LOCAL_ACCOUNT`, `END_USER_SESSION`, `ISOLATE_DEVICE_NETWORK`, `EMERGENCY_LOCKDOWN`) é estritamente **SIMULADA** no banco de dados e sinalizada visualmente na interface. Não são disparados comandos reais de sistema operacional até a validação completa do login, permissões, inventário e auditoria.

---

### 3. Modelo de Dados e Entidades Principais

As entidades da Fase 1 são escopadas por `organization_id`:

- `organizations`: Cadastro de empresas/tenants (ex.: "Ubook Enterprise").
- `admin_users`: Operadores do painel com papéis (`SUPER_ADMIN`, `TECHNICIAN`, `VIEWER`).
- `departments`: Departamentos corporativos (TI, Financeiro, Vendas, etc.).
- `employees`: Colaboradores associados aos ativos.
- `devices`: Computadores cadastrados com hostname, tag de patrimônio, SO, status e responsável.
- `device_accounts`: Contas locais mapeadas na máquina (simuladas no MVP).
- `device_telemetry`: Histórico de saúde (CPU%, RAM%, Disco).
- `commands`: Fila de comandos com `mode = 'SIMULATION'` e status (`PENDING`, `SUCCEEDED_SIMULATED`, `FAILED_SIMULATED`).
- `audit_logs`: Registro imutável de todas as ações sensíveis realizadas no painel.

---

### 4. Checklist da Fase 1

- [x] Especificação e documentação arquitetural Ublock
- [ ] Backend FastAPI estruturado com arquitetura limpa
- [ ] Modelos SQLAlchemy 2.0 e migrações Alembic
- [ ] Autenticação JWT com RBAC e isolamento multi-tenant
- [ ] Endpoints REST documentados via OpenAPI/Swagger
- [ ] Scripts de bootstrap do admin e seed de dados fictícios (`is_demo=True`)
- [ ] Painel Web React + TypeScript + Tailwind CSS (Modo Escuro / Claro)
- [ ] Suíte de testes automatizados com `pytest`
- [ ] Guia de execução local (Windows PowerShell & Linux) e Docker Compose
