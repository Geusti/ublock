import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class StatusCount(BaseModel):
    status: str
    count: int


class OSCount(BaseModel):
    os_family: str
    count: int


class DepartmentCount(BaseModel):
    department_id: Optional[uuid.UUID] = None
    department_name: str
    count: int


class AlertDeviceItem(BaseModel):
    id: uuid.UUID
    hostname: str
    display_name: str
    os_family: str
    asset_tag: Optional[str] = None
    assigned_employee_name: Optional[str] = None
    department_name: Optional[str] = None
    status: str
    last_seen_at: Optional[datetime] = None


class DashboardSummaryOut(BaseModel):
    total_devices: int
    online_devices: int
    offline_devices: int
    alert_devices: int
    stale_devices: int
    retired_devices: int
    unknown_devices: int
    pending_commands: int
    total_employees: int
    total_departments: int
    os_distribution: List[OSCount]
    department_distribution: List[DepartmentCount]
    recent_activity: List[Dict[str, Any]]
    alert_devices_list: List[AlertDeviceItem]
    is_simulation_mode: bool = True
