# NEXUS IT ASSET MANAGER (Ublock)

Plataforma corporativa de gestão de inventário de ativos de TI e Remote Monitoring & Management (RMM) para os computadores da **Ubook**.

---

## 🎯 Escopo das Entregas

### Parte 1 & 2: Painel Administrativo, RBAC & Inventário
- **Autenticação Administrativa & RBAC:** Sessão JWT e três perfis de acesso (`SUPER_ADMIN`, `TECHNICIAN`, `VIEWER`).
- **Dashboard Operacional:**
  - Total de equipamentos cadastrados.
  - Computadores online e offline (com cálculo dinâmico via limite de tempo).
  - Equipamentos que precisam de atenção (`ALERT`).
  - Equipamentos sem comunicação recente (`STALE` > 7 dias).
  - Distribuição visual por Sistema Operacional (Windows, macOS, Linux).
  - Distribuição visual por Departamento.
  - Tabela dos computadores com alertas (com atalho direto para o ativo).
  - Feed das atividades administrativas recentes via auditoria.
- **Inventário Completo de Computadores:**
  - Colunas: Nome/Hostname, Patrimônio, Fabricante/Modelo, Sistema Operacional/Versão, Endereço IP, Número de Série, Responsável, Departamento, Status dinâmico, Data/Hora da última comunicação.
  - Pesquisa por nome, hostname, patrimônio, **número de série** e **responsável**.
  - Filtros por status de conectividade, sistema operacional e departamento.
  - **Ordenação clicável por cabeçalhos de colunas** (ascendente/descendente).
  - Paginação completa.
  - Visualização detalhada de cada computador.
  - Cadastro e edição manual com associação e desvinculação de colaboradores.
  - Confirmação de segurança para retirada de uso (`RETIRED`).
- **Funcionários & Departamentos:**
  - Cadastro, edição e desativação lógica de colaboradores.
  - Consulta detalhada dos equipamentos associados a cada colaborador.
  - Módulo dedicado de Departamentos com contadores de colaboradores e ativos vinculados.
  - Proteção de integridade referencial: desativação lógica se houver vínculos ativos.
- **Segurança & Auditoria:**
  - Controle de ações de bloqueio em **MODO SIMULADO (`mode="SIMULATION"`)** com trilha de auditoria append-only imutável.
  - Isolamento multiempresa e barreira estrita contra IDOR.

### Parte 3: Agente Windows & Telemetria Real
- **Agente Nativo em Go:** Binário único compilado em Go para Windows de 64 bits (`nexus-agent.exe`).
- **Serviço do Windows (SCM):** Executa como serviço de segundo plano (`NexusAgent`) com início automático antes do logon do usuário.
- **Comunicação Outbound HTTPS:** Conexão unidirecional iniciada pelo cliente; nenhuma porta de escuta aberta no endpoint do colaborador.
- **Pareamento Seguro por Token Único (Single-Use):** Geração no painel web com hash SHA-256 e validação de expiração e uso único.
- **Telemetria e Hardware Real:** Coleta de CPU, memória RAM física total/disponível, espaço em unidades de disco e interfaces de rede (IP e MAC).
- **Heartbeat & Resiliência:** Atualização periódica de conectividade com recálculo automático de status (Online/Offline) e backoff exponencial com jitter em caso de falha de rede.
- **Revogação Instantânea de Acesso:** Botão no painel para revogação do agente com bloqueio imediato (código HTTP 403) e auditoria.
- **Instaladores e Automação:** Scripts PowerShell (`install-service.ps1`, `uninstall-service.ps1`) e script Inno Setup (`nexus-agent.iss`). Consulte o [Guia do Agente Windows](docs/AGENT_GUIDE.md).

---

## 🚀 Como Executar Localmente

### Opção 1: Via Docker Compose (Recomendado)

Na pasta do projeto (`ublock/`):
```bash
docker compose up --build -d
```
Acesse:
- **Painel Web:** [http://localhost:3000](http://localhost:3000)
- **API Swagger / Documentação:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

---

### Opção 2: Execução Manual com PowerShell (Windows)

#### Pré-requisitos
- Python 3.11+
- Node.js 18+ e npm

#### 1. Configurar e rodar o Backend:
```powershell
cd backend

# Criar e ativar ambiente virtual:
python -m venv venv
.\venv\Scripts\Activate.ps1

# Instalar dependências:
pip install -r requirements.txt

# Inicializar admin e carga de demonstração:
python -m app.scripts.bootstrap_admin
python -m app.scripts.seed_demo_data

# Executar a suíte de testes:
pytest -v

# Iniciar o servidor FastAPI:
uvicorn app.main:app --reload --port 8000
```

#### 2. Configurar e rodar o Frontend:
```powershell
cd ..\frontend

# Instalar dependências:
npm install

# Iniciar servidor Vite:
npm run dev
```
Acesse [http://localhost:5173](http://localhost:5173).

---

## 🔑 Credenciais de Demonstração (Seed)

| Perfil | E-mail | Senha | Nível de Permissão |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@ubook.com.br` | `UblockAdmin2026!` | Acesso total a políticas, inventário, setores e ações |
| **Técnico TI** | `tecnico@ubook.com.br` | `UblockTech2026!` | Gestão do inventário, colaboradores e simulação de ordens |
| **Auditor / Visualizador** | `auditor@ubook.com.br` | `UblockView2026!` | Somente leitura de dados e consulta de auditoria |

---

## 📋 Checklist de Validação da Parte 2

- [x] O dashboard abre sem erros e consulta os dados reais do sistema.
- [x] Consigo cadastrar, editar, pesquisar e filtrar computadores.
- [x] Consigo cadastrar funcionários e departamentos e associá-los aos equipamentos.
- [x] Os dados continuam existindo após atualizar a página (persistidos no banco de dados).
- [x] O login e as permissões são validados pelo backend (RBAC).
- [x] O histórico registra as ações administrativas relevantes em auditoria imutável.
- [x] O projeto inicia e a suíte de testes passa com cobertura de todos os novos requisitos.
