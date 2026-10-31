# PROMPT MESTRE — ANTIGRAVITY
## NEXUS IT ASSET MANAGER — MVP 1

Você é um engenheiro de software sênior responsável por IMPLEMENTAR um projeto funcional chamado **NEXUS IT ASSET MANAGER**. Não entregue apenas telas estáticas, pseudocódigo ou explicações: crie os arquivos, implemente as funcionalidades, execute testes disponíveis e corrija erros.

## 1. Objetivo da primeira entrega

Construir uma aplicação web administrativa para inventário de ativos de TI, com:
- autenticação administrativa;
- dashboard;
- cadastro, edição, visualização, pesquisa e filtros de computadores;
- cadastro e vínculo de funcionários/departamentos;
- visão de contas locais detectadas (dados simulados nesta fase);
- painel de controle de acesso em MODO SIMULADO;
- fila de ações simuladas e trilha de auditoria;
- tema escuro padrão com opção de tema claro;
- API própria e PostgreSQL gerenciado;
- dados fictícios para demonstração, claramente marcados como dados de demonstração.

**Limite de segurança obrigatório:** nesta primeira entrega, não criar agente de endpoint, não executar comandos no sistema operacional, não alterar senhas reais, não desabilitar rede, não encerrar sessões reais e não oferecer execução arbitrária de shell/PowerShell. Toda ação de controle deve ser simulada no banco e identificada visualmente como SIMULAÇÃO. A arquitetura deve permitir adicionar um agente autenticado numa fase posterior, sem implementá-lo agora.

## 2. Stack obrigatória

- Frontend: React + TypeScript + Vite.
- Estilização: Tailwind CSS; componentes reutilizáveis e acessíveis.
- Backend: Python 3.12+ + FastAPI.
- ORM: SQLAlchemy 2.x.
- Migrações: Alembic.
- Validação: Pydantic.
- Banco: PostgreSQL.
- Testes backend: pytest.
- Testes frontend, se viável: Vitest + React Testing Library.
- API documentada pelo OpenAPI/Swagger do FastAPI.
- Comunicação frontend/backend por REST JSON.
- Polling e WebSockets não são necessários no MVP 1.

Se alguma versão de pacote for incompatível, selecione versões estáveis compatíveis e registre-as nos arquivos de dependências.

## 3. Identidade visual e UX

Produto corporativo de IT Asset Management / RMM, visual limpo, profissional, sem gradientes futuristas.
- Fundo escuro: `#0B1120`.
- Superfície/cartões: `#151F32`.
- Azul principal: `#3B82F6`.
- Verde para online/saudável.
- Vermelho para crítico/erro.
- Amarelo para atenção/pendente.
- Tipografia: Inter ou fallback sans-serif.
- Tema escuro é o padrão; adicionar alternância escuro/claro com persistência local no navegador.
- Layout desktop-first, responsivo para tablet e celular.
- Sidebar com ícones e navegação clara.
- Estados de loading, vazio, erro, confirmação e sucesso.
- Tabelas com busca, filtros, ordenação básica e paginação.
- Não usar dados fictícios sem identificá-los como demonstração.

## 4. Navegação e páginas

### 4.1 Login
- Tela de login com e-mail e senha.
- Backend valida as credenciais.
- Não embutir credenciais secretas no frontend.
- Criar comando documentado para criar o primeiro administrador.
- Não habilitar cadastro público de administradores.
- Mensagens de erro genéricas para login inválido.
- Sessão segura: preferir cookie HttpOnly, Secure em produção, SameSite apropriado e proteção CSRF se cookies forem usados. Se optar por bearer token, explicar a decisão e não armazenar tokens de longa duração em localStorage.
- Rate limiting para tentativas de login, ou documentar claramente se ficar para a fase de produção.

### 4.2 Dashboard
Cards:
- Total de computadores.
- Online.
- Offline.
- Com alerta.
- Ações simuladas pendentes.
- Último contato dos agentes (nos dados fictícios, usar “simulado”).
Gráficos simples de estado dos ativos e histórico de inventário, sem inventar telemetria real.
Todos os números devem vir da API.

### 4.3 Inventário de computadores
Tabela com:
- nome do dispositivo;
- hostname;
- sistema operacional e versão;
- funcionário atribuído;
- departamento;
- etiqueta patrimonial;
- IP local (se disponível);
- último contato;
- status;
- menu de ações.
Funcionalidades:
- busca por nome, hostname, patrimônio e funcionário;
- filtros por sistema operacional, departamento e status;
- paginação;
- criar ativo;
- editar ativo;
- abrir detalhe;
- marcar como desativado/retirado de uso (soft delete/status, não apagar histórico);
- validações de campos e mensagens de erro.
Campos do dispositivo: `id`, `organization_id`, `hostname`, `display_name`, `os_family`, `os_version`, `manufacturer`, `model`, `serial_number`, `asset_tag`, `assigned_employee_id`, `department_id`, `local_ip`, `status`, `last_seen_at`, `agent_version`, `is_demo`, `created_at`, `updated_at`.
`asset_tag` deve ser único por organização quando preenchido. `hostname` não precisa ser globalmente único.

