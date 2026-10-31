import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.models.command import Command, CommandStatusEnum, ActionTypeEnum
from app.models.device import Device
from app.models.device_account import DeviceAccount
from app.models.admin_user import AdminUser
from app.services.audit_service import AuditService
from app.core.exceptions import NotFoundException, BadRequestException


class CommandService:
    @staticmethod
    def create_simulated_command(
        db: Session,
        admin: AdminUser,
        device_id: uuid.UUID,
        action_type: str,
        target_account_id: Optional[uuid.UUID] = None,
        reason: Optional[str] = None,
    ) -> Command:
        """Creates a strictly simulated command in the database and records audit log."""
        # 1. Verify device belongs to user's organization
        device = db.query(Device).filter(
            Device.id == device_id,
            Device.organization_id == admin.organization_id
        ).first()
        if not device:
            raise NotFoundException("Dispositivo não encontrado nesta organização")

        # 2. If target_account_id provided, verify ownership
        target_account = None
        if target_account_id:
            target_account = db.query(DeviceAccount).filter(
                DeviceAccount.id == target_account_id,
                DeviceAccount.device_id == device.id,
                DeviceAccount.organization_id == admin.organization_id
            ).first()
            if not target_account:
                raise NotFoundException("Conta de usuário local não encontrada para este dispositivo")

        # 3. Create simulated command record
        command = Command(
            organization_id=admin.organization_id,
            device_id=device.id,
            target_account_id=target_account.id if target_account else None,
            action_type=action_type,
            mode="SIMULATION",
            status=CommandStatusEnum.PENDING.value,
            requested_by=admin.id,
            reason=reason,
        )
        db.add(command)
        db.commit()
        db.refresh(command)

        # 4. Audit creation
        AuditService.log_event(
            db=db,
            organization_id=admin.organization_id,
            action=f"CREATE_SIMULATED_COMMAND:{action_type}",
            outcome="PENDING_SIMULATED",
            actor_admin_id=admin.id,
            device_id=device.id,
            command_id=command.id,
            details={
                "action_type": action_type,
                "mode": "SIMULATION",
                "hostname": device.hostname,
                "target_account": target_account.username if target_account else None,
                "reason": reason,
                "safe_guard_note": "Ação estritamente simulada em banco de dados; nenhum comando de sistema operacional foi emitido.",
            }
        )

        return command

    @staticmethod
    def simulate_result(
        db: Session,
        admin: AdminUser,
        command_id: uuid.UUID,
        succeeded: bool = True,
        result_message: Optional[str] = None
    ) -> Command:
        """Simulates completion of a command without triggering any real system execution."""
        command = db.query(Command).filter(
            Command.id == command_id,
            Command.organization_id == admin.organization_id
        ).first()
        if not command:
            raise NotFoundException("Comando não encontrado nesta organização")

        if command.status != CommandStatusEnum.PENDING.value:
            raise BadRequestException(f"Comando já concluído com estado {command.status}")

        new_status = CommandStatusEnum.SUCCEEDED_SIMULATED.value if succeeded else CommandStatusEnum.FAILED_SIMULATED.value
        msg = result_message or ("Ação simulada com sucesso no ambiente virtual Ublock" if succeeded else "Falha simulada na execução do comando")

        command.status = new_status
        command.result_message = msg
        command.completed_at = datetime.now(timezone.utc)

        # In simulated demo mode, reflect logical effect on target account or device
        if succeeded:
            if command.action_type == ActionTypeEnum.SUSPEND_LOCAL_ACCOUNT.value and command.target_account_id:
                acc = db.query(DeviceAccount).filter(DeviceAccount.id == command.target_account_id).first()
                if acc:
                    acc.account_status = "SUSPENDED"
            elif command.action_type == ActionTypeEnum.REACTIVATE_LOCAL_ACCOUNT.value and command.target_account_id:
                acc = db.query(DeviceAccount).filter(DeviceAccount.id == command.target_account_id).first()
                if acc:
                    acc.account_status = "ACTIVE"

        db.commit()
        db.refresh(command)

        # Audit outcome
        AuditService.log_event(
            db=db,
            organization_id=admin.organization_id,
            action=f"SIMULATE_RESULT:{command.action_type}",
            outcome="SUCCESS" if succeeded else "FAILURE",
            actor_admin_id=admin.id,
            device_id=command.device_id,
            command_id=command.id,
            details={
                "command_id": str(command.id),
                "action_type": command.action_type,
                "status": new_status,
                "result_message": msg,
                "safe_guard_note": "Resultado registrado em modo de simulação; integridade operacional preservada.",
            }
        )

        return command
