import React from 'react';
import { 
  LayoutDashboard, 
  Laptop, 
  Users, 
  Building2,
  ShieldCheck, 
  ScrollText, 
  Lock
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'devices', label: 'Inventário de Ativos', icon: <Laptop className="w-5 h-5" /> },
    { id: 'employees', label: 'Colaboradores', icon: <Users className="w-5 h-5" /> },
    { id: 'departments', label: 'Departamentos', icon: <Building2 className="w-5 h-5" /> },
    { id: 'commands', label: 'Controle de Acesso (SIM)', icon: <Lock className="w-5 h-5" /> },
    { id: 'audit', label: 'Trilha de Auditoria', icon: <ScrollText className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-64 bg-[#0B1120] border-r border-[#24334C] flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand / Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-[#24334C]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white block leading-tight">NEXUS ASSETS</span>
            <span className="block text-[10px] font-medium uppercase tracking-wider text-blue-400">
              Ublock &bull; TI & RMM
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          {menuItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#151F32]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Safety Notice Footer */}
      <div className="p-4 m-3 rounded-xl bg-[#151F32] border border-[#24334C] text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Fase 2: Painel & Inventário</span>
        </div>
        <p className="text-slate-400 leading-tight">
          Ações de contenção operam em simulação com auditoria persistida.
        </p>
      </div>
    </aside>
  );
};
