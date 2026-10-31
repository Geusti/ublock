export type Role = 'SUPER_ADMIN' | 'TECHNICIAN' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
}

export type OSFamily = 'WINDOWS' | 'LINUX' | 'MACOS' | 'OTHER';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'ALERT' | 'UNKNOWN' | 'RETIRED';

export interface DeviceAccount {
  id: string;
  device_id: string;
  username: string;
  account_kind: string;
  account_status: string;
  is_demo: boolean;
  observed_at: string | null;
}

export interface TelemetryPoint {
  id: string;
  device_id: string;
  cpu_percent: number | null;
  memory_percent: number | null;
  disk_total_gb: number | null;
  disk_free_gb: number | null;
  is_demo: boolean;
  recorded_at: string;
}

export interface Device {
  id: string;
  organization_id: string;
  hostname: string;
  display_name: string;
  os_family: OSFamily;
  os_version: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  assigned_employee_id: string | null;
  assigned_employee_name: string | null;
  department_id: string | null;
  department_name: string | null;
  local_ip: string | null;
  status: DeviceStatus;
  last_seen_at: string | null;
  agent_version: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  accounts?: DeviceAccount[];
  latest_telemetry?: TelemetryPoint | null;
}

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  employee_count: number;
  device_count: number;
}

export interface AssignedDeviceSummary {
  id: string;
  hostname: string;
  display_name: string;
  os_family: string;
  asset_tag: string | null;
  status: string;
  last_seen_at: string | null;
}

export interface Employee {
  id: string;
  organization_id: string;
  department_id: string | null;
  department_name: string | null;
  full_name: string;
  corporate_email: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  notes: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  device_count: number;
  assigned_devices?: AssignedDeviceSummary[];
}

export type ActionType = 
  | 'SUSPEND_LOCAL_ACCOUNT'
  | 'REACTIVATE_LOCAL_ACCOUNT'
  | 'END_USER_SESSION'
  | 'ISOLATE_DEVICE_NETWORK'
  | 'EMERGENCY_LOCKDOWN';

export type CommandStatus = 'PENDING' | 'SUCCEEDED_SIMULATED' | 'FAILED_SIMULATED';

export interface Command {
  id: string;
  organization_id: string;
  device_id: string;
  device_name: string | null;
  target_account_id: string | null;
  target_username: string | null;
  action_type: ActionType;
  mode: string;
  status: CommandStatus;
  requested_by: string;
  requester_name: string | null;
  reason: string | null;
  result_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  actor_admin_id: string | null;
  actor_admin_name: string | null;
  device_id: string | null;
  device_name: string | null;
  command_id: string | null;
  action: string;
  outcome: string;
  details: Record<string, any>;
  created_at: string;
}

export interface AlertDeviceItem {
  id: string;
  hostname: string;
  display_name: string;
  os_family: string;
  asset_tag: string | null;
  assigned_employee_name: string | null;
  department_name: string | null;
  status: string;
  last_seen_at: string | null;
}

export interface StorageDriveItem {
  drive: string;
  total_bytes: number;
  free_bytes: number;
  fs_type?: string;
}

export interface NetworkInterfaceItem {
  interface_name: string;
  ip_address?: string;
  mac_address?: string;
}

export interface AgentHardwareInfo {
  cpu?: {
    model: string;
    cores?: number;
    usage_percent?: number;
  };
  memory?: {
    total_bytes: number;
    available_bytes: number;
    usage_percent?: number;
  };
  storage?: StorageDriveItem[];
  network?: NetworkInterfaceItem[];
  os_details?: {
    name: string;
    version?: string;
    build?: string;
    arch: string;
  };
}

export type AgentState = 
  | 'NO_AGENT'
  | 'PENDING_ENROLLMENT'
  | 'REGISTERED_ONLINE'
  | 'REGISTERED_OFFLINE'
  | 'REVOKED';

export interface DeviceAgentStatus {
  has_agent: boolean;
  agent_state: AgentState;
  agent_uuid?: string | null;
  agent_version?: string | null;
  status?: string | null;
  last_heartbeat_at?: string | null;
  last_inventory_at?: string | null;
  uptime_seconds?: number | null;
  last_error?: string | null;
  hardware_info?: AgentHardwareInfo | null;
  registered_at?: string | null;
  revoked_at?: string | null;
  active_enrollment_token?: string | null;
  token_expires_at?: string | null;
}

export interface EnrollmentTokenResponse {
  enrollment_token: string;
  expires_at: string;
  device_id: string;
  device_name: string;
  installation_command: string;
}

export interface DepartmentDistributionItem {
  department_id: string | null;
  department_name: string;
  count: number;
}

export interface DashboardSummary {
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  alert_devices: number;
  stale_devices: number;
  retired_devices: number;
  unknown_devices: number;
  pending_commands: number;
  total_employees: number;
  total_departments: number;
  os_distribution: { os_family: string; count: number }[];
  department_distribution: DepartmentDistributionItem[];
  recent_activity: {
    id: string;
    action: string;
    outcome: string;
    actor_name: string;
    device_name: string | null;
    created_at: string;
  }[];
  alert_devices_list: AlertDeviceItem[];
  is_simulation_mode: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
