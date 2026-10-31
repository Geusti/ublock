import hashlib
from typing import Optional
from fastapi import Header, Depends, status, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.device_agent import DeviceAgent, AgentStatusEnum


def hash_token(token: str) -> str:
    """Computes SHA-256 hash of an enrollment token or agent secret key."""
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()


def get_current_agent(
    x_agent_key: Optional[str] = Header(None, alias="X-Agent-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db)
) -> DeviceAgent:
    """
    Validates agent authentication token using SHA-256 hash comparison.
    Supports either X-Agent-Key: <key> or Authorization: Bearer <key>.
    """
    token = None
    if x_agent_key:
        token = x_agent_key.strip()
    elif authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação do agente ausente. Forneça o cabeçalho X-Agent-Key ou Authorization: Bearer."
        )

    t_hash = hash_token(token)
    agent = db.query(DeviceAgent).filter(DeviceAgent.token_hash == t_hash).first()

    if not agent:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credencial de agente inválida ou não registrada."
        )

    if agent.status == AgentStatusEnum.REVOKED.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este agente foi revogado por um administrador e não pode mais comunicar com a API."
        )

    return agent
