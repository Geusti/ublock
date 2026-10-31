import React from 'react';
import { OSFamily } from '../types';
import { Monitor, Terminal, Apple, HelpCircle } from 'lucide-react';

interface OSBadgeProps {
  osFamily: OSFamily | string;
  osVersion?: string | null;
}

export const OSBadge: React.FC<OSBadgeProps> = ({ osFamily, osVersion }) => {
  const normalized = osFamily.toUpperCase();

  const getIcon = () => {
    switch (normalized) {
      case 'WINDOWS':
        return <Monitor className="w-3.5 h-3.5 text-blue-400" />;
      case 'LINUX':
        return <Terminal className="w-3.5 h-3.5 text-amber-400" />;
      case 'MACOS':
        return <Apple className="w-3.5 h-3.5 text-slate-200" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-slate-300">
      {getIcon()}
      <span>{osVersion || normalized}</span>
    </div>
  );
};
