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
    <div className="min-h-screen bg-slate-950 text-slate-50 flex font-sans selection:bg-green-500/30">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col fixed h-full z-10">
        <div className="p-6 border-b border-slate-800 flex items-center gap-2">
          <div className="bg-green-500/10 p-2 rounded-lg">
            <TrendingUp className="h-6 w-6 text-green-500" />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-white">Deriv<span className="text-green-500">Pro</span></h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeView === item.id 
                  ? 'bg-green-600/10 text-green-400 border border-green-600/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <item.icon className={`h-5 w-5 ${activeView === item.id ? 'text-green-500' : 'text-slate-500'}`} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}