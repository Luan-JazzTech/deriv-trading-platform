
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TrendingUp, TrendingDown, DollarSign, Activity, Lock, Zap, Clock, ShieldAlert, ChevronDown, Globe, Bitcoin, Box, Layers, BarChart3, Target, Flame, Bot, Play, Pause, CalendarClock, Timer, CalendarDays, Trophy, Hash, MousePointerClick, ArrowRight, XCircle, CheckCircle2, AlertTriangle, Wallet, Timer as TimerIcon } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { analyzeMarket, Candle, AnalysisResult } from '../lib/analysis/engine';
import { derivApi } from '../lib/deriv/api';
import { supabase } from '../lib/supabase';

// --- CONFIGURAÇÃO DE ATIVOS REAIS (IDs da API Deriv) ---
const AVAILABLE_ASSETS = [
  { id: '1HZ100V', name: 'Volatility 100 (1s)', type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: '1HZ75V', name: 'Volatility 75 (1s)', type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: '1HZ50V', name: 'Volatility 50 (1s)', type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: '1HZ25V', name: 'Volatility 25 (1s)', type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: '1HZ10V', name: 'Volatility 10 (1s)', type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'R_100', name: 'Volatility 100', type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'R_75', name: 'Volatility 75', type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'JD10', name: 'Jump 10 Index', type: 'synthetic', decimals: 2, group: 'Jump Indices' },
  { id: 'JD50', name: 'Jump 50 Index', type: 'synthetic', decimals: 2, group: 'Jump Indices' },
  { id: 'frxEURUSD', name: 'EUR/USD', type: 'forex', decimals: 5, group: 'Forex Majors' },
  { id: 'frxGBPUSD', name: 'GBP/USD', type: 'forex', decimals: 5, group: 'Forex Majors' },
  { id: 'frxUSDJPY', name: 'USD/JPY', type: 'forex', decimals: 3, group: 'Forex Majors' },
  { id: 'cryBTCUSD', name: 'BTC/USD', type: 'crypto', decimals: 2, group: 'Cryptocurrencies' },
  { id: 'cryETHUSD', name: 'ETH/USD', type: 'crypto', decimals: 2, group: 'Cryptocurrencies' },
];

interface AssetRanking {
    id: string;
    name: string;
    winRate: number;
    direction: 'CALL' | 'PUT';
    score: number;
}

interface TradeActivity {
    id: number; // Deriv contract_id é number
    asset: string;
    time: string;
    type: 'CALL' | 'PUT';
    amount: number;
    status: 'PENDING' | 'WIN' | 'LOSS';
    profit?: number;
    expiryTime?: number; // timestamp
}

interface AccountInfo {
    balance: number;
    currency: string;
    isVirtual: boolean;
    email: string;
}

