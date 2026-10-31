import React, { useState, useEffect } from 'react';
import { Device, DeviceAccount, TelemetryPoint, Command, ActionType, DeviceAgentStatus } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { OSBadge } from '../components/OSBadge';
import { EmergencyActionModal } from '../components/EmergencyActionModal';
import { EnrollAgentModal } from '../components/EnrollAgentModal';
import { 
  ArrowLeft, 
  Cpu, 
  HardDrive, 
  ShieldAlert, 
  User, 
  Users, 
  Clock, 
  Terminal, 
  CheckCircle2, 
  XCircle,
  Radio,
  Wifi,
  Server,
  KeyRound,
  ShieldBan,
  Activity,
  Layers,
  AlertTriangle
} from 'lucide-react';

interface DeviceDetailProps {
  device: Device;
  onBack: () => void;
}

export const DeviceDetail: React.FC<DeviceDetailProps> = ({ device: initialDevice, onBack }) => {
  const [device, setDevice] = useState<Device>(initialDevice);
  const [accounts, setAccounts] = useState<DeviceAccount[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [agentStatus, setAgentStatus] = useState<DeviceAgentStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'agent' | 'accounts' | 'telemetry' | 'commands'>('agent');
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const reloadData = async () => {
    try {
      const [devData, accData, telemData, cmdData, agtData] = await Promise.all([
        api.getDevice(device.id),
        api.getDeviceAccounts(device.id),
        api.getDeviceTelemetry(device.id),
        api.getCommands({ device_id: device.id }),
        api.getDeviceAgentStatus(device.id).catch(() => null),
      ]);
      setDevice(devData);
      setAccounts(accData);
      setTelemetry(telemData);
      setCommands(cmdData.items);
      setAgentStatus(agtData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    reloadData();
  }, [device.id]);

  const handleEmergencySubmit = async (data: {
    action_type: ActionType;
    target_account_id?: string;
    reason: string;
  }) => {
    await api.createSimulatedCommand(device.id, data);
    alert(`Ação de bloqueio '${data.action_type}' registrada em modo SIMULADO com auditoria.`);
    reloadData();
  };

  const handleSimulateResult = async (commandId: string, succeeded: boolean) => {
    try {
      await api.simulateCommandResult(commandId, { succeeded });
      reloadData();
    } catch (err: any) {
      alert(err.message || 'Falha ao simular resultado.');
    }
  };

  const handleRevokeAgent = async () => {
    if (!window.confirm(`Deseja realmente revogar o agente do computador '${device.display_name}'? Novas comunicações serão rejeitadas pelo servidor.`)) {
      return;
    }
    setRevoking(true);
    try {
      const res = await api.revokeDeviceAgent(device.id);
      alert(res.message);
      reloadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao revogar agente.');
    } finally {
      setRevoking(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const formatUptime = (seconds?: number | null) => {
    if (!seconds) return 'Indisponível';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const latest = telemetry[0] || null;
  const hw = agentStatus?.hardware_info;

  const renderAgentBadge = () => {
    const state = agentStatus?.agent_state || 'NO_AGENT';
    switch (state) {
      case 'REGISTERED_ONLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            Agente Online (Real)
          </span>
        );
      case 'REGISTERED_OFFLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
            <Radio className="w-3.5 h-3.5 text-slate-400" />
            Agente Offline
          </span>
        );
      case 'PENDING_ENROLLMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Aguardando Pareamento
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <ShieldBan className="w-3.5 h-3.5 text-rose-400" />
            Agente Revogado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Server className="w-3.5 h-3.5 text-blue-400" />
            Sem Agente Instalado
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-[#151F32] border border-[#24334C] text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-tight">{device.display_name}</h2>
              <StatusBadge status={device.status} />
              {renderAgentBadge()}
              {device.is_demo && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  DADOS SIMULADOS (DEMO)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Hostname: {device.hostname} &bull; Patrimônio: {device.asset_tag || 'N/A'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {(!agentStatus?.has_agent || agentStatus.agent_state === 'REVOKED') ? (
            <button
              onClick={() => setIsEnrollOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-600/25 transition"
            >
              <KeyRound className="w-4 h-4" />
              Instalar / Parear Agente
            </button>
          ) : (
            <button
              onClick={handleRevokeAgent}
              disabled={revoking}
              className="px-3.5 py-2 rounded-lg bg-[#0B1120] border border-rose-500/40 hover:bg-rose-500/10 text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <ShieldBan className="w-4 h-4" />
              {revoking ? 'Revogando...' : 'Revogar Agente'}
            </button>
          )}

          <button
            onClick={() => setIsEmergencyOpen(true)}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/25 transition"
          >
            <ShieldAlert className="w-4 h-4" />
            Virar a Chave (Ação de Emergência)
          </button>
        </div>
      </div>

      {/* Hardware & System Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-5 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Hardware & Sistema
          </span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Sistema Operacional:</span>
              <OSBadge osFamily={device.os_family} osVersion={device.os_version} />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fabricante / Modelo:</span>
              <span className="text-white font-medium">{device.manufacturer || 'Dell Inc.'} {device.model || ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Número de Série:</span>
              <span className="font-mono text-slate-300">{device.serial_number || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">IP Local:</span>
              <span className="font-mono text-slate-300">{device.local_ip || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-5 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Responsável & Setor
          </span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Colaborador:</span>
              <div className="flex items-center gap-1.5 text-white font-medium">
                <User className="w-3.5 h-3.5 text-blue-400" />
                {device.assigned_employee_name || 'Não atribuído'}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Departamento:</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                {device.department_name || 'Não atribuído'}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Último Contato:</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString('pt-BR') : 'Nunca conectado'}
              </div>
            </div>
          </div>
        </div>

        {/* Telemetry Snapshot */}
        <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Saúde do Ativo
            </span>
            <span className={`text-[10px] font-mono ${agentStatus?.has_agent ? 'text-emerald-400' : 'text-blue-400'}`}>
              {agentStatus?.has_agent ? 'TELEMETRIA REAL' : 'SIMULADO'}
            </span>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-blue-400" /> CPU
                </span>
                <span className="font-semibold text-white">
                  {hw?.cpu?.usage_percent !== undefined ? `${hw.cpu.usage_percent.toFixed(0)}%` : `${latest?.cpu_percent || 0}%`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#0B1120] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${hw?.cpu?.usage_percent !== undefined ? hw.cpu.usage_percent : (latest?.cpu_percent || 0)}%`
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-amber-400" /> Memória RAM
                </span>
                <span className="font-semibold text-white">
                  {hw?.memory?.usage_percent !== undefined ? `${hw.memory.usage_percent.toFixed(0)}%` : `${latest?.memory_percent || 0}%`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#0B1120] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${hw?.memory?.usage_percent !== undefined ? hw.memory.usage_percent : (latest?.memory_percent || 0)}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-[#24334C] flex gap-6 text-sm">
        <button
          onClick={() => setActiveTab('agent')}
          className={`pb-3 font-medium transition flex items-center gap-2 ${
            activeTab === 'agent'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          Agente & Hardware Real
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`pb-3 font-medium transition ${
            activeTab === 'accounts'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Contas Locais Detectadas ({accounts.length})
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`pb-3 font-medium transition ${
            activeTab === 'telemetry'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Telemetria & Histórico ({telemetry.length})
        </button>
        <button
          onClick={() => setActiveTab('commands')}
          className={`pb-3 font-medium transition ${
            activeTab === 'commands'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Ordens & Fila de Bloqueio ({commands.length})
        </button>
      </div>

      {/* Tab 0: Agent & Hardware Real Details */}
      {activeTab === 'agent' && (
        <div className="space-y-6">
          {agentStatus?.last_error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <p className="font-semibold text-rose-300">Alerta reportado pelo Agente:</p>
                <p className="text-rose-400/90 font-mono mt-0.5">{agentStatus.last_error}</p>
              </div>
            </div>
          )}

          {!agentStatus?.has_agent ? (
            <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                <Server className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-base font-bold text-white">Nenhum Agente Real Vinculado</h4>
                <p className="text-xs text-slate-400">
                  Instale o executável <code className="text-blue-400 font-mono">nexus-agent.exe</code> como serviço do Windows para obter telemetria contínua, especificações técnicas reais e monitoramento outbound seguro.
                </p>
              </div>
              <button
                onClick={() => setIsEnrollOpen(true)}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-lg shadow-blue-600/25 transition"
              >
                <KeyRound className="w-4 h-4" />
                Gerar Código e Instruções de Instalação
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Agent Connection Metadata */}
              <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Estado do Agente Windows
                  </span>
                  <span className="text-xs font-mono text-emerald-400">v{agentStatus.agent_version || '1.0.0'}</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">UUID do Agente:</span>
                    <span className="font-mono text-slate-300">{agentStatus.agent_uuid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Primeiro Registro:</span>
                    <span className="text-slate-300">
                      {agentStatus.registered_at ? new Date(agentStatus.registered_at).toLocaleString('pt-BR') : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Último Heartbeat:</span>
                    <span className="text-emerald-400 font-medium">
                      {agentStatus.last_heartbeat_at ? new Date(agentStatus.last_heartbeat_at).toLocaleString('pt-BR') : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Última Coleta Completa:</span>
                    <span className="text-slate-300">
                      {agentStatus.last_inventory_at ? new Date(agentStatus.last_inventory_at).toLocaleString('pt-BR') : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tempo de Atividade (Uptime):</span>
                    <span className="font-semibold text-white">{formatUptime(agentStatus.uptime_seconds)}</span>
                  </div>
                </div>
              </div>

              {/* Real Processor & Memory */}
              <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-5 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Processador & Memória RAM
                </span>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400">Modelo do Processador:</span>
                    <p className="font-semibold text-white mt-0.5">{hw?.cpu?.model || 'Não informado pelo agente'}</p>
                    <p className="text-[11px] text-slate-400">Núcleos de processamento: {hw?.cpu?.cores || 'N/A'}</p>
                  </div>

                  <div className="pt-2 border-t border-[#24334C]">
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400">Memória Física Total:</span>
                      <span className="font-semibold text-white">{formatBytes(hw?.memory?.total_bytes)}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400">Memória Livre / Disponível:</span>
                      <span className="text-emerald-400 font-medium">{formatBytes(hw?.memory?.available_bytes)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Storage Units */}
              <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-5 space-y-3 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-amber-400" />
                    Unidades de Armazenamento Detectadas
                  </span>
                  <span className="text-xs text-slate-400">{hw?.storage?.length || 0} unidade(s)</span>
                </div>

                {(!hw?.storage || hw.storage.length === 0) ? (
                  <p className="text-xs text-slate-400">Nenhuma unidade de disco reportada pelo agente até o momento.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {hw.storage.map((disk, idx) => {
                      const usedBytes = disk.total_bytes - disk.free_bytes;
                      const percent = disk.total_bytes > 0 ? (usedBytes / disk.total_bytes) * 100 : 0;
                      return (
                        <div key={idx} className="p-3 rounded-lg bg-[#0B1120] border border-[#24334C] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-white text-xs">{disk.drive}</span>
                            <span className="text-[10px] uppercase font-semibold text-slate-400 font-mono">{disk.fs_type || 'NTFS'}</span>
                          </div>
                          <div className="w-full h-2 bg-[#151F32] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${percent > 85 ? 'bg-rose-500' : percent > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Livre: {formatBytes(disk.free_bytes)}</span>
                            <span>Total: {formatBytes(disk.total_bytes)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Network Interfaces */}
              <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-5 space-y-3 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-blue-400" />
                    Interfaces de Rede & Endereços MAC
                  </span>
                  <span className="text-xs text-slate-400">{hw?.network?.length || 0} interface(s)</span>
                </div>

                {(!hw?.network || hw.network.length === 0) ? (
                  <p className="text-xs text-slate-400">Nenhuma interface de rede reportada pelo agente.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0B1120] text-slate-400 uppercase font-semibold">
                        <tr>
                          <th className="px-4 py-2.5 rounded-l-lg">Nome da Interface</th>
                          <th className="px-4 py-2.5">Endereço IPv4 / IPv6</th>
                          <th className="px-4 py-2.5 rounded-r-lg">Endereço MAC Físico</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#24334C] text-slate-300">
                        {hw.network.map((net, idx) => (
                          <tr key={idx} className="hover:bg-[#1a263e]">
                            <td className="px-4 py-2.5 font-medium text-white">{net.interface_name}</td>
                            <td className="px-4 py-2.5 font-mono text-blue-400">{net.ip_address || '-'}</td>
                            <td className="px-4 py-2.5 font-mono text-slate-400">{net.mac_address || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Local Accounts */}
      {activeTab === 'accounts' && (
        <div className="bg-[#151F32] border border-[#24334C] rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B1120] text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">Usuário Local</th>
                <th className="px-4 py-3">Tipo de Conta</th>
                <th className="px-4 py-3">Status da Conta</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-5 py-3 text-right">Ação Rápida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24334C] text-slate-300">
              {accounts.map(acc => (
                <tr key={acc.id} className="hover:bg-[#1a263e]">
                  <td className="px-5 py-3.5 font-mono font-semibold text-white">{acc.username}</td>
                  <td className="px-4 py-3.5">{acc.account_kind}</td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      acc.account_status === 'ACTIVE' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {acc.account_status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {acc.is_demo && (
                      <span className="text-[10px] text-blue-400 font-medium">DEMO VIRTUAL</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setIsEmergencyOpen(true)}
                      className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      {acc.account_status === 'ACTIVE' ? 'Suspender (Sim)' : 'Reativar (Sim)'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Telemetry History */}
      {activeTab === 'telemetry' && (
        <div className="bg-[#151F32] border border-[#24334C] rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B1120] text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">Data / Hora Coleta</th>
                <th className="px-4 py-3">Uso de CPU</th>
                <th className="px-4 py-3">Uso de Memória RAM</th>
                <th className="px-4 py-3">Espaço em Disco</th>
                <th className="px-5 py-3">Modo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24334C] text-slate-300">
              {telemetry.map(t => (
                <tr key={t.id} className="hover:bg-[#1a263e]">
                  <td className="px-5 py-3.5 font-mono text-slate-400">
                    {new Date(t.recorded_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-white">{t.cpu_percent}%</td>
                  <td className="px-4 py-3.5 font-semibold text-white">{t.memory_percent}%</td>
                  <td className="px-4 py-3.5 text-slate-300">
                    {t.disk_free_gb} GB livres de {t.disk_total_gb} GB
                  </td>
                  <td className="px-5 py-3.5 text-blue-400 font-semibold">
                    {t.is_demo ? 'SIMULADO' : 'REAL'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Commands & Execution Queue */}
      {activeTab === 'commands' && (
        <div className="bg-[#151F32] border border-[#24334C] rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B1120] text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">Tipo de Ação</th>
                <th className="px-4 py-3">Modo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Solicitante</th>
                <th className="px-4 py-3">Resultado / Justificativa</th>
                <th className="px-5 py-3 text-right">Simular Conclusão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24334C] text-slate-300">
              {commands.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Nenhum comando acionado para este computador.
                  </td>
                </tr>
              ) : (
                commands.map(cmd => (
                  <tr key={cmd.id} className="hover:bg-[#1a263e]">
                    <td className="px-5 py-3.5 font-semibold text-white">{cmd.action_type}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {cmd.mode}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        cmd.status === 'SUCCEEDED_SIMULATED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        cmd.status === 'FAILED_SIMULATED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                      }`}>
                        {cmd.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">{cmd.requester_name || 'Admin'}</td>
                    <td className="px-4 py-3.5 max-w-xs text-slate-400 truncate">
                      {cmd.result_message || cmd.reason || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {cmd.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSimulateResult(cmd.id, true)}
                            title="Simular Sucesso"
                            className="p-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSimulateResult(cmd.id, false)}
                            title="Simular Falha"
                            className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">Concluído</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Emergency Modal */}
      <EmergencyActionModal
        isOpen={isEmergencyOpen}
        onClose={() => setIsEmergencyOpen(false)}
        device={device}
        accounts={accounts}
        onSubmit={handleEmergencySubmit}
      />

      {/* Agent Enrollment Modal */}
      <EnrollAgentModal
        isOpen={isEnrollOpen}
        onClose={() => setIsEnrollOpen(false)}
        device={device}
        onEnrolled={reloadData}
      />
    </div>
  );
};
