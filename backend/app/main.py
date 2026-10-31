from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import Base, engine
from app.api.v1.router import api_v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables are created when running in SQLite development mode
    if settings.DATABASE_URL.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Ublock IT Asset Manager & RMM Central Platform API.\n\n"
        "Ambiente de monitoramento remoto seguro para governança de endpoints da Ubook.\n"
        "Fase 1: Módulo administrativo, gestão de inventário e fila de comandos em modo estritamente simulado."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Configuration
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [str(settings.CORS_ORIGINS)]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Safeguard to ensure unexpected exceptions don't expose system internals or secrets."""
    # In production, log error details securely without secrets
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Ocorreu um erro interno no servidor. Por favor, tente novamente mais tarde."}
    )


# Include API Router
app.include_router(api_v1_router, prefix=settings.API_PREFIX)

# Also expose health check at root /health for simple container pinging
@app.get("/health", tags=["Health"])
def root_health():
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "mode": "SIMULATION_SAFE"
    }


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Bem-vindo à API do {settings.APP_NAME}",
        "docs_url": "/docs",
        "api_prefix": settings.API_PREFIX
    }