### 4.4 Funcionários e departamentos
- Listagem, pesquisa, criação, edição e desativação de funcionários.
- Nome, e-mail corporativo opcional, departamento, status e observações não sensíveis.
- Um funcionário pode estar associado a um ou mais dispositivos; o dispositivo pode ter um responsável principal.
- CRUD de departamentos.
- Não coletar CPF, dados pessoais desnecessários ou senhas locais.

### 4.5 Detalhe do dispositivo
Abas ou seções:
- Resumo.
- Hardware e sistema.
- Funcionário/departamento.
- Contas locais detectadas (DEMO nesta fase).
- Histórico de métricas (DEMO nesta fase).
- Ações e auditoria.
Mostrar claramente quais campos são reais (cadastro feito pelo usuário) e quais são simulados.

### 4.6 Saúde e telemetria
Criar estrutura para receber telemetria futura, mas no MVP as métricas de exemplo devem ter `is_demo=true`.
Campos de exemplo: CPU %, RAM %, espaço total/livre, horário da coleta.
Não alegar que o sistema está monitorando máquinas reais até existir um agente real.
Não coletar conteúdo de arquivos, teclas digitadas, histórico de navegação ou credenciais.

### 4.7 Segurança / Controle de acesso (MODO SIMULADO)
Tela que lista funcionário, dispositivo, tipo de ação, solicitante, horário e estado.
Permitir criar uma solicitação simulada dentre:
- `SUSPEND_LOCAL_ACCOUNT`
- `REACTIVATE_LOCAL_ACCOUNT`
- `END_USER_SESSION`
- `ISOLATE_DEVICE_NETWORK`
- `EMERGENCY_LOCKDOWN`
A interface deve explicar antes da confirmação que nenhuma ação será executada no computador.
Ao confirmar:
1. validar papel e permissão;
2. criar registro em `commands` com `mode="SIMULATION"` e estado `PENDING`;
3. registrar auditoria;
4. permitir que um botão “Simular conclusão” mude para `SUCCEEDED_SIMULATED` ou `FAILED_SIMULATED`;
5. registrar resultado e autor na auditoria.
Nunca chamar subprocess, PowerShell, CMD, shell, SSH ou comandos nativos.
Não implementar campo para digitar comandos livres.
Ações críticas devem exigir confirmação explícita. Se possível, pedir uma segunda confirmação para `EMERGENCY_LOCKDOWN`.

### 4.8 Auditoria
Registrar:
- administrador que fez a ação;
- ação e recurso;
- timestamp UTC;
- resultado;
- metadados mínimos sem segredos.
A interface deve filtrar por data, administrador, dispositivo, tipo de ação e resultado.
A aplicação normal não deve oferecer edição/exclusão dos registros de auditoria.

## 5. Modelo de dados e multiempresa

Criar tabelas/módulos para:
- `organizations`
- `admin_users`
- `departments`
- `employees`
- `devices`
- `device_accounts`
- `device_telemetry`
- `commands`
- `audit_logs`

Toda entidade pertencente a uma empresa deve ter `organization_id` e cada consulta deve ser isolada pelo contexto da organização autenticada. Não confiar em `organization_id` enviado livremente pelo frontend: obter a organização do usuário autenticado.
No MVP, pode-se criar uma única organização demo. Ainda assim, não deixar consultas sem isolamento por organização.
Usar UUIDs como IDs. Usar UTC para datas. Criar índices e chaves estrangeiras apropriados.
Usar soft delete/estado de desativação para funcionários e dispositivos quando necessário.
Definir constraints para estados e tipos de ação.

## 6. API REST inicial

