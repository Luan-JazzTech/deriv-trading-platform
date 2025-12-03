
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TrendingUp, TrendingDown, DollarSign, Activity, Lock, Zap, Clock, ShieldAlert, ChevronDown, Globe, Bitcoin, Box, Layers, BarChart3, Target, Flame, Bot, Play, Pause, CalendarClock, Timer, CalendarDays, Trophy, Hash, MousePointerClick, ArrowRight, XCircle, CheckCircle2, AlertTriangle, Wallet, Timer as TimerIcon, StopCircle, Settings2, Sliders, Hourglass, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
    profit?: number; // Lucro Realizado
    currentProfit?: number; // Lucro Flutuante (indicativo)
    startTime: number; // timestamp ms
    totalDurationSeconds: number; 
    expiryTime?: number; // timestamp ms 
    entryPrice?: number;
    currentPrice?: number;
    exitPrice?: number;
    isWinning?: boolean; // Status calculado em tempo real
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
  // Estado auxiliar para forçar re-render do timer
  const [, setTick] = useState(0);

  // --- MODO DE EXECUÇÃO ---
  const [executionMode, setExecutionMode] = useState<'MANUAL' | 'AUTO' | 'SCANNER'>('MANUAL');
  
  // --- CONFIGURAÇÃO BOT ---
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [botStatus, setBotStatus] = useState<'IDLE' | 'RUNNING' | 'WAITING_SCHEDULE' | 'STOPPED_BY_RISK'>('IDLE');
  const [botTab, setBotTab] = useState<'CONFIG' | 'RISK'>('CONFIG'); // UI Tab

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
      activeDays: [1, 2, 3, 4, 5] // 1=Seg, 5=Sex
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
  
  // --- TIMER GLOBAL PARA UI DE PROGRESSO ---
  useEffect(() => {
    const interval = setInterval(() => {
        setTick(t => t + 1);
    }, 500); // Atualiza UI a cada 500ms
    return () => clearInterval(interval);
  }, []);

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
      // Verificar agendamento
      if (autoSettings.scheduleEnabled) {
          const now = new Date();
          const currentDay = now.getDay();
          if (!autoSettings.activeDays.includes(currentDay)) { 
              setBotStatus('WAITING_SCHEDULE'); 
              return; 
          }
          const [startHour, startMin] = autoSettings.startTime.split(':').map(Number);
          const [endHour, endMin] = autoSettings.endTime.split(':').map(Number);
          
          const start = new Date(now); start.setHours(startHour, startMin, 0, 0);
          const end = new Date(now); end.setHours(endHour, endMin, 0, 0);
          const current = now.getTime();
          
          if (current < start.getTime() || current > end.getTime()) { 
              setBotStatus('WAITING_SCHEDULE'); 
              return; 
          }
      }
      
      if (isAutoLocked()) { 
          setBotStatus('STOPPED_BY_RISK'); 
          setIsAutoRunning(false); 
          return; 
      }
      
      setBotStatus('RUNNING');
      
      if (analysis && analysis.isSniperReady) {
          if (analysis.timestamp <= lastAutoTradeTimestamp.current) return;
          if (cooldown > 0) return;

          if (analysis.direction === 'CALL' || analysis.direction === 'PUT') {
              handleTrade(analysis.direction, autoSettings.stake);
              lastAutoTradeTimestamp.current = analysis.timestamp;
          }
      }
  }, [analysis, isAutoRunning, executionMode, dailyStats, autoSettings, stopMode, cooldown]);


  const handleTrade = async (type: 'CALL' | 'PUT', tradeStake = stake) => {
      if (executionMode === 'MANUAL' && isManualLocked) {
          alert("Limite de trades manuais atingido!");
          return;
      }
      if (!isConnected) { alert('Conecte a API nas configurações!'); return; }
      if (cooldown > 0) return;

      setTradeLoading(true);

      try {
          const durationSeconds = timeframe === 'M1' ? 60 : timeframe === 'M5' ? 300 : 900;
          const durationUnit = 's';
          
          const response = await derivApi.buyContract(activeAsset.id, type, tradeStake, durationSeconds, durationUnit);

          if (response.error) {
              alert(`Erro na Deriv: ${response.error.message}`);
              setTradeLoading(false);
              return;
          }

          const contractInfo = response.buy;
          const startTime = Date.now();
          
          // UI Optimistic Update
          setAccountInfo(prev => prev ? { ...prev, balance: prev.balance - tradeStake } : null);

          const newTrade: TradeActivity = {
              id: contractInfo.contract_id,
              asset: activeAsset.name,
              time: new Date().toLocaleTimeString(),
              type: type,
              amount: tradeStake,
              status: 'PENDING',
              startTime: startTime,
              totalDurationSeconds: durationSeconds,
              expiryTime: startTime + (durationSeconds * 1000) 
          };
          setLiveTrades(prev => [newTrade, ...prev]);
          setCooldown(3); 

          // MONITORAR O CONTRATO ATÉ FECHAR
          derivApi.subscribeContract(contractInfo.contract_id, (update) => {
              
              setLiveTrades(prev => prev.map(t => {
                  if (t.id !== contractInfo.contract_id) return t;

                  // Atualizar dados em tempo real
                  const updatedTrade = { ...t };
                  if (update.date_expiry) updatedTrade.expiryTime = update.date_expiry * 1000;
                  if (update.entry_spot) updatedTrade.entryPrice = update.entry_spot;
                  if (update.current_spot) updatedTrade.currentPrice = update.current_spot;
                  
                  // Calcular se está Ganhando ou Perdendo AGORA
                  if (updatedTrade.entryPrice && updatedTrade.currentPrice) {
                      if (updatedTrade.type === 'CALL') {
                          updatedTrade.isWinning = updatedTrade.currentPrice > updatedTrade.entryPrice;
                      } else {
                          updatedTrade.isWinning = updatedTrade.currentPrice < updatedTrade.entryPrice;
                      }
                  }

                  if (update.is_sold) {
                      const profit = Number(update.profit);
                      const status = profit >= 0 ? 'WIN' : 'LOSS';
                      
                      // Atualiza Stats do Dia
                      if (t.status === 'PENDING') { // Só atualiza stats uma vez
                         setDailyStats(stats => ({
                             trades: stats.trades + 1,
                             wins: stats.wins + (profit >= 0 ? 1 : 0),
                             losses: stats.losses + (profit < 0 ? 1 : 0),
                             profit: stats.profit + profit
                         }));

                         // Salva no Supabase
                         supabase.from('trades_log').insert({
                             symbol: activeAsset.name,
                             direction: type,
                             stake: tradeStake,
                             duration: `${durationSeconds}s`,
                             result: status,
                             profit: profit,
                             deriv_contract_id: contractInfo.contract_id
                         }).then((res) => {
                             if(res.error) console.error("Erro log Supabase:", res.error);
                         });
                      }

                      return { 
                          ...updatedTrade, 
                          status, 
                          profit, 
                          exitPrice: update.exit_tick 
                      };
                  }

                  return updatedTrade;
              }));
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

          {/* --- PAINEL DE ATIVIDADE AO VIVO (COM STATUS DINÂMICO) --- */}
          {liveTrades.length > 0 && (
              <div className="h-[240px] bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
                  <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center gap-2">
                      <Hourglass className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-300 uppercase">Operações Ativas & Histórico Recente</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {liveTrades.map((trade, idx) => {
                          const now = Date.now();
                          const expiry = trade.expiryTime || (trade.startTime + (trade.totalDurationSeconds * 1000));
                          const timeLeftMs = Math.max(0, expiry - now);
                          const timeLeftSeconds = Math.ceil(timeLeftMs / 1000);
                          const progress = Math.min(100, Math.max(0, 100 - (timeLeftMs / (trade.totalDurationSeconds * 1000) * 100)));
                          
                          return (
                            <div key={idx} className={cn("relative overflow-hidden flex flex-col p-3 rounded-lg text-xs border transition-colors", 
                                trade.status === 'PENDING' ? "bg-slate-800/40 border-slate-700/50" : 
                                trade.status === 'WIN' ? "bg-green-950/20 border-green-500/20" : 
                                "bg-red-950/20 border-red-500/20")}>
                                
                                {/* Info Principal */}
                                <div className="flex items-center justify-between z-10 relative mb-1">
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-500 font-mono text-[10px]">{trade.time}</span>
                                        <div className="flex items-center gap-1">
                                            {trade.type === 'CALL' ? <ArrowUpRight className="h-4 w-4 text-green-500"/> : <ArrowDownRight className="h-4 w-4 text-red-500"/>}
                                            <span className="font-bold text-white text-sm">{trade.asset}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Status Real-time */}
                                    {trade.status === 'PENDING' && (
                                        <div className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider animate-pulse", 
                                            trade.isWinning ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                        )}>
                                            {trade.isWinning ? 'WINNING' : 'LOSING'}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between z-10 relative">
                                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] uppercase font-bold text-slate-600">Entrada</span>
                                            <span className="font-mono text-slate-300">{trade.entryPrice?.toFixed(activeAsset.decimals) || '---'}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] uppercase font-bold text-slate-600">Atual / Saída</span>
                                            <span className={cn("font-mono font-bold", trade.isWinning ? "text-green-400" : "text-red-400")}>
                                                {(trade.status === 'PENDING' ? trade.currentPrice : trade.exitPrice)?.toFixed(activeAsset.decimals) || '---'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] uppercase font-bold text-slate-600">Stake</span>
                                            <span className="text-slate-300 font-bold">{formatCurrency(trade.amount)}</span>
                                        </div>
                                        
                                        {trade.status === 'PENDING' ? (
                                            <div className="flex items-center gap-2 min-w-[70px] justify-end bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                                <span className="font-mono font-bold text-yellow-500">{Math.floor(timeLeftSeconds / 60).toString().padStart(2,'0')}:{Math.floor(timeLeftSeconds % 60).toString().padStart(2,'0')}</span>
                                                <TimerIcon className="h-3 w-3 text-yellow-500 animate-spin" />
                                            </div>
                                        ) : (
                                            <span className={cn("text-xs px-3 py-1 rounded border font-black min-w-[70px] text-center", 
                                                trade.status === 'WIN' ? "bg-green-500 text-white border-green-600" : 
                                                "bg-red-500 text-white border-red-600"
                                            )}>
                                                {trade.status === 'WIN' ? `+${formatCurrency(trade.profit || 0)}` : formatCurrency(trade.profit || 0)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Barra de Progresso */}
                                {trade.status === 'PENDING' && (
                                    <div className="mt-2 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className={cn("h-full transition-all duration-500 ease-linear", trade.isWinning ? "bg-green-500" : "bg-red-500")}
                                            style={{ width: `${progress}%` }} 
                                        />
                                    </div>
                                )}
                            </div>
                          );
                      })}
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
                {/* --- MODO MANUAL --- */}
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

                {/* --- MODO AUTO (BOT UI) --- */}
                {executionMode === 'AUTO' && (
                    <div className="space-y-4 flex flex-col h-full">
                       {/* BOT STATUS HEADER */}
                       <div className={cn(
                           "p-4 rounded-xl border flex items-center gap-3 shadow-lg",
                           isAutoRunning ? "bg-green-950/20 border-green-500/30" : "bg-slate-950 border-slate-800"
                       )}>
                           <div className={cn("p-2 rounded-full", isAutoRunning ? "bg-green-500/20 animate-pulse" : "bg-slate-800")}>
                               <Bot className={cn("h-6 w-6", isAutoRunning ? "text-green-500" : "text-slate-500")} />
                           </div>
                           <div className="flex-1">
                               <h4 className="font-bold text-white text-sm">Sniper Bot v1.0</h4>
                               <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                   Status: <span className={cn("font-bold uppercase", isAutoRunning ? 'text-green-400' : 'text-slate-500')}>{botStatus.replace('_', ' ')}</span>
                               </p>
                           </div>
                       </div>
                       
                       {/* SETTINGS TABS */}
                       <div className="flex gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
                           <button 
                             onClick={() => setBotTab('CONFIG')}
                             className={cn("flex-1 py-2 text-[10px] font-bold rounded transition-colors flex items-center justify-center gap-2", botTab === 'CONFIG' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300")}
                           >
                               <Settings2 className="h-3 w-3" /> ESTRATÉGIA
                           </button>
                           <button 
                             onClick={() => setBotTab('RISK')}
                             className={cn("flex-1 py-2 text-[10px] font-bold rounded transition-colors flex items-center justify-center gap-2", botTab === 'RISK' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300")}
                           >
                               <ShieldAlert className="h-3 w-3" /> RISCO / AGENDAMENTO
                           </button>
                       </div>

                       <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                           {botTab === 'CONFIG' && (
                               <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                   <div className="space-y-2">
                                       <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><DollarSign className="h-3 w-3" /> Stake (Valor da Entrada)</label>
                                       <input type="number" value={autoSettings.stake} onChange={(e) => setAutoSettings({...autoSettings, stake: Number(e.target.value)})} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg pl-4 text-white font-black text-lg focus:ring-2 focus:ring-yellow-500/50 outline-none" placeholder="10.00" />
                                   </div>
                                   
                                   <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                                       <h5 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Resumo da Sessão</h5>
                                       <div className="grid grid-cols-2 gap-2 text-center">
                                           <div className="bg-green-500/10 rounded p-2 border border-green-500/20">
                                               <span className="block text-xl font-bold text-green-500">{dailyStats.wins}</span>
                                               <span className="text-[9px] text-green-400 uppercase font-bold">Wins</span>
                                           </div>
                                           <div className="bg-red-500/10 rounded p-2 border border-red-500/20">
                                               <span className="block text-xl font-bold text-red-500">{dailyStats.losses}</span>
                                               <span className="text-[9px] text-red-400 uppercase font-bold">Losses</span>
                                           </div>
                                       </div>
                                   </div>
                               </div>
                           )}

                           {botTab === 'RISK' && (
                               <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                   <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3">
                                       <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Stop Strategy</span>
                                            <button onClick={() => setStopMode(prev => prev === 'FINANCIAL' ? 'QUANTITY' : 'FINANCIAL')} className="text-[9px] text-blue-400 font-bold bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                                                {stopMode === 'FINANCIAL' ? '$ FINANCEIRO' : '# QUANTIDADE'}
                                            </button>
                                       </div>
                                       
                                       {stopMode === 'FINANCIAL' ? (
                                           <div className="grid grid-cols-2 gap-3">
                                               <div>
                                                   <label className="text-[9px] text-slate-500 uppercase font-bold">Stop Win ($)</label>
                                                   <input type="number" value={autoSettings.stopWinValue} onChange={(e) => setAutoSettings({...autoSettings, stopWinValue: Number(e.target.value)})} className="w-full bg-slate-900 border border-green-800/50 rounded h-9 px-2 text-green-400 font-mono text-sm font-bold mt-1" />
                                               </div>
                                               <div>
                                                   <label className="text-[9px] text-slate-500 uppercase font-bold">Stop Loss ($)</label>
                                                   <input type="number" value={autoSettings.stopLossValue} onChange={(e) => setAutoSettings({...autoSettings, stopLossValue: Number(e.target.value)})} className="w-full bg-slate-900 border border-red-800/50 rounded h-9 px-2 text-red-400 font-mono text-sm font-bold mt-1" />
                                               </div>
                                           </div>
                                       ) : (
                                           <div className="grid grid-cols-2 gap-3">
                                               <div>
                                                   <label className="text-[9px] text-slate-500 uppercase font-bold">Meta Wins</label>
                                                   <input type="number" value={autoSettings.stopWinCount} onChange={(e) => setAutoSettings({...autoSettings, stopWinCount: Number(e.target.value)})} className="w-full bg-slate-900 border border-green-800/50 rounded h-9 px-2 text-green-400 font-mono text-sm font-bold mt-1" />
                                               </div>
                                               <div>
                                                   <label className="text-[9px] text-slate-500 uppercase font-bold">Max Loss</label>
                                                   <input type="number" value={autoSettings.stopLossCount} onChange={(e) => setAutoSettings({...autoSettings, stopLossCount: Number(e.target.value)})} className="w-full bg-slate-900 border border-red-800/50 rounded h-9 px-2 text-red-400 font-mono text-sm font-bold mt-1" />
                                               </div>
                                           </div>
                                       )}
                                   </div>
                                   
                                   <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3">
                                       <div className="flex items-center gap-2">
                                          <input type="checkbox" checked={autoSettings.scheduleEnabled} onChange={(e) => setAutoSettings({...autoSettings, scheduleEnabled: e.target.checked})} className="rounded border-slate-700 bg-slate-900 text-green-500" />
                                          <label className="text-[10px] font-bold text-slate-400 uppercase">Agendar Horário</label>
                                       </div>
                                       {autoSettings.scheduleEnabled && (
                                           <div className="grid grid-cols-2 gap-2 mt-2">
                                               <input type="time" value={autoSettings.startTime} onChange={(e) => setAutoSettings({...autoSettings, startTime: e.target.value})} className="bg-slate-900 border border-slate-800 rounded text-xs text-white px-2 py-1" />
                                               <input type="time" value={autoSettings.endTime} onChange={(e) => setAutoSettings({...autoSettings, endTime: e.target.value})} className="bg-slate-900 border border-slate-800 rounded text-xs text-white px-2 py-1" />
                                               <div className="col-span-2 flex justify-between gap-1 mt-1">
                                                  {[1,2,3,4,5].map(day => (
                                                      <button key={day} onClick={() => {
                                                          const days = autoSettings.activeDays.includes(day) 
                                                            ? autoSettings.activeDays.filter(d => d !== day)
                                                            : [...autoSettings.activeDays, day];
                                                          setAutoSettings({...autoSettings, activeDays: days});
                                                      }} className={cn("w-6 h-6 text-[9px] rounded font-bold transition-all", autoSettings.activeDays.includes(day) ? "bg-green-600 text-white shadow-lg shadow-green-500/20" : "bg-slate-800 text-slate-500")}>
                                                          {['D','S','T','Q','Q','S','S'][day]}
                                                      </button>
                                                  ))}
                                               </div>
                                           </div>
                                       )}
                                   </div>
                               </div>
                           )}
                       </div>

                       <Button 
                         onClick={() => setIsAutoRunning(!isAutoRunning)}
                         className={cn("w-full font-black h-12 text-sm shadow-xl transition-all", isAutoRunning ? "bg-red-600 hover:bg-red-700 shadow-red-500/20" : "bg-green-600 hover:bg-green-700 shadow-green-500/20")}
                       >
                           {isAutoRunning ? <><StopCircle className="mr-2 h-5 w-5" /> PARAR BOT</> : <><Play className="mr-2 h-5 w-5" /> INICIAR AUTO</>}
                       </Button>
                    </div>
                )}

                {/* --- MODO SCANNER --- */}
                {executionMode === 'SCANNER' && (
                    <div className="flex-1 flex flex-col text-center justify-center text-slate-500">
                        <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Scanner de Oportunidades</p>
                        <p className="text-xs">Em desenvolvimento para a próxima versão.</p>
                    </div>
                )}

             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
