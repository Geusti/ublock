import React, { useEffect, useState } from 'react';
import { DashboardSummary, AlertDeviceItem, Device } from '../types';
import { api } from '../services/api';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { OSBadge } from '../components/OSBadge';
import { 
  Laptop, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Clock, 
  Building2, 
  ShieldCheck, 
  ArrowUpRight,
  User,
  ShieldAlert
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string, device?: Device) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const summary = await api.getDashboardSummary();
        setData(summary);
      } catch (err: any) {
        setError(err.message || 'Falha ao carregar indicadores.');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  const handleOpenAlertDevice = async (alertItem: AlertDeviceItem) => {
    try {
      const dev = await api.getDevice(alertItem.id);
      onNavigate('devices', dev);
    } catch {
      onNavigate('devices');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3" />
        Carregando métricas do NEXUS IT Asset Manager...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
        {error || 'Não foi possível obter dados do dashboard.'}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Simulation Banner Notice */}
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-blue-400 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-white">NEXUS IT Asset Manager &bull; Painel Operacional</h4>
            <p className="text-xs text-slate-300">
              Inventário e monitoramento de equipamentos da Ubook. Indicadores calculados a partir da base do sistema.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('devices')}
          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition"
        >
          Ver Inventário
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Total de Equipamentos"
          value={data.total_devices}
          subtitle="Ativos sob gestão"
          icon={<Laptop className="w-5 h-5" />}
          accentColor="blue"
        />
        <MetricCard
          title="Computadores Online"
          value={data.online_devices}
          subtitle="Últimos 15 minutos"
          icon={<Wifi className="w-5 h-5" />}
          accentColor="emerald"
        />
        <MetricCard
          title="Computadores Offline"
          value={data.offline_devices}
          subtitle="Sem sinal recente"
          icon={<WifiOff className="w-5 h-5" />}
          accentColor="slate"
        />
        <MetricCard
          title="Precisam de Atenção"
          value={data.alert_devices}
          subtitle="Alertas de integridade"
          icon={<AlertTriangle className="w-5 h-5" />}
          accentColor="rose"
        />
        <MetricCard
          title="Sem Comunicação"
          value={data.stale_devices}
          subtitle="Mais de 7 dias offline"
          icon={<Clock className="w-5 h-5" />}
          accentColor="amber"
        />
        <MetricCard
          title="Departamentos"
          value={data.total_departments}
          subtitle={`${data.total_employees} colaboradores`}
          icon={<Building2 className="w-5 h-5" />}
          accentColor="blue"
        />
      </div>

      {/* Distribution Section: Operating Systems & Departments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OS Breakdown */}
        <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Distribuição por Sistema Operacional</h3>
            <span className="text-xs text-slate-400">{data.total_devices} computadores</span>
          </div>
          <div className="space-y-3.5">
            {data.os_distribution.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum computador registrado.</p>
            ) : (
              data.os_distribution.map((item) => {
                const pct = data.total_devices > 0 ? Math.round((item.count / data.total_devices) * 100) : 0;
                return (
                  <div key={item.os_family} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{item.os_family}</span>
                      <span className="text-slate-400">{item.count} máquinas ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-[#0B1120] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.os_family === 'WINDOWS' ? 'bg-blue-500' :
                          item.os_family === 'MACOS' ? 'bg-slate-300' :
                          item.os_family === 'LINUX' ? 'bg-amber-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Distribuição por Departamento</h3>
            <button
              onClick={() => onNavigate('departments')}
              className="text-xs text-blue-400 hover:text-blue-300 transition"
            >
              Ver setores
            </button>
          </div>
          <div className="space-y-3.5">
            {data.department_distribution.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum departamento cadastrado.</p>
            ) : (
              data.department_distribution.map((item) => {
                const pct = data.total_devices > 0 ? Math.round((item.count / data.total_devices) * 100) : 0;
                return (
                  <div key={item.department_name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{item.department_name}</span>
                      <span className="text-slate-400">{item.count} ativos ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-[#0B1120] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Critical Section: Alert Devices Table & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table of Alert Devices (2 cols) */}
        <div className="lg:col-span-2 bg-[#151F32] border border-[#24334C] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-semibold text-white">Equipamentos que Precisam de Atenção</h3>
            </div>
            <span className="text-xs text-rose-400 font-medium">
              {data.alert_devices_list.length} com alerta
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B1120] border-b border-[#24334C] text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Equipamento</th>
                  <th className="px-3 py-2.5">Patrimônio</th>
                  <th className="px-3 py-2.5">Sistema</th>
                  <th className="px-3 py-2.5">Responsável / Setor</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24334C] text-slate-300">
                {data.alert_devices_list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      Nenhum equipamento em estado de alerta no momento. Todos os computadores operando normalmente.
                    </td>
                  </tr>
                ) : (
                  data.alert_devices_list.map((item) => (
                    <tr key={item.id} className="hover:bg-[#1a263e] transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{item.display_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{item.hostname}</div>
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-300">
                        {item.asset_tag || '-'}
                      </td>
                      <td className="px-3 py-3">
                        <OSBadge osFamily={item.os_family} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-slate-200">{item.assigned_employee_name || 'Não atribuído'}</div>
                        <div className="text-[10px] text-slate-400">{item.department_name || '-'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenAlertDevice(item)}
                          className="px-2.5 py-1 rounded bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 text-[11px] font-medium transition"
                        >
                          Ver Ativo
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Admin Activity */}
        <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Atividades Administrativas</h3>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs text-blue-400 hover:text-blue-300 transition"
            >
              Ver todas
            </button>
          </div>
          <div className="space-y-3">
            {data.recent_activity.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhuma atividade registrada.</p>
            ) : (
              data.recent_activity.map((act) => (
                <div key={act.id} className="text-xs p-3 rounded-lg bg-[#0B1120] border border-[#24334C] space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-200">{act.action}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(act.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-slate-400 flex justify-between text-[11px]">
                    <span>Por: <strong className="text-slate-300">{act.actor_name}</strong></span>
                    {act.device_name && <span>Ativo: <strong className="text-slate-300">{act.device_name}</strong></span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
