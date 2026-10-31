import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LogOut, Moon, Sun, User as UserIcon, Building2 } from 'lucide-react';

interface NavbarProps {
  title: string;
}

export const Navbar: React.FC<NavbarProps> = ({ title }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Super Admin</span>;
      case 'TECHNICIAN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Técnico</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">Visualizador</span>;
    }
  };

  return (
    <header className="h-16 bg-[#0B1120] border-b border-[#24334C] px-8 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-semibold text-white tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Organization Name */}
        {user?.organization_name && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151F32] border border-[#24334C] text-xs text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-medium">{user.organization_name}</span>
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          className="p-2 rounded-lg bg-[#151F32] border border-[#24334C] text-slate-400 hover:text-white transition"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
        </button>

        {/* User Info */}
        <div className="flex items-center gap-3 pl-2 border-l border-[#24334C]">
          <div className="text-right hidden sm:block">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-xs font-medium text-white">{user?.full_name}</span>
              {getRoleBadge(user?.role)}
            </div>
            <span className="text-[11px] text-slate-400 block">{user?.email}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <UserIcon className="w-4 h-4" />
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sair do painel"
          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
