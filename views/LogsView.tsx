
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { ScrollText, Calendar, TrendingUp, TrendingDown, DollarSign, Filter, Wallet, PieChart, Loader2 } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface TradeLog {
    id: number;
    created_at: string;
    symbol: string;
    direction: string;
    stake: number;
    result: string;
    profit: number;
}

export function LogsView() {
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');
  const [trades, setTrades] = useState<TradeLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      fetchTrades();
  }, []);

  const fetchTrades = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades_log')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) setTrades(data);
      setLoading(false);
  };

  // Cálculos de Resumo
  const today = new Date().toISOString().split('T')[0];
  const todayTrades = trades.filter(t => t.created_at.startsWith(today));
  
  const calculateTotal = (list: TradeLog[]) => list.reduce((acc, t) => acc + (Number(t.profit) || 0), 0);
  
  const todayTotal = calculateTotal(todayTrades);
  // Simples aproximação para semana/mês
  const weekTotal = calculateTotal(trades.slice(0, 50)); 
  const monthTotal = calculateTotal(trades);

  const totalTrades = trades.length;
  const wins = trades.filter(t => t.result === 'WIN').length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

  const formatDate = (isoString: string) => {
      const date = new Date(isoString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Relatório Financeiro</h2>
            <p className="text-slate-400">Acompanhe seu desempenho real.</p>
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

      {/* --- CARDS DE RESUMO --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase font-bold text-slate-500">Hoje</span>
                      <Calendar className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className={cn("text-2xl font-black", todayTotal >= 0 ? "text-green-500" : "text-red-500")}>
                      {formatCurrency(todayTotal)}
                  </div>
              </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase font-bold text-slate-500">Geral (Total)</span>
                      <Wallet className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className={cn("text-2xl font-black", monthTotal >= 0 ? "text-green-500" : "text-red-500")}>
                      {formatCurrency(monthTotal)}
                  </div>
              </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase font-bold text-slate-500">Win Rate Global</span>
                      <PieChart className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="text-2xl font-black text-blue-400">
                      {winRate}%
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${winRate}%` }} />
                  </div>
              </CardContent>
          </Card>
           <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase font-bold text-slate-500">Trades Totais</span>
                      <TrendingUp className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-200">
                      {totalTrades}
                  </div>
              </CardContent>
          </Card>
      </div>

      {viewMode === 'LIST' ? (
        <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                    <Filter className="h-5 w-5 text-slate-400" />
                    Histórico Completo
                </CardTitle>
                <button onClick={fetchTrades} className="text-xs text-blue-400 hover:text-blue-300">Atualizar</button>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" /> Carregando logs...
                    </div>
                ) : trades.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">Nenhuma operação encontrada.</div>
                ) : (
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
                            {trades.map((trade) => (
                                <tr key={trade.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-slate-500 text-xs">{formatDate(trade.created_at)}</td>
                                    <td className="px-6 py-4 font-bold text-white">{trade.symbol}</td>
                                    <td className="px-6 py-4">
                                        <span className={cn("px-2 py-1 rounded text-[10px] font-black", trade.direction === 'CALL' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                                            {trade.direction}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{formatCurrency(trade.stake)}</td>
                                    <td className="px-6 py-4">
                                        <span className={cn("flex items-center gap-1 font-bold", trade.result === 'WIN' ? "text-green-500" : trade.result === 'LOSS' ? "text-red-500" : "text-yellow-500")}>
                                            {trade.result === 'WIN' ? <TrendingUp className="h-4 w-4" /> : trade.result === 'LOSS' ? <TrendingDown className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin"/>}
                                            {trade.result}
                                        </span>
                                    </td>
                                    <td className={cn("px-6 py-4 text-right font-bold font-mono", Number(trade.profit) >= 0 ? "text-green-400" : "text-red-400")}>
                                        {Number(trade.profit) > 0 ? '+' : ''}{formatCurrency(Number(trade.profit))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </CardContent>
        </Card>
      ) : (
          <div className="text-center text-slate-500 py-12 bg-slate-900 border border-slate-800 rounded-lg">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Visualização de Calendário em desenvolvimento.</p>
          </div>
      )}
    </div>
  );
}