Criar rotas versionadas sob `/api/v1`:
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /dashboard/summary`
- `GET /devices`
- `POST /devices`
- `GET /devices/{device_id}`
- `PATCH /devices/{device_id}`
- `GET /employees`
- `POST /employees`
- `GET /employees/{employee_id}`
- `PATCH /employees/{employee_id}`
- `GET /departments`
- `POST /departments`
- `PATCH /departments/{department_id}`
- `GET /devices/{device_id}/accounts`
- `GET /devices/{device_id}/telemetry`
- `GET /commands`
- `POST /devices/{device_id}/commands`
- `POST /commands/{command_id}/simulate-result`
- `GET /audit-logs`

Adicionar paginação, validação e respostas de erro consistentes. Documentar filtros e exemplos em `docs/api.md`. Usar códigos HTTP corretos. Não expor stack traces ao usuário.

## 7. Segurança mínima obrigatória

- Hash de senha com Argon2id ou bcrypt, por biblioteca mantida.
- Segredos somente por variáveis de ambiente.
- Criar `.env.example`, nunca commitar `.env`.
- CORS restrito a origens configuradas por ambiente.
- Autorização no backend em todas as rotas protegidas.
- Papéis: `SUPER_ADMIN`, `TECHNICIAN`, `VIEWER`.
- `VIEWER` só consulta; `TECHNICIAN` pode gerir inventário e criar simulações permitidas; `SUPER_ADMIN` administra usuários e políticas.
- Validar UUIDs e payloads com Pydantic.
- Evitar SQL dinâmico inseguro.
- Não registrar senhas, cookies, tokens ou segredos em logs.
- Proteção contra IDOR: verificar propriedade/organização de cada recurso.
- Rate limiting no login, se viável na arquitetura escolhida.
- Ações críticas com confirmação e auditoria.
- Documentar TLS obrigatório em produção, backups, rotação de credenciais e gestão de segredos.
- O agente e a execução real de ações privilegiadas ficam fora do escopo desta entrega.

## 8. Dados de demonstração

Criar um comando/script idempotente para carregar:
- uma organização de demonstração;
- departamentos de TI, Financeiro, Operações e Comercial;
- 5 a 10 funcionários fictícios;
- 8 a 12 computadores fictícios Windows/Linux/macOS;
- algumas contas locais fictícias;
- telemetria fictícia;
- alguns registros de auditoria e comandos simulados.

Todos os dados de demonstração devem estar marcados por `is_demo=true` ou identificador equivalente.
Não usar dados reais ou credenciais de pessoas reais.
O seed não deve recriar ou duplicar dados quando executado mais de uma vez.
A senha do administrador inicial deve ser definida por variável de ambiente ou comando interativo; não deixar senha padrão fixa no repositório.

## 9. Organização do repositório

Criar uma estrutura semelhante a:

nexus-it-asset-manager/
  frontend/
    src/
      app/
      components/
      features/
        auth/
        dashboard/
        devices/
        employees/
        departments/
        security/
        audit/
      lib/
      styles/
    package.json
    .env.example
  backend/
    app/
      api/v1/
      core/
      db/
      models/
      schemas/
      services/
      repositories/
    tests/
    alembic/
    pyproject.toml ou requirements.txt
    .env.example
  database/
    schema.sql ou migrations/
  docs/
    architecture.md
    api.md
    security.md
    setup.md
  docker-compose.yml
  .gitignore
  README.md

Ajuste a estrutura se houver uma razão técnica, mas mantenha a separação entre frontend, API, persistência e documentação.

## 10. Desenvolvimento local

Fornecer:
- `docker-compose.yml` para desenvolvimento local com PostgreSQL e serviços necessários;
- `.env.example` para frontend e backend;
- instruções Windows PowerShell e instruções macOS/Linux;
- migrações Alembic;
- seed de demonstração;
- comandos para instalar dependências, iniciar frontend/backend, criar administrador e executar testes;
- health check da API (`/health`);
- README completo com pré-requisitos e troubleshooting.

Não exigir que o usuário tenha Docker em produção; Docker Compose é para desenvolvimento local.

## 11. Critérios de aceite

O MVP só está concluído quando:
1. O projeto instala e inicia seguindo o README.
2. O banco PostgreSQL pode ser inicializado por migrações.
3. O login valida um administrador criado pelo comando documentado.
4. O dashboard lê dados da API.
5. O inventário lista, pesquisa, filtra, cria, edita e detalha ativos.
6. Funcionários e departamentos podem ser cadastrados e editados.
7. A alternância de tema funciona e é persistida.
8. Ações de controle são explicitamente simuladas e gravadas no banco.
9. Cada ação simulada gera auditoria.
10. Um usuário `VIEWER` não consegue alterar dados chamando a API diretamente.
11. Recursos de outra organização não podem ser acessados por troca de ID.
12. Os testes principais passam.
13. Nenhuma ação de sistema operacional é executada.
14. O README explica como configurar a aplicação localmente.

## 12. Forma de trabalho

Antes de codificar, inspecione o diretório atual e preserve arquivos existentes úteis. Depois:
1. apresente um plano curto;
2. implemente por etapas;
3. rode testes e verificações;
4. corrija erros;
5. liste arquivos criados e comandos executados;
6. informe limitações reais restantes.

Não diga que algo foi testado se não tiver executado o teste. Não substitua funcionalidades por botões decorativos. Se uma integração não estiver configurada, exiba um estado de configuração pendente claramente identificado.
