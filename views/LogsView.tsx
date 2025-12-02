
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { ScrollText, Calendar, TrendingUp, TrendingDown, DollarSign, Filter } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

export function LogsView() {
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');

  // Mock Data (Na versão final, virá do Supabase)
  const tradeHistory = [
      { id: 1, date: '2023-10-25', time: '10:30', asset: 'Volatility 100', type: 'CALL', amount: 10, result: 'WIN', profit: 9.50 },
      { id: 2, date: '2023-10-25', time: '11:15', asset: 'EUR/USD', type: 'PUT', amount: 20, result: 'LOSS', profit: -20.00 },
      { id: 3, date: '2023-10-24', time: '14:20', asset: 'Jump 50', type: 'CALL', amount: 15, result: 'WIN', profit: 14.25 },
      { id: 4, date: '2023-10-24', time: '15:00', asset: 'BTC/USD', type: 'PUT', amount: 10, result: 'WIN', profit: 9.50 },
  ];

  // Agrupamento por dia para Calendário
  const dailyStats = {
      '2023-10-25': -10.50,
      '2023-10-24': 23.75,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Auditoria e Logs</h2>
            <p className="text-slate-400">Histórico detalhado de todas as operações.</p>
        </div>
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
            <button onClick={() => setViewMode('LIST')} className={cn("px-4 py-2 text-sm font-bold rounded transition-colors", viewMode === 'LIST' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300")}>
                <ScrollText className="h-4 w-4 inline mr-2" /> Lista
            </button>
            <button onClick={() => setViewMode('CALENDAR')} className={cn("px-4 py-2 text-sm font-bold rounded transition-colors", viewMode === 'CALENDAR' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300")}>
                <Calendar className="h-4 w-4 inline mr-2" /> Calendário
            </button>
        </div>
      </div>

      {viewMode === 'LIST' ? (
        <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                    <Filter className="h-5 w-5 text-slate-400" />
                    Últimas Operações
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">Data/Hora</th>
                            <th className="px-6 py-4">Ativo</th>
                            <th className="px-6 py-4">Tipo</th>
                            <th className="px-6 py-4">Entrada</th>
                            <th className="px-6 py-4">Resultado</th>
                            <th className="px-6 py-4 text-right">Lucro/Prejuízo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                        {tradeHistory.map((trade) => (
                            <tr key={trade.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4 font-mono text-slate-500">{trade.date} {trade.time}</td>
                                <td className="px-6 py-4 font-bold text-white">{trade.asset}</td>
                                <td className="px-6 py-4">
                                    <span className={cn("px-2 py-1 rounded text-[10px] font-black", trade.type === 'CALL' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                                        {trade.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{formatCurrency(trade.amount)}</td>
                                <td className="px-6 py-4">
                                    <span className={cn("flex items-center gap-1 font-bold", trade.result === 'WIN' ? "text-green-500" : "text-red-500")}>
                                        {trade.result === 'WIN' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                        {trade.result}
                                    </span>
                                </td>
                                <td className={cn("px-6 py-4 text-right font-bold font-mono