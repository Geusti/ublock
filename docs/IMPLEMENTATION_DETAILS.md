# NEXUS IT ASSET MANAGER — Detalhes da Construção & Implementação
## Parte 2: Painel Administrativo, Inventário & Governança

**Projeto:** NEXUS IT ASSET MANAGER / Ublock  
**Versão:** 2.0.0 (Parte 2: Painel Administrativo & Inventário Completo)  
**Data:** 2026-10-28  

---

### 1. Resumo da Entrega da Parte 2
Foi implementada com rigor técnico a **Parte 2** do sistema **NEXUS IT ASSET MANAGER**, expandindo as capacidades do backend, do banco de dados relacional e da interface do painel web corporativo:

1. **Dashboard Operacional Completo:**
   - Indicadores agregados: Total de equipamentos, Computadores online, Computadores offline, Equipamentos que precisam de atenção (`ALERT`), Equipamentos sem comunicação recente (`STALE` > 7 dias), Total de departamentos e colaboradores.
   - **Distribuição por Sistema Operacional** (Windows, macOS, Linux).
   - **Distribuição por Departamento** (ativos alocados por setor).
   - **Tabela dos computadores com alertas:** listagem direta dos ativos com problemas, permitindo abrir imediatamente o detalhe do equipamento.
   - **Atividades administrativas recentes:** stream em tempo real alimentado pela trilha de auditoria.

2. **Inventário Completo de Computadores:**
   - Colunas completas: Nome/Hostname, Patrimônio, Fabricante/Modelo, Sistema Operacional/Versão, Endereço IP, Número de Série, Responsável, Departamento, Status dinâmico, Data/Hora da última comunicação.
   - **Ordenação clicável por colunas** (`hostname`, `display_name`, `asset_tag`, `status`, `last_seen_at`, `created_at`) em ordem ascendente e descendente.
   - **Pesquisa abrangente:** busca em tempo real por nome, hostname, patrimônio, **número de série** e **responsável**.
   - **Filtros avançados:** por status de conectividade, sistema operacional e departamento.
   - **Cálculo dinâmico de status:** computadores sem comunicação há mais de 15 minutos (`ONLINE_THRESHOLD_MINUTES`) são classificados como `OFFLINE`; computadores sem histórico de comunicação aparecem como `UNKNOWN` (desconhecido), e equipamentos com status de alerta ou aposentados mantêm seus estados `ALERT` e `RETIRED`.
   - **Associação e desvinculação manual:** possibilidade de vincular ou desvincular colaborador e departamento tanto na criação quanto na edição.
   - **Confirmação antes de operações destrutivas:** modal de confirmação para retirada lógica de ativo (`RETIRED`).

3. **Módulo de Funcionários & Departamentos:**
   - **Consulta de equipamentos vinculados:** visualização detalhada de cada colaborador com a lista de todos os computadores sob sua responsabilidade.
   - **Página dedicada de Departamentos:** listagem, criação, edição e contagem de computadores e colaboradores vinculados.
   - **Integridade referencial protegida:** se um departamento possui colaboradores ou ativos vinculados, a exclusão realiza uma **desativação lógica** (`is_active=False`) em vez de violar chaves estrangeiras.
   - Bloqueio de associação a departamentos inativos.

4. **Trilha de Auditoria & Segurança:**
   - Registro perene de criação, edição e inativação de equipamentos, colaboradores e departamentos.
   - Ações de bloqueio continuam estritamente em **MODO SIMULADO (`mode="SIMULATION"`)**.
   - Proteção estrita contra IDOR: isolamento total por `organization_id`.

---

### 2. Matriz de Endpoints da API (`/api/v1`)

