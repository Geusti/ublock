# NEXUS IT ASSET MANAGER (Ublock) — Guia de Deploy em Produção

Este documento orienta como publicar o ecossistema Ublock na nuvem de forma gratuita/baixo custo para testes em produção, permitindo que agentes instalados em qualquer lugar do mundo enviem dados para a sua API e você acompanhe tudo pelo painel web.

---

## 1. Arquitetura de Nuvem Recomendada

Para um sistema RMM como o Ublock, precisamos de 3 componentes na nuvem:

```
[ Agentes nos PCs / Laptops ]
             │ (HTTPS Outbound)
             ▼
[ Backend FastAPI + PostgreSQL ] ─── (Render / Railway / Fly.io)
             ▲
             │ (API REST / HTTPS)
[ Frontend React (Vercel) ] ──────── (https://seu-painel.vercel.app)
```

| Componente | Onde Hospedar | Por que? | Custo |
|---|---|---|---|
| **Frontend (React)** | **Vercel** | Líder para React/Vite, CDN global ultra-rápida, SSL automático. | Gratuito |
| **Backend (FastAPI)** | **Render** ou **Railway** | Roda serviços Python contínuos (Web Service), suporta Uvicorn e conexões HTTP de longa duração. | Gratuito / Muito baixo |
| **Banco de Dados** | **Supabase** (Recomendado!) ou **Neon** | PostgreSQL gerenciado gratuito, interface web excelente para inspecionar tabelas e backups automáticos. | Gratuito |

> **Nota sobre a Vercel:** A Vercel é excelente para o Frontend (HTML, CSS, JS), mas funções serverless têm limite de tempo de execução e não possuem armazenamento persistente para arquivos `.db` SQLite. Por isso, a prática padrão da indústria é colocar o **Frontend na Vercel** e o **Backend no Render/Railway**.

---

## 2. Passo 1: Subir o Projeto para o GitHub

No terminal do seu computador (na pasta `ublock`):

```bash
# 1. Inicializar o repositório git
git init

# 2. Adicionar todos os arquivos
git add .

# 3. Criar o primeiro commit
git commit -m "feat: initial commit Ublock RMM (Backend, Frontend, Agent)"

# 4. Conectar com o seu repositório no GitHub
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/ublock.git

# 5. Enviar os arquivos
git push -u origin main
```

---

## 3. Passo 2: Banco de Dados no Supabase e Backend no Render

### A. Criando o Banco no Supabase:
1. Acesse [supabase.com](https://supabase.com) e crie um projeto gratuito (ex: `ublock-db`);
2. Escolha uma senha forte para o banco de dados;
3. No painel do projeto, vá em **Project Settings** > **Database**;
4. Na seção **Connection String** > selecione **URI** (ou **Transaction Pooler** / **Session**);
5. Copie a URL (formato: `postgresql://postgres.[ref]:[SENHA]@aws-0-[regiao].pooler.supabase.com:6543/postgres`);
6. Substitua `[SENHA]` pela sua senha real definida no projeto.

### B. Configurando o Backend no Render:
1. Crie uma conta gratuita em [render.com](https://render.com);
2. Clique em **New +** > **Web Service**;
3. Conecte ao seu repositório GitHub;
4. **Root Directory:** `backend`;
5. **Environment:** `Python 3`;
6. **Build Command:** `pip install -r requirements.txt && python -m app.scripts.bootstrap_admin`;
7. **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`;
8. Em **Environment Variables**, adicione:
   - `DATABASE_URL`: *(Cole a URL do Supabase obtida no passo A)*
   - `SECRET_KEY`: *(Gere uma string segura aleatória de 32 caracteres)*
   - `CORS_ORIGINS`: `*`
9. Clique em **Create Web Service** e guarde a URL gerada (ex: `https://ublock-backend.onrender.com`).

---

## 4. Passo 3: Hospedar o Frontend na Vercel

1. Acesse [vercel.com](https://vercel.com) e conecte com sua conta do GitHub.
2. Clique em **Add New...** > **Project**.
3. Selecione o repositório `ublock`.
4. Em **Root Directory**, clique em Edit e selecione a pasta: `frontend`.
5. Em **Build and Output Settings**, o framework preset detectará automaticamente **Vite**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Em **Environment Variables**, adicione:
   - **Nome:** `VITE_API_BASE_URL`
   - **Valor:** `https://ublock-backend.onrender.com/api/v1` *(a URL do seu backend no Render)*
7. Clique em **Deploy**.

Em menos de 1 minuto seu painel estará online com HTTPS gratuito no link `https://ublock-seu-nome.vercel.app`!

---

## 5. Como os Agentes se Conectarão na Nuvem

Com a API rodando na nuvem com HTTPS:

1. Você acessa o painel na Vercel: `https://ublock-seu-nome.vercel.app`.
2. Faz login com o admin criado no bootstrap.
3. Clica em **"Pareamento em Lote (Auto-Discovery)"** e copia o código de pareamento.
4. No computador de qualquer funcionário (Windows), você ou ele executa:
   ```powershell
   nexus-agent.exe -enroll "ublock_bulk_..." -api "https://ublock-backend.onrender.com/api/v1"
   ```
   *(Ou usando o script `run-agent-client.py` passando a URL da nuvem).*

O computador enviará o inventário via HTTPS pela internet diretamente para o seu servidor, e você verá o ativo aparecer imediatamente no painel da Vercel em tempo real!