export function DashboardView() {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [activeAsset, setActiveAsset] = useState(AVAILABLE_ASSETS[0]);
  const [stake, setStake] = useState(1); 
  const [timeframe, setTimeframe] = useState('M1');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  
  // Estado da Análise
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // --- GERENCIAMENTO DE RISCO SNIPER ---
  const [dailyStats, setDailyStats] = useState({ trades: 0, wins: 0, losses: 0, profit: 0 });
  const [liveTrades, setLiveTrades] = useState<TradeActivity[]>([]);

  // --- MODO DE EXECUÇÃO ---
  const [executionMode, setExecutionMode] = useState<'MANUAL' | 'AUTO' | 'SCANNER'>('MANUAL');
  
  // --- CONFIGURAÇÃO BOT ---
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [botStatus, setBotStatus] = useState<'IDLE' | 'RUNNING' | 'WAITING_SCHEDULE' | 'STOPPED_BY_RISK'>('IDLE');
  
  const [stopMode, setStopMode] = useState<'FINANCIAL' | 'QUANTITY'>('FINANCIAL');
  
  const [autoSettings, setAutoSettings] = useState({
      stake: 1.0,
      stopWinValue: 10.0,
      stopLossValue: 5.0,
      stopWinCount: 2, 
      stopLossCount: 1,
      scheduleEnabled: false,
      startTime: '09:00',
      endTime: '17:00',
      activeDays: [1, 2, 3, 4, 5]
  });

  const [marketRanking, setMarketRanking] = useState<AssetRanking[]>([]);

  // Configuração Global Manual
  const RISK_CONFIG = { maxTrades: 20, stopWin: 100.00, stopLoss: -50.00 };
  const isManualLocked = dailyStats.trades >= RISK_CONFIG.maxTrades;

  const isAutoLocked = () => {
    if (stopMode === 'QUANTITY') {
        return dailyStats.wins >= autoSettings.stopWinCount || dailyStats.losses >= autoSettings.stopLossCount;
    } else {
        return dailyStats.profit >= autoSettings.stopWinValue || dailyStats.profit <= -Math.abs(autoSettings.stopLossValue);
    }
  };

  const lastAutoTradeTimestamp = useRef<number>(0);
  
  // --- CONEXÃO COM API DERIV ---
  useEffect(() => {
    let mounted = true;

    const initDeriv = async () => {
        try {
            const authResponse = await derivApi.connect();
            
            if (!mounted) return;

            if (authResponse && authResponse.authorize) {
                setIsConnected(true);
                const balance = typeof authResponse.authorize.balance === 'number' ? authResponse.authorize.balance : 0;
                
                setAccountInfo({
                    balance: balance,
                    currency: authResponse.authorize.currency || 'USD',
                    isVirtual: !!authResponse.authorize.is_virtual,
                    email: authResponse.authorize.email || ''
                });

                derivApi.subscribeBalance((data) => {
                    if (!mounted || !data) return;
                    setAccountInfo(prev => prev ? { 
                        ...prev, 
                        balance: typeof data.balance === 'number' ? data.balance : prev.balance, 
                        currency: data.currency || prev.currency 
                    } : null);
                });
            }
        } catch (e) {
            console.error("Falha ao conectar Deriv:", e);
        }
    };
    initDeriv();

    return () => { mounted = false; };
  }, []);

  // --- CARREGAR DADOS DE MERCADO REAIS ---
  useEffect(() => {
    if (!isConnected) return;
    setCandles([]); setAnalysis(null); setCurrentPrice(0);
    const granularity = timeframe === 'M1' ? 60 : timeframe === 'M5' ? 300 : 900;

    derivApi.getHistory(activeAsset.id, granularity, 100).then(history => {
        if (history.length > 0) {
            setCandles(history);
            setCurrentPrice(history[history.length - 1].close);
        }
    });

    derivApi.subscribeTicks(activeAsset.id, (tick) => {
        if (!tick || typeof tick.quote !== 'number') return;
        const price = tick.quote;
        const time = tick.epoch * 1000;
        setCurrentPrice(price);

        setCandles(prev => {
            if (prev.length === 0) return prev;
            const lastCandle = prev[prev.length - 1];
            const candleDurationMs = granularity * 1000;
            const candleEndTime = lastCandle.time + candleDurationMs;

            if (time >= candleEndTime) {
                const newCandle: Candle = {
                    time: Math.floor(time / candleDurationMs) * candleDurationMs,
                    open: price, close: price, high: price, low: price
                };
                return [...prev.slice(1), newCandle];
            } else {
                const updatedLast = {
                    ...lastCandle,
                    close: price,
                    high: Math.max(lastCandle.high, price),
                    low: Math.min(lastCandle.low, price)
                };
                return [...prev.slice(0, -1), updatedLast];
            }
        });
    });
  }, [activeAsset, timeframe, isConnected]);

  useEffect(() => {
    if (candles && candles.length > 20) {
        const result = analyzeMarket(candles);
        setAnalysis(result);
    }
  }, [candles]);

  // --- COOLDOWN SYSTEM ---
  useEffect(() => {
      if (cooldown > 0) {
          const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
          return () => clearTimeout(timer);
      }
  }, [cooldown]);

  // --- LÓGICA DO BOT AUTOMÁTICO ---
  useEffect(() => {
      if (!isAutoRunning || executionMode !== 'AUTO') {
          setBotStatus('IDLE');
          return;
      }
      if (autoSettings.scheduleEnabled) {
          const now = new Date();
          const currentDay = now.getDay();
          if (!autoSettings.activeDays.includes(currentDay)) { setBotStatus('WAITING_SCHEDULE'); return; }
          const [startHour, startMin] = autoSettings.startTime.split(':').map(Number);
          const [endHour, endMin] = autoSettings.endTime.split(':').map(Number);
          const start = new Date(now).setHours(startHour, startMin, 0, 0);
          const end = new Date(now).setHours(endHour, endMin, 0, 0);
          const current = now.getTime();
          if (current < start || current > end) { setBotStatus('WAITING_SCHEDULE'); return; }
      }
      if (isAutoLocked()) { setBotStatus('STOPPED_BY_RISK'); return; }
      setBotStatus('RUNNING');
      if (analysis && analysis.isSniperReady) {
          if (analysis.timestamp <= lastAutoTradeTimestamp.current) return;
          // Rate Limit Check no Bot também
          if (cooldown > 0) return;

          if (analysis.direction === 'CALL' || analysis.direction === 'PUT') {
              handleTrade(analysis.direction, autoSettings.stake);
              lastAutoTradeTimestamp.current = analysis.timestamp;
          }
      }
  }, [analysis, isAutoRunning, executionMode, dailyStats, autoSettings, stopMode, cooldown]);


  const handleTrade = async (type: 'CALL' | 'PUT', tradeStake = stake) => {
      if (executionMode === 'MANUAL' && isManualLocked) return;
      if (!isConnected) { alert('Conecte a API nas configurações!'); return; }
      if (cooldown > 0) return;

      setTradeLoading(true);

      try {
          const duration = timeframe === 'M1' ? 1 : timeframe === 'M5' ? 5 : 15;
          const unit = 'm';
          
          const response = await derivApi.buyContract(activeAsset.id, type, tradeStake, duration, unit);

          if (response.error) {
              alert(`Erro na Deriv: ${response.error.message}`);
              setTradeLoading(false);
              return;
          }

          const contractInfo = response.buy;
          
          // Adiciona ao log visual como PENDING
          const newTrade: TradeActivity = {
              id: contractInfo.contract_id,
              asset: activeAsset.name,
              time: new Date().toLocaleTimeString(),
              type: type,
              amount: tradeStake,
              status: 'PENDING'
          };
          setLiveTrades(prev => [newTrade, ...prev]);
          setCooldown(5); // 5 segundos de intervalo entre entradas

          // MONITORAR O CONTRATO ATÉ FECHAR
          derivApi.subscribeContract(contractInfo.contract_id, (update) => {
              if (update.is_sold) {
                  const profit = Number(update.profit);
                  const status = profit >= 0 ? 'WIN' : 'LOSS';
                  
                  // Atualiza UI
                  setLiveTrades(prev => prev.map(t => 
                      t.id === contractInfo.contract_id 
                      ? { ...t, status, profit } 
                      : t
                  ));

                  // Atualiza Stats do Dia
                  setDailyStats(prev => ({
                      trades: prev.trades + 1,
                      wins: prev.wins + (profit >= 0 ? 1 : 0),
                      losses: prev.losses + (profit < 0 ? 1 : 0),
                      profit: prev.profit + profit
                  }));

                  // Salva no Banco de Dados (Log Definitivo)
                  supabase.from('trades_log').insert({
                      symbol: activeAsset.name,
                      direction: type,
                      stake: tradeStake,
                      duration: `${duration}${unit}`,
                      result: status,
                      profit: profit,
                      deriv_contract_id: contractInfo.contract_id
                  }).then(() => console.log('Trade salvo no banco'));
              }
          });

      } catch (err) {
          console.error(err);
          alert('Falha ao enviar ordem.');
      } finally {
          setTradeLoading(false);
      }
  };

  const getAssetIcon = (type: string) => {
    switch(type) {
      case 'crypto': return <Bitcoin className="h-5 w-5 text-orange-500" />;
      case 'forex': return <Globe className="h-5 w-5 text-blue-500" />;
      case 'synthetic': return <Activity className="h-5 w-5 text-purple-500" />;
      default: return <Flame className="h-5 w-5 text-red-500" />;
    }
  };

  const renderChart = () => {
    if (!candles || candles.length === 0) return <div className="h-full flex flex-col items-center justify-center text-slate-500 animate-pulse gap-2"><Activity className="h-8 w-8" />Carregando Gráfico Deriv...</div>;
    
    const safeCandles = candles.filter(c => c && typeof c.high === 'number' && !isNaN(c.high) && !isNaN(c.low));
    if (safeCandles.length < 2) return <div className="h-full flex flex-col items-center justify-center text-slate-500">Dados insuficientes...</div>;

    const minPrice = Math.min(...safeCandles.map(c => c.low));
    const maxPrice = Math.max(...safeCandles.map(c => c.high));
    const priceRange = (maxPrice - minPrice) || 0.0001;
    
    const width = 800; const height = 350; const padding = 40; const usableHeight = height - (padding * 2);
    const candleWidth = (width / Math.max(safeCandles.length, 1)) * 0.7;
    const spacing = (width / Math.max(safeCandles.length, 1));
    const formatPrice = (p: number) => typeof p === 'number' ? p.toFixed(activeAsset.decimals) : '0.00';

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible preserve-3d bg-[#0B1120] rounded-lg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" opacity="0.5"/>
          </pattern>
          <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect width="100%" height="100%" fill="url(#chartGradient)" />

        {safeCandles.map((candle, index) => {
          const normalizeY = (val: number) => {
             const safeVal = (typeof val === 'number' && !isNaN(val)) ? val : minPrice;
             return height - padding - ((safeVal - minPrice) / priceRange) * usableHeight;
          };
          const yOpen = normalizeY(candle.open); const yClose = normalizeY(candle.close);
          const yHigh = normalizeY(candle.high); const yLow = normalizeY(candle.low);
          const isGreen = candle.close >= candle.open;
          const color = isGreen ? '#10b981' : '#f43f5e'; 
          const x = index * spacing + (spacing - candleWidth) / 2;
          const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
          
          return (
            <g key={candle.time}>
              <line x1={x + candleWidth/2} y1={yHigh} x2={x + candleWidth/2} y2={yLow} stroke={color} strokeWidth="1" opacity="0.8" />
              <rect x={x} y={Math.min(yOpen, yClose)} width={candleWidth} height={bodyHeight} fill={color} rx="1" stroke={color} strokeWidth="0.5" />
            </g>
          );
        })}
        <line x1="0" y1={height - padding - ((currentPrice - minPrice) / priceRange) * usableHeight} x2={width} y2={height - padding - ((currentPrice - minPrice) / priceRange) * usableHeight} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" opacity="0.8" />
        <rect x={width - 60} y={height - padding - ((currentPrice - minPrice) / priceRange) * usableHeight - 10} width="60" height="20" fill="#3b82f6" rx="2" />
        <text x={width - 30} y={height - padding - ((currentPrice - minPrice) / priceRange) * usableHeight} fill="white" fontSize="11" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">
            {formatPrice(currentPrice)}
        </text>
      </svg>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* --- HUD HEADER --- */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-slate-900/50 backdrop-blur-md p-4 rounded-xl shadow-lg border border-slate-800">
        <div className="relative group w-full lg:w-auto min-w-[320px]">
          <label className="text-[10px] uppercase font-bold text-slate-500 absolute -top-2 left-2 bg-slate-900 px-1 border border-slate-800 rounded">Ativo Real (Deriv)</label>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">{getAssetIcon(activeAsset.type)}</div>
          <select 
            value={activeAsset.id}
            onChange={(e) => setActiveAsset(AVAILABLE_ASSETS.find(a => a.id === e.target.value) || AVAILABLE_ASSETS[0])}
            className="w-full appearance-none bg-slate-950 text-slate-200 text-lg font-bold py-3 pl-12 pr-10 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all shadow-inner"
          >
            {['Derived Indices', 'Jump Indices', 'Forex Majors', 'Cryptocurrencies'].map(group => (
              <optgroup key={group} label={group} className="bg-slate-900 text-slate-300">
                {AVAILABLE_ASSETS.filter(a => a.group === group).map(asset => (
                  <option key={asset.id} value={asset.id}>{asset.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 pointer-events-none" />
        </div>

        {/* --- PAINEL DE CONTA --- */}
        <div className="flex items-center gap-px bg-slate-950/80 text-white p-1 rounded-lg border border-slate-800 shadow-xl">
             {!isConnected || !accountInfo ? (
                <div className="px-5 py-2 flex items-center gap-2 text-yellow-500 animate-pulse">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs font-bold">Modo Offline</span>
                </div>
             ) : (
                <>
                    <div className={cn("px-4 py-2 flex items-center gap-2 border-r border-slate-800", accountInfo?.isVirtual ? "text-orange-400" : "text-green-400")}>
                        <Wallet className="h-4 w-4" />
                        <div className="flex flex-col leading-none">
                            <span className="text-[10px] uppercase font-bold text-slate-500">{accountInfo?.isVirtual ? 'DEMO' : 'REAL'}</span>
                            <span className="text-sm font-bold">{formatCurrency(accountInfo?.balance || 0)}</span>
                        </div>
                    </div>
                </>
             )}
            <div className="px-5 py-2 border-l border-slate-800 flex flex-col items-end">
                <span className="text-[9px] uppercase text-slate-500 font-bold">Lucro Sessão</span>
                <span className={cn("text-xs font-bold font-mono", dailyStats.profit >= 0 ? "text-green-400" : "text-red-400")}>{formatCurrency(dailyStats.profit)}</span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-220px)]">
        {/* --- COLUNA PRINCIPAL (GRÁFICO) --- */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-4 h-full">
          <Card className="flex-1 flex flex-col bg-slate-900 border-slate-800 shadow-xl overflow-hidden min-h-[400px]">
            <div className="flex flex-row items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-slate-400" />
                <span className="font-bold text-slate-300">Gráfico Real</span>
              </div>
              <div className="flex bg-slate-950 rounded-md border border-slate-800 p-1">
                {['M1', 'M5', 'M15'].map((tf) => (
                  <button key={tf} onClick={() => setTimeframe(tf)} className={cn("px-3 py-1 text-xs font-bold rounded transition-colors", timeframe === tf ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-900")}>{tf}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 bg-slate-950 p-4 relative">
                {renderChart()}
            </div>
          </Card>

          {/* --- PAINEL DE ATIVIDADE AO VIVO (COM STATUS) --- */}
          {liveTrades.length > 0 && (
              <div className="h-[150px] bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
                  <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-300 uppercase">Live Activity</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {liveTrades.map((trade, idx) => (
                          <div key={idx} className={cn("flex items-center justify-between p-2 rounded text-xs border", trade.status === 'PENDING' ? "bg-slate-800/50 border-slate-700/50" : trade.status === 'WIN' ? "bg-green-900/10 border-green-500/20" : "bg-red-900/10 border-red-500/20")}>
                              <div className="flex items-center gap-3">
                                  <span className="text-slate-500 font-mono">{trade.time}</span>
                                  <span className="font-bold text-white">{trade.asset}</span>
                                  <span className={cn("px-1.5 py-0.5 rounded font-black text-[10px]", trade.type === 'CALL' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>{trade.type}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                  <span className="text-slate-300 font-bold">{formatCurrency(trade.amount)}</span>
                                  {trade.status === 'PENDING' && <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20 flex items-center gap-1"><TimerIcon className="h-3 w-3 animate-spin" /> EM ANDAMENTO</span>}
                                  {trade.status === 'WIN' && <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded border border-green-500/20 font-bold">WIN (+{formatCurrency(trade.profit || 0)})</span>}
                                  {trade.status === 'LOSS' && <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded border border-red-500/20 font-bold">LOSS ({formatCurrency(trade.profit || 0)})</span>}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* --- PAINEL DE SINAL --- */}
          <Card className={cn(
              "border-l-4 shadow-xl transition-all h-[200px] bg-slate-900 border-t border-r border-b border-slate-800",
              analysis?.isSniperReady ? (analysis.direction === 'CALL' ? 'border-l-green-500 bg-green-950/10' : 'border-l-red-500 bg-red-950/10') : 'border-l-slate-700'
          )}>
            <CardContent className="pt-6">
              {analysis ? (
                <div className="flex items-center justify-between gap-8">
                  <div className="flex flex-col items-center min-w-[140px] border-r border-slate-800 pr-4">
                      <span className="text-[10px] font-bold uppercase text-slate-500 mb-1">Recomendação</span>
                      <div className={cn("text-4xl font-black tracking-tighter flex items-center gap-2", analysis.direction === 'CALL' ? 'text-green-500' : analysis.direction === 'PUT' ? 'text-red-500' : 'text-slate-600')}>
                          {analysis.direction === 'CALL' && <TrendingUp className="h-8 w-8" />}
                          {analysis.direction === 'PUT' && <TrendingDown className="h-8 w-8" />}
                          {analysis.direction === 'NEUTRO' && <Lock className="h-8 w-8" />}
                          {analysis.direction}
                      </div>
                  </div>
                  <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-500 mb-2">Assertividade</span>
                      <span className={cn("text-3xl font-black", analysis.probability >= 80 ? "text-green-400" : "text-blue-400")}>{analysis.probability}%</span>
                  </div>
                  <div className="flex-1 h-[100px] overflow-y-auto pr-2 border-l border-slate-800 pl-6 space-y-2 scrollbar-thin scrollbar-thumb-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500 sticky top-0 bg-slate-900 block pb-1">Confluências</span>
                    {analysis.factors.map((factor, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs border-b border-slate-800/50 pb-1">
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", factor.status === 'POSITIVE' ? 'bg-green-500' : factor.status === 'NEGATIVE' ? 'bg-red-500' : 'bg-slate-600')} />
                        <span className="text-slate-300 font-medium">{factor.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div className="text-center py-8 text-slate-600 animate-pulse">Aguardando dados de mercado...</div>}
            </CardContent>
          </Card>
        </div>

        {/* --- COLUNA LATERAL (EXECUÇÃO) --- */}
        <div className="col-span-12 lg:col-span-3 h-full">
          <Card className="h-full flex flex-col bg-slate-900 shadow-xl border-slate-800 relative overflow-hidden">
             <div className="grid grid-cols-3 border-b border-slate-800">
                <button onClick={() => setExecutionMode('MANUAL')} className={cn("p-3 text-xs font-bold transition-colors border-b-2", executionMode === 'MANUAL' ? "text-white border-green-500 bg-slate-800" : "text-slate-500 border-transparent hover:text-slate-300")}>MANUAL</button>
                <button onClick={() => setExecutionMode('AUTO')} className={cn("p-3 text-xs font-bold transition-colors border-b-2", executionMode === 'AUTO' ? "text-white border-yellow-500 bg-slate-800" : "text-slate-500 border-transparent hover:text-slate-300")}>BOT</button>
                <button onClick={() => setExecutionMode('SCANNER')} className={cn("p-3 text-xs font-bold transition-colors border-b-2", executionMode === 'SCANNER' ? "text-white border-purple-500 bg-slate-800" : "text-slate-500 border-transparent hover:text-slate-300")}>RANK</button>
             </div>

             <CardContent className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto">
                {executionMode === 'MANUAL' && (
                    <div className="space-y-6 flex-1 flex flex-col">
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-slate-500 uppercase">Valor da Entrada</label>
                            <div className="relative group">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                <input type="number" value={stake} onChange={(e) => setStake(Number(e.target.value))} className="w-full h-14 pl-10 pr-4 bg-slate-950 border border-slate-800 rounded-xl text-2xl font-black text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/50" />
                            </div>
                        </div>
                        <div className="flex-1 grid grid-rows-2 gap-3 mt-4">
                            <Button disabled={cooldown > 0} className="h-full bg-green-600 hover:bg-green-500 text-xl font-black disabled:opacity-50" onClick={() => handleTrade('CALL')}>
                                {cooldown > 0 ? `AGUARDE (${cooldown}s)` : 'CALL'}
                            </Button>
                            <Button disabled={cooldown > 0} className="h-full bg-red-600 hover:bg-red-500 text-xl font-black disabled:opacity-50" onClick={() => handleTrade('PUT')}>
                                {cooldown > 0 ? `AGUARDE (${cooldown}s)` : 'PUT'}
                            </Button>
                        </div>
                    </div>
                )}
                {/* Outros modos (AUTO/SCANNER) mantidos simplificados para foco na correção do Manual */}
                {executionMode !== 'MANUAL' && <div className="text-center text-slate-500 py-10">Configure no modo Manual primeiro para testar.</div>}
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
