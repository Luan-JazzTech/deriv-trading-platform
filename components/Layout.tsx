import React from 'react';
import { LayoutDashboard, Settings, ScrollText, LogOut, TrendingUp } from 'lucide-react';
import { Button } from './ui/Button';

interface LayoutProps {
  children?: React.ReactNode;
  activeView: string;
  onChangeView: (view: string) => void;
  onLogout: () => void;
}

export function Layout({ children, activeView, onChangeView, onLogout }: LayoutProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'logs', label: 'Logs & Auditoria', icon: ScrollText },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-10">
        <div className="p-6 border-b border-slate-800 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-green-400" />
          <h1 className="font-bold text-xl tracking-tight">Deriv<span className="text-green-400">Pro</span></h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeView === item.id 
                  ? 'bg-slate-800 text-white' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-400 hover:bg-slate-800 hover:text-red-300"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}