| Método | Endpoint | Papel Mínimo | Descrição |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Público | Verificação de integridade da API e banco |
| `POST` | `/auth/login` | Público | Autenticação e emissão de JWT |
| `POST` | `/auth/logout` | Autenticado | Encerramento de sessão |
| `GET` | `/auth/me` | Autenticado | Perfil do usuário e organização atual |
| `GET` | `/dashboard/summary` | `VIEWER` | Indicadores, distribuições por SO/Setor e lista de alertas |
| `GET` | `/devices` | `VIEWER` | Listagem com busca (inclui serial/responsável), ordenação e filtros |
| `POST` | `/devices` | `TECHNICIAN` | Cadastro manual de computador no inventário |
| `GET` | `/devices/{id}` | `VIEWER` | Detalhes do ativo, contas locais e telemetria |
| `PATCH` | `/devices/{id}` | `TECHNICIAN` | Edição, associação/desvinculação de colaborador e setor |
| `DELETE` | `/devices/{id}` | `TECHNICIAN` | Retirada lógica de ativo (`RETIRED`) com auditoria |
| `GET` | `/employees` | `VIEWER` | Listagem de colaboradores com filtros |
| `POST` | `/employees` | `TECHNICIAN` | Cadastro de colaborador |
| `GET` | `/employees/{id}` | `VIEWER` | Detalhes do colaborador com lista de equipamentos vinculados |
| `PATCH` | `/employees/{id}` | `TECHNICIAN` | Edição de colaborador |
| `DELETE` | `/employees/{id}` | `TECHNICIAN` | Desativação lógica do colaborador |
| `GET` | `/departments` | `VIEWER` | Listagem de departamentos com contadores de ativos/colaboradores |
| `POST` | `/departments` | `TECHNICIAN` | Criação de departamento |
| `PATCH` | `/departments/{id}` | `TECHNICIAN` | Edição de departamento |
| `DELETE` | `/departments/{id}` | `TECHNICIAN` | Desativação lógica ou exclusão segura de departamento |
| `GET` | `/commands` | `VIEWER` | Listagem da fila de comandos de segurança |
| `POST` | `/devices/{id}/commands` | `TECHNICIAN` | Criação de ordem de contenção (MODO SIMULADO) |
| `POST` | `/commands/{id}/simulate-result` | `TECHNICIAN` | Simulação de conclusão com auditoria |
| `GET` | `/audit-logs` | `VIEWER` | Trilha de auditoria perene e imutável |

---

### 3. Cobertura de Testes Automatizados (`backend/tests/`)

- [`test_auth.py`](file:///c:/Users/Jonatan%20Geusti/Documents/ublock/ublock/backend/tests/test_auth.py): Validação de credenciais, token JWT e perfil.
- [`test_devices.py`](file:///c:/Users/Jonatan%20Geusti/Documents/ublock/ublock/backend/tests/test_devices.py): 
  - CRUD e soft-delete de equipamentos.
  - **Pesquisa por número de série (`serial_number`)**.
  - **Ordenação dinâmica de colunas (ascendente e descendente)**.
  - **Associação e desvinculação de colaboradores (`assigned_employee_id=None`)**.
  - Unicidade da etiqueta patrimonial por organização.
  - Restrição de perfil para visualizadores (`VIEWER` -> 403 Forbidden).
- [`test_dashboard.py`](file:///c:/Users/Jonatan%20Geusti/Documents/ublock/ublock/backend/tests/test_dashboard.py):
  - **Cálculo dinâmico de status por threshold de comunicação** (online < 15 min, offline > 15 min, unknown sem registro).
  - Listagem dos equipamentos em estado de alerta.
  - Distribuição por departamento e por sistema operacional.
- [`test_employees.py`](file:///c:/Users/Jonatan%20Geusti/Documents/ublock/ublock/backend/tests/test_employees.py):
  - CRUD de funcionários e departamentos.
  - **Consulta de equipamentos vinculados ao colaborador**.
  - **Bloqueio de vínculo a departamento inativo**.
  - **Desativação lógica segura de departamento com ativos associados**.
- [`test_commands.py`](file:///c:/Users/Jonatan%20Geusti/Documents/ublock/ublock/backend/tests/test_commands.py): Ciclo de vida simulado da contenção remota.
- [`test_audit.py`](file:///c:/Users/Jonatan%20Geusti/Documents/ublock/ublock/backend/tests/test_audit.py): Imutabilidade da trilha de auditoria.
- [`test_org_isolation.py`](file:///c:/Users/Jonatan%20Geusti/Documents/ublock/ublock/backend/tests/test_org_isolation.py): Isolamento estrito entre empresas (Anti-IDOR).
