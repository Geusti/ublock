import React, { useState, useEffect } from 'react';
import { Device, Department, Employee, DeviceAccount, ActionType } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { OSBadge } from '../components/OSBadge';
import { EmergencyActionModal } from '../components/EmergencyActionModal';
import { EnrollAgentModal } from '../components/EnrollAgentModal';
import { Modal } from '../components/Modal';
import { 
  Search, 
  Plus, 
  ShieldAlert, 
  Eye, 
  Edit,
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserCheck,
  UserX,
  Clock,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface DevicesProps {
  onSelectDevice: (device: Device) => void;
}

export const Devices: React.FC<DevicesProps> = ({ onSelectDevice }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isBulkEnrollOpen, setIsBulkEnrollOpen] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [osFilter, setOsFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Sorting
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [emergencyDevice, setEmergencyDevice] = useState<Device | null>(null);
  const [emergencyAccounts, setEmergencyAccounts] = useState<DeviceAccount[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [retiringDevice, setRetiringDevice] = useState<Device | null>(null);

  // Form State (Shared for Create & Edit)
  const [formHostname, setFormHostname] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formOS, setFormOS] = useState<'WINDOWS' | 'LINUX' | 'MACOS' | 'OTHER'>('WINDOWS');
  const [formOSVersion, setFormOSVersion] = useState('');
  const [formManufacturer, setFormManufacturer] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formSerialNumber, setFormSerialNumber] = useState('');
  const [formAssetTag, setFormAssetTag] = useState('');
  const [formAssignedEmployeeId, setFormAssignedEmployeeId] = useState('');
  const [formDepartmentId, setFormDepartmentId] = useState('');
  const [formLocalIp, setFormLocalIp] = useState('');
  const [formStatus, setFormStatus] = useState<string>('UNKNOWN');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await api.getDevices({
        search: search || undefined,
        os_family: osFilter || undefined,
        status: statusFilter || undefined,
        department_id: deptFilter || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        page_size: 15,
      });
      setDevices(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Erro ao carregar lista de computadores.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [page, osFilter, statusFilter, deptFilter, sortBy, sortDir]);

  useEffect(() => {
    // Load departments and employees for dropdowns
    api.getDepartments().then(setDepartments).catch(() => {});
    api.getEmployees({ page_size: 100 }).then(res => setEmployees(res.items)).catch(() => {});
  }, []);

  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(columnKey);
      setSortDir('asc');
    }
    setPage(1);
  };

  const renderSortIndicator = (columnKey: string) => {
    if (sortBy !== columnKey) {
      return <ArrowUpDown className="w-3 h-3 text-slate-500 inline ml-1 opacity-50" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-400 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-400 inline ml-1" />
    );
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDevices();
  };

  const openCreateModal = () => {
    setEditingDevice(null);
    setFormHostname('');
    setFormDisplayName('');
    setFormOS('WINDOWS');
    setFormOSVersion('');
    setFormManufacturer('');
    setFormModel('');
    setFormSerialNumber('');
    setFormAssetTag('');
    setFormAssignedEmployeeId('');
    setFormDepartmentId('');
    setFormLocalIp('');
    setFormStatus('UNKNOWN');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (dev: Device) => {
    setEditingDevice(dev);
    setFormHostname(dev.hostname);
    setFormDisplayName(dev.display_name);
    setFormOS(dev.os_family);
    setFormOSVersion(dev.os_version || '');
    setFormManufacturer(dev.manufacturer || '');
    setFormModel(dev.model || '');
    setFormSerialNumber(dev.serial_number || '');
    setFormAssetTag(dev.asset_tag || '');
    setFormAssignedEmployeeId(dev.assigned_employee_id || '');
    setFormDepartmentId(dev.department_id || '');
    setFormLocalIp(dev.local_ip || '');
    setFormStatus(dev.status);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      const payload: Partial<Device> = {
        hostname: formHostname.trim(),
        display_name: formDisplayName.trim(),
        os_family: formOS,
        os_version: formOSVersion.trim() || undefined,
        manufacturer: formManufacturer.trim() || undefined,
        model: formModel.trim() || undefined,
        serial_number: formSerialNumber.trim() || undefined,
        asset_tag: formAssetTag.trim() || undefined,
        assigned_employee_id: formAssignedEmployeeId || null,
        department_id: formDepartmentId || null,
        local_ip: formLocalIp.trim() || undefined,
        status: (formStatus as any) || 'UNKNOWN',
      };

      if (editingDevice) {
        await api.updateDevice(editingDevice.id, payload);
        setFeedback({ type: 'success', message: `Computador '${formDisplayName}' atualizado com sucesso!` });
      } else {
        await api.createDevice(payload);
        setFeedback({ type: 'success', message: `Computador '${formDisplayName}' cadastrado no inventário!` });
      }

      setIsCreateOpen(false);
      fetchDevices();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar computador.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const openEmergencyModal = async (device: Device) => {
    try {
      const accs = await api.getDeviceAccounts(device.id);
      setEmergencyAccounts(accs);
    } catch {
      setEmergencyAccounts([]);
    }
    setEmergencyDevice(device);
  };

  const handleEmergencySubmit = async (data: {
    action_type: ActionType;
    target_account_id?: string;
    reason: string;
  }) => {
    if (!emergencyDevice) return;
    await api.createSimulatedCommand(emergencyDevice.id, data);
    setFeedback({
      type: 'success',
      message: `Ação de contenção '${data.action_type}' registrada em modo SIMULADO com sucesso.`,
    });
    fetchDevices();
  };

  const confirmRetire = async () => {
    if (!retiringDevice) return;
    try {
      await api.retireDevice(retiringDevice.id);
      setFeedback({ type: 'success', message: `Ativo '${retiringDevice.display_name}' retirado de uso com sucesso.` });
      setRetiringDevice(null);
      fetchDevices();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao retirar ativo.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications / Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-xs animate-fadeIn ${
          feedback.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300' 
            : 'bg-rose-500/10 border border-rose-500/25 text-rose-300'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white font-bold ml-4">
            &times;
          </button>
        </div>
      )}

      {/* Header and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Inventário de Computadores</h2>
          <p className="text-xs text-slate-400">
            {total} equipamentos catalogados &bull; Governança de hardware, SO e colaboradores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkEnrollOpen(true)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition"
          >
            <Sparkles className="w-4 h-4" />
            Pareamento em Lote (Auto-Discovery)
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Novo Computador
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[280px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, hostname, patrimônio, nº de série ou responsável..."
            className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          {/* OS Filter */}
          <select
            value={osFilter}
            onChange={(e) => { setOsFilter(e.target.value); setPage(1); }}
            className="bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">Todos os Sistemas</option>
            <option value="WINDOWS">Windows</option>
            <option value="MACOS">macOS</option>
            <option value="LINUX">Linux</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">Todos os Status</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="ALERT">Alerta</option>
            <option value="UNKNOWN">Desconhecido</option>
            <option value="RETIRED">Retirado</option>
          </select>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            className="bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">Todos os Departamentos</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.device_count})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Comprehensive Inventory Table */}
      <div className="bg-[#151F32] border border-[#24334C] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B1120] border-b border-[#24334C] text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th 
                  onClick={() => handleSort('display_name')} 
                  className="px-4 py-3 cursor-pointer hover:text-white transition select-none"
                >
                  Nome / Hostname {renderSortIndicator('display_name')}
                </th>
                <th 
                  onClick={() => handleSort('asset_tag')} 
                  className="px-3 py-3 cursor-pointer hover:text-white transition select-none"
                >
                  Patrimônio {renderSortIndicator('asset_tag')}
                </th>
                <th className="px-3 py-3">Fabricante & Modelo</th>
                <th className="px-3 py-3">Sistema Operacional</th>
                <th className="px-3 py-3">IP / Serial</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-3 py-3">Departamento</th>
                <th 
                  onClick={() => handleSort('status')} 
                  className="px-3 py-3 cursor-pointer hover:text-white transition select-none"
                >
                  Status {renderSortIndicator('status')}
                </th>
                <th 
                  onClick={() => handleSort('last_seen_at')} 
                  className="px-3 py-3 cursor-pointer hover:text-white transition select-none"
                >
                  Última Comunicação {renderSortIndicator('last_seen_at')}
                </th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24334C] text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                      <span>Carregando inventário de computadores...</span>
                    </div>
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-slate-400">
                    Nenhum computador encontrado para os critérios pesquisados.
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id} className="hover:bg-[#1a263e] transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{device.display_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{device.hostname}</div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-200">
                      {device.asset_tag || '-'}
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      <div>{device.manufacturer || 'Dell Inc.'}</div>
                      <div className="text-[10px] text-slate-400">{device.model || '-'}</div>
                    </td>
                    <td className="px-3 py-3">
                      <OSBadge osFamily={device.os_family} osVersion={device.os_version} />
                    </td>
                    <td className="px-3 py-3 font-mono text-[10px] text-slate-400">
                      <div>IP: {device.local_ip || 'N/A'}</div>
                      <div>S/N: {device.serial_number || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {device.assigned_employee_name ? (
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="font-medium">{device.assigned_employee_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">Não vinculado</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-400">
                      {device.department_name || '-'}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={device.status} />
                    </td>
                    <td className="px-3 py-3 text-[11px] text-slate-400 font-mono">
                      {device.last_seen_at ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {new Date(device.last_seen_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Desconhecido</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Emergency Lockdown Action */}
                        <button
                          onClick={() => openEmergencyModal(device)}
                          title="Virar a Chave (Ação de Emergência Simulada)"
                          className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-semibold flex items-center gap-1 transition"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          <span>Bloquear</span>
                        </button>

                        {/* View Details */}
                        <button
                          onClick={() => onSelectDevice(device)}
                          title="Ver detalhes do ativo"
                          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Device */}
                        <button
                          onClick={() => openEditModal(device)}
                          title="Editar cadastro do ativo"
                          className="p-1.5 rounded text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* Soft Retire Device */}
                        {device.status !== 'RETIRED' && (
                          <button
                            onClick={() => setRetiringDevice(device)}
                            title="Retirar de uso"
                            className="p-1.5 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3 bg-[#0B1120] border-t border-[#24334C] flex items-center justify-between text-xs text-slate-400">
          <span>
            Página {page} de {totalPages} ({total} ativos no total)
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Create & Edit Modal */}
      <Modal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        title={editingDevice ? `Editar Computador: ${editingDevice.display_name}` : 'Cadastrar Novo Computador'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveDevice} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Hostname (Identificador de Rede) *
              </label>
              <input
                type="text"
                required
                value={formHostname}
                onChange={(e) => setFormHostname(e.target.value)}
                placeholder="Ex.: UB-FIN-03"
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Nome de Exibição / Finalidade *
              </label>
              <input
                type="text"
                required
                value={formDisplayName}
                onChange={(e) => setFormDisplayName(e.target.value)}
                placeholder="Ex.: Dell XPS 15 - Contabilidade"
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Sistema Operacional</label>
              <select
                value={formOS}
                onChange={(e: any) => setFormOS(e.target.value)}
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="WINDOWS">Windows</option>
                <option value="LINUX">Linux</option>
                <option value="MACOS">macOS</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Versão do SO</label>
              <input
                type="text"
                value={formOSVersion}
                onChange={(e) => setFormOSVersion(e.target.value)}
                placeholder="Ex.: Windows 11 Pro 23H2"
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Status Inicial</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="UNKNOWN">Desconhecido</option>
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline</option>
                <option value="ALERT">Alerta</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Fabricante</label>
              <input
                type="text"
                value={formManufacturer}
                onChange={(e) => setFormManufacturer(e.target.value)}
                placeholder="Ex.: Dell Inc., Lenovo, Apple"
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Modelo</label>
              <input
                type="text"
                value={formModel}
                onChange={(e) => setFormModel(e.target.value)}
                placeholder="Ex.: Latitude 5430"
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Etiqueta Patrimonial</label>
              <input
                type="text"
                value={formAssetTag}
                onChange={(e) => setFormAssetTag(e.target.value)}
                placeholder="Ex.: UB-PAT-00301"
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Número de Série</label>
              <input
                type="text"
                value={formSerialNumber}
                onChange={(e) => setFormSerialNumber(e.target.value)}
                placeholder="Ex.: BR-DL-994411"
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">IP Local</label>
              <input
                type="text"
                value={formLocalIp}
                onChange={(e) => setFormLocalIp(e.target.value)}
                placeholder="Ex.: 192.168.10.150"
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {/* Association of Employee and Department */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#24334C]">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Associar Colaborador Responsável
              </label>
              <select
                value={formAssignedEmployeeId}
                onChange={(e) => setFormAssignedEmployeeId(e.target.value)}
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">Nenhum colaborador vinculado</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.department_name || 'Sem setor'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Departamento Alocado
              </label>
              <select
                value={formDepartmentId}
                onChange={(e) => setFormDepartmentId(e.target.value)}
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">Nenhum departamento vinculado</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#24334C]">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {formSubmitting ? 'Gravando...' : (editingDevice ? 'Salvar Alterações' : 'Cadastrar Ativo')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Destructive Action Confirmation Modal */}
      {retiringDevice && (
        <Modal 
          isOpen={!!retiringDevice} 
          onClose={() => setRetiringDevice(null)} 
          title="Confirmar Retirada de Ativo"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">Operação de Desativação Lógica</p>
                <p className="mt-1 leading-relaxed">
                  O computador <strong>{retiringDevice.display_name} ({retiringDevice.hostname})</strong> será marcado com o status <strong>RETIRADO</strong>.
                  O histórico de telemetria e a trilha de auditoria serão preservados integralmente.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#24334C]">
              <button
                type="button"
                onClick={() => setRetiringDevice(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRetire}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium"
              >
                Confirmar Retirada
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Emergency Action Modal */}
      {emergencyDevice && (
        <EmergencyActionModal
          isOpen={!!emergencyDevice}
          onClose={() => setEmergencyDevice(null)}
          device={emergencyDevice}
          accounts={emergencyAccounts}
          onSubmit={handleEmergencySubmit}
        />
      )}

      {/* Bulk Auto-Discovery Enrollment Modal */}
      <EnrollAgentModal
        isOpen={isBulkEnrollOpen}
        onClose={() => setIsBulkEnrollOpen(false)}
        isBulk={true}
        onEnrolled={fetchDevices}
      />
    </div>
  );
};
