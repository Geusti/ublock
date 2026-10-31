import {
  User,
  Device,
  Employee,
  Department,
  Command,
  AuditLog,
  DashboardSummary,
  PaginatedResponse,
  ActionType,
  DeviceAccount,
  TelemetryPoint,
  DeviceAgentStatus,
  EnrollmentTokenResponse
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api/v1`;

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('ublock_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      localStorage.removeItem('ublock_token');
      localStorage.removeItem('ublock_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.detail || 'Ocorreu um erro na requisição.';
      throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }

    return data as T;
  }

  // Auth
  async login(email: string, password: string): Promise<{ access_token: string }> {
    return this.request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('ublock_token');
      localStorage.removeItem('ublock_user');
    }
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // Dashboard
  async getDashboardSummary(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>('/dashboard/summary');
  }

  // Devices
  async getDevices(params: {
    search?: string;
    os_family?: string;
    status?: string;
    department_id?: string;
    employee_id?: string;
    sort_by?: string;
    sort_dir?: string;
    page?: number;
    page_size?: number;
  } = {}): Promise<PaginatedResponse<Device>> {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.os_family) query.append('os_family', params.os_family);
    if (params.status) query.append('status', params.status);
    if (params.department_id) query.append('department_id', params.department_id);
    if (params.employee_id) query.append('employee_id', params.employee_id);
    if (params.sort_by) query.append('sort_by', params.sort_by);
    if (params.sort_dir) query.append('sort_dir', params.sort_dir);
    if (params.page) query.append('page', params.page.toString());
    if (params.page_size) query.append('page_size', params.page_size.toString());

    return this.request<PaginatedResponse<Device>>(`/devices?${query.toString()}`);
  }

  async getDevice(id: string): Promise<Device> {
    return this.request<Device>(`/devices/${id}`);
  }

  async createDevice(payload: Partial<Device>): Promise<Device> {
    return this.request<Device>('/devices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateDevice(id: string, payload: Partial<Device>): Promise<Device> {
    return this.request<Device>(`/devices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async retireDevice(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/devices/${id}`, {
      method: 'DELETE',
    });
  }

  async getDeviceAccounts(deviceId: string): Promise<DeviceAccount[]> {
    return this.request<DeviceAccount[]>(`/devices/${deviceId}/accounts`);
  }

  async getDeviceTelemetry(deviceId: string): Promise<TelemetryPoint[]> {
    return this.request<TelemetryPoint[]>(`/devices/${deviceId}/telemetry`);
  }

  // Real Windows Agent (Phase 3)
  async getDeviceAgentStatus(deviceId: string): Promise<DeviceAgentStatus> {
    return this.request<DeviceAgentStatus>(`/devices/${deviceId}/agent`);
  }

  async generateEnrollmentToken(deviceId: string, expiresInHours: number = 24): Promise<EnrollmentTokenResponse> {
    return this.request<EnrollmentTokenResponse>(`/devices/${deviceId}/enrollment-token`, {
      method: 'POST',
      body: JSON.stringify({ expires_in_hours: expiresInHours }),
    });
  }

  async generateBulkEnrollmentToken(expiresInHours: number = 168): Promise<EnrollmentTokenResponse> {
    return this.request<EnrollmentTokenResponse>('/devices/bulk-enrollment-token', {
      method: 'POST',
      body: JSON.stringify({ expires_in_hours: expiresInHours }),
    });
  }

  async revokeDeviceAgent(deviceId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/devices/${deviceId}/agent/revoke`, {
      method: 'POST',
    });
  }

  // Employees
  async getEmployees(params: {
    search?: string;
    department_id?: string;
    status?: string;
    page?: number;
    page_size?: number;
  } = {}): Promise<PaginatedResponse<Employee>> {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.department_id) query.append('department_id', params.department_id);
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', params.page.toString());
    if (params.page_size) query.append('page_size', params.page_size.toString());

    return this.request<PaginatedResponse<Employee>>(`/employees?${query.toString()}`);
  }

  async getEmployee(id: string): Promise<Employee> {
    return this.request<Employee>(`/employees/${id}`);
  }

  async createEmployee(payload: Partial<Employee>): Promise<Employee> {
    return this.request<Employee>('/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateEmployee(id: string, payload: Partial<Employee>): Promise<Employee> {
    return this.request<Employee>(`/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deactivateEmployee(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/employees/${id}`, {
      method: 'DELETE',
    });
  }

  // Departments
  async getDepartments(): Promise<Department[]> {
    return this.request<Department[]>('/departments');
  }

  async createDepartment(payload: { name: string; is_active?: boolean }): Promise<Department> {
    return this.request<Department>('/departments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateDepartment(id: string, payload: Partial<Department>): Promise<Department> {
    return this.request<Department>(`/departments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteDepartment(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/departments/${id}`, {
      method: 'DELETE',
    });
  }

  // Commands (Simulated in Phase 1)
  async getCommands(params: {
    status?: string;
    device_id?: string;
    page?: number;
    page_size?: number;
  } = {}): Promise<PaginatedResponse<Command>> {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.device_id) query.append('device_id', params.device_id);
    if (params.page) query.append('page', params.page.toString());
    if (params.page_size) query.append('page_size', params.page_size.toString());

    return this.request<PaginatedResponse<Command>>(`/commands?${query.toString()}`);
  }

  async createSimulatedCommand(deviceId: string, payload: {
    action_type: ActionType;
    target_account_id?: string;
    reason?: string;
  }): Promise<Command> {
    return this.request<Command>(`/devices/${deviceId}/commands`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async simulateCommandResult(commandId: string, payload: {
    succeeded: boolean;
    result_message?: string;
  }): Promise<Command> {
    return this.request<Command>(`/commands/${commandId}/simulate-result`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Audit
  async getAuditLogs(params: {
    actor_id?: string;
    device_id?: string;
    action_type?: string;
    page?: number;
    page_size?: number;
  } = {}): Promise<PaginatedResponse<AuditLog>> {
    const query = new URLSearchParams();
    if (params.actor_id) query.append('actor_id', params.actor_id);
    if (params.device_id) query.append('device_id', params.device_id);
    if (params.action_type) query.append('action_type', params.action_type);
    if (params.page) query.append('page', params.page.toString());
    if (params.page_size) query.append('page_size', params.page_size.toString());

    return this.request<PaginatedResponse<AuditLog>>(`/audit-logs?${query.toString()}`);
  }
}

export const api = new ApiClient();
