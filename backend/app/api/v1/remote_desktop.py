import json
import logging
import uuid
from typing import Dict, List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import decode_token
from app.api.agent_deps import hash_token
from app.models.device_agent import DeviceAgent, AgentStatusEnum
from app.models.device import Device
from app.models.admin_user import AdminUser
from app.services.audit_service import AuditService

logger = logging.getLogger("RemoteDesktopRelay")

router = APIRouter(prefix="/remote-desktop", tags=["Remote Desktop"])

# Gerencia conexões ativas por device_id
# device_id (str) -> { "agent": WebSocket, "viewers": list[WebSocket], "agent_key": str }
sessions: Dict[str, dict] = {}


def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==============================================================================
# 1. WEBSOCKET DO AGENTE (Captura de tela + execucao de input)
# Autenticado via SHA-256 da agent_key e device_id
# ==============================================================================
@router.websocket("/ws/agent/{device_id}")
async def ws_agent(websocket: WebSocket, device_id: str, key: str = Query(...)):
    await websocket.accept()

    # Validacao de seguranca (PSI-001 & PSI-004)
    db = SessionLocal()
    try:
        t_hash = hash_token(key)
        agent = db.query(DeviceAgent).filter(
            DeviceAgent.token_hash == t_hash,
            DeviceAgent.device_id == uuid.UUID(device_id)
        ).first()

        if not agent or agent.status == AgentStatusEnum.REVOKED.value:
            logger.warning(f"Acesso negado para agente WebSocket: {device_id}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        device = db.query(Device).filter(Device.id == uuid.UUID(device_id)).first()
        org_id = str(device.organization_id) if device else None
    finally:
        db.close()

    if device_id not in sessions:
        sessions[device_id] = {"agent": None, "viewers": [], "org_id": org_id}

    sessions[device_id]["agent"] = websocket
    sessions[device_id]["org_id"] = org_id
    logger.info(f"🟢 [Agente Remoto Conectado] Dispositivo ID: {device_id}")

    # Notifica viewers ativos que a maquina esta pronta
    for v in sessions[device_id]["viewers"]:
        try:
            await v.send_json({"type": "agent_status", "status": "connected"})
        except Exception:
            pass

    try:
        while True:
            msg = await websocket.receive()
            if "bytes" in msg and msg["bytes"]:
                raw_bytes = msg["bytes"]
                # Repassa frame de video JPEG para os tecnicos autorizados
                viewers = list(sessions[device_id]["viewers"])
                for viewer in viewers:
                    try:
                        await viewer.send_bytes(raw_bytes)
                    except Exception:
                        if viewer in sessions[device_id]["viewers"]:
                            sessions[device_id]["viewers"].remove(viewer)

            elif "text" in msg and msg["text"]:
                data = json.loads(msg["text"])
                viewers = list(sessions[device_id]["viewers"])
                for viewer in viewers:
                    try:
                        await viewer.send_json(data)
                    except Exception:
                        pass
    except WebSocketDisconnect:
        logger.warning(f"🔴 [Agente Remoto Desconectado] Dispositivo ID: {device_id}")
    finally:
        if device_id in sessions:
            sessions[device_id]["agent"] = None
            for v in sessions[device_id]["viewers"]:
                try:
                    await v.send_json({"type": "agent_status", "status": "disconnected"})
                except Exception:
                    pass


# ==============================================================================
# 2. WEBSOCKET DO VISUALIZADOR (Tecnico no Navegador)
# Autenticado via JWT de Administrador com validacao Multi-Tenant (Anti-IDOR)
# ==============================================================================
@router.websocket("/ws/viewer/{device_id}")
async def ws_viewer(websocket: WebSocket, device_id: str, token: str = Query(...)):
    await websocket.accept()

    # Limpar possivel prefixo Bearer ou espacos (PSI-001)
    clean_token = token.strip()
    if clean_token.lower().startswith("bearer "):
        clean_token = clean_token[7:].strip()

    # 1. Validar Token JWT (PSI-001)
    payload = decode_token(clean_token)
    if not payload:
        await websocket.send_json({"type": "error", "message": "Token de autenticação inválido ou expirado."})
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = payload.get("sub")
    role = payload.get("role")
    user_org_id = payload.get("org_id")

    if role not in ["SUPER_ADMIN", "TECHNICIAN", "ADMIN"]:
        await websocket.send_json({"type": "error", "message": "Perfil sem permissão para controle remoto."})
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. Validar Isolamento de Organizacao (PSI-004 Anti-IDOR)
    db = SessionLocal()
    try:
        device = db.query(Device).filter(Device.id == uuid.UUID(device_id)).first()
        if not device:
            await websocket.send_json({"type": "error", "message": "Dispositivo não encontrado."})
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        if role != "SUPER_ADMIN" and str(device.organization_id) != str(user_org_id):
            await websocket.send_json({"type": "error", "message": "Acesso não autorizado a este dispositivo."})
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # 3. Trilha de Auditoria (PSI-003): Registrar início de sessão remota
        AuditService.log_event(
            db=db,
            organization_id=device.organization_id,
            action="REMOTE_DESKTOP_SESSION_START",
            outcome="SUCCESS",
            actor_admin_id=uuid.UUID(user_id) if user_id else None,
            device_id=device.id,
            details={"client": "web_canvas", "started_at": datetime.now(timezone.utc).isoformat()}
        )
    finally:
        db.close()

    if device_id not in sessions:
        sessions[device_id] = {"agent": None, "viewers": [], "org_id": device.organization_id}

    sessions[device_id]["viewers"].append(websocket)
    logger.info(f"👤 [Tecnico Conectado ao Desktop] Admin ID: {user_id} -> Device: {device_id}")

    # Avisa o agente que ha um visualizador conectado para ativar o streaming
    agent_ws = sessions[device_id]["agent"]
    if agent_ws:
        await websocket.send_json({"type": "agent_status", "status": "connected"})
        try:
            await agent_ws.send_json({"type": "session_control", "action": "start_streaming"})
        except Exception:
            pass
    else:
        await websocket.send_json({"type": "agent_status", "status": "disconnected"})

    try:
        while True:
            # Recebe eventos de mouse e teclado do navegador e repassa para o agente
            data = await websocket.receive_json()
            curr_agent = sessions.get(device_id, {}).get("agent")
            if curr_agent:
                await curr_agent.send_json(data)
    except WebSocketDisconnect:
        logger.info(f"👤 [Tecnico Desconectou do Desktop] Admin ID: {user_id} -> Device: {device_id}")
    finally:
        if device_id in sessions and websocket in sessions[device_id]["viewers"]:
            sessions[device_id]["viewers"].remove(websocket)

        # Se nao houver mais nenhum visualizador, avisa o agente para voltar ao modo repouso (0% CPU)
        if device_id in sessions and len(sessions[device_id]["viewers"]) == 0:
            curr_agent = sessions.get(device_id, {}).get("agent")
            if curr_agent:
                try:
                    await curr_agent.send_json({"type": "session_control", "action": "stop_streaming"})
                except Exception:
                    pass

        # Trilha de Auditoria (PSI-003): Registrar encerramento da sessão
        db_audit = SessionLocal()
        try:
            device_obj = db_audit.query(Device).filter(Device.id == uuid.UUID(device_id)).first()
            target_org_id = device_obj.organization_id if device_obj else (uuid.UUID(user_org_id) if user_org_id else None)
            if target_org_id:
                AuditService.log_event(
                    db=db_audit,
                    organization_id=target_org_id,
                    action="REMOTE_DESKTOP_SESSION_END",
                    outcome="SUCCESS",
                    actor_admin_id=uuid.UUID(user_id) if user_id else None,
                    device_id=uuid.UUID(device_id),
                    details={"ended_at": datetime.now(timezone.utc).isoformat()}
                )
        except Exception as e:
            logger.error(f"Erro ao registrar auditoria de encerramento remoto: {e}")
        finally:
            db_audit.close()
