
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TrendingUp, TrendingDown, DollarSign, Activity, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

export function DashboardView() {
  const [balance] = useState(1240.50);
  const [symbol] = useState("Volatility 100 (1s)");
  const [stake, setStake] = useState(10);
  const [duration, setDuration] = useState(5);
  const [timeframe, setTimeframe] = useState('M5'); // Estado para o timeframe

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Trading Dashboard</h2>
          <p className="text-slate-500">Análise em tempo real e execução segura</p>
        </div>
        <Card className="bg-slate-900 text-white border-none min-w-[200px]">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-green-500/20 rounded-full">
              <DollarSign className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase">Saldo Atual</p>
              <p className="text-xl font-bold">{formatCurrency(balance)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Area */}
        <Card className="lg:col-span-2 h-[500px] flex flex-col">
          <CardHeader className="border-b border-slate-100 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-slate-500" />
                {symbol} <span className="text-slate-400 text-sm font-normal">({timeframe})</span>
              </CardTitle>
              <div className="flex gap-2">
                {['M1', 'M5', 'M15'].map((tf) => (
                  <Button 
                    key={tf}
                    variant={timeframe === tf ? "default" : "outline"} 
                    size="sm" 
                    className="text-xs"
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 bg-slate-50 relative group">
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 flex-col gap-2">
              <p>Gráfico em Tempo Real ({timeframe})</p>
              <span className="text-xs text-slate-300">(Conexão WebSocket aguardando Fase 7)</span>
            </div>
            {/* Placeholder Visual do Gráfico */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-green-500/10 to-transparent opacity-50" />
            <div className="absolute top-1/2 left-1/4 w-2 h-2 bg-red-500 rounded-full animate-ping" />
          </CardContent>
        </Card>

        {/* Control Panel */}
        <div className="space-y-6">
          {/* Signal Card */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 uppercase">Sugestão da IA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <span className="text-3xl font-bold text-green-600">CALL</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-slate-900">85%</span>
                  <p className="text-xs text-slate-500">Score de Confiança</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">RSI (14)</span>
                  <span className="text-green-600 font-medium">Sobrevedido</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full w-[85%]"></div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Tendência (EMA)</span>
                  <span className="text-green-600 font-medium">Alta Forte</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operation Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Execução</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">Valor (USD)</label>
                  <input 
                    type="number" 
                    value={stake}
                    onChange={(e) => setStake(Number(e.target.value))}
                    className="flex h-10 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">Duração (Ticks)</label>
                  <input 
                    type="number" 
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="flex h-10 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button variant="success" className="w-full h-12 text-lg font-bold">
                  <TrendingUp className="mr-2 h-5 w-5" /> CALL
                </Button>
                <Button variant="danger" className="w-full h-12 text-lg font-bold">
                  <TrendingDown className="mr-2 h-5 w-5" /> PUT
                </Button>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                <AlertTriangle className="h-3 w-3" />
                <span>Stop Loss Diário: $50.00</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
