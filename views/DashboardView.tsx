
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TrendingUp, TrendingDown, DollarSign, Activity, Lock, Zap, Clock, ShieldAlert, ChevronDown, Globe, Bitcoin, Box, Layers, BarChart3, Target, Flame, Bot, Play, Pause, CalendarClock, Timer, CalendarDays, Trophy, Hash, MousePointerClick, ArrowRight, XCircle, CheckCircle2 } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { analyzeMarket, Candle, AnalysisResult } from '../lib/analysis/engine';

// --- CONFIGURAÇÃO DE ATIVOS (DERIV FULL) ---
const AVAILABLE_ASSETS = [
  { id: 'R_100', name: 'Volatility 100 (1s)', basePrice: 1240.50, volatility: 2.0, type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'R_75', name: 'Volatility 75 (1s)', basePrice: 450.25, volatility: 1.5, type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'R_50', name: 'Volatility 50 (1s)', basePrice: 280.10, volatility: 0.8, type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'R_25', name: 'Volatility 25 (1s)', basePrice: 1050.00, volatility: 1.2, type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'R_10', name: 'Volatility 10 (1s)', basePrice: 1800.50, volatility: 1.0, type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'JUMP_10', name: 'Jump 10 Index', basePrice: 150.00, volatility: 3.5, type: 'synthetic', decimals: 2, group: 'Jump Indices' },
  { id: 'JUMP_25', name: 'Jump 25 Index', basePrice: 250.00, volatility: 3.0, type: 'synthetic', decimals: 2, group: 'Jump Indices' },
  { id: 'JUMP_50', name: 'Jump 50 Index', basePrice: 550.00, volatility: 2.5, type: 'synthetic', decimals: 2, group: 'Jump Indices' },
  { id: 'JUMP_75', name: 'Jump 75 Index', basePrice: 750.00, volatility: 2.0, type: 'synthetic', decimals: 2, group: 'Jump Indices' },
  { id: 'JUMP_100', name: 'Jump 100 Index', basePrice: 1050.00, volatility: 1.8, type: 'synthetic', decimals: 2, group: 'Jump Indices' },
  { id: 'CRASH_1000', name: 'Crash 1000 Index', basePrice: 6000.00, volatility: 4.0, type: 'synthetic', decimals: 2, group: 'Crash/Boom' },
  { id: 'BOOM_1000', name: 'Boom 1000 Index', basePrice: 12000.00, volatility: 4.0, type: 'synthetic', decimals: 2, group: 'Crash/Boom' },
  { id: 'frxEURUSD', name: 'EUR/USD', basePrice: 1.0850, volatility: 0.00015, type: 'forex', decimals: 5, group: 'Forex Majors' },
  { id: 'frxGBPUSD', name: 'GBP/USD', basePrice: 1.2730, volatility: 0.00020, type: 'forex', decimals: 5, group: 'Forex Majors' },
  { id: 'frxUSDJPY', name: 'USD/JPY', basePrice: 155.40, volatility: 0.05, type: 'forex', decimals: 3, group: 'Forex Majors' },
  { id: 'frxXAUUSD', name: 'Gold / USD', basePrice: 2350.00, volatility: 1.5, type: 'commodities', decimals: 2, group: 'Commodities' },
  { id: 'cryBTCUSD', name: 'BTC/USD', basePrice: 64250.00, volatility: 45.0, type: 'crypto', decimals: 2, group: 'Cryptocurrencies' },
  { id: 'cryETHUSD', name: 'ETH/USD', basePrice: 3450.00, volatility: 5.0, type: 'crypto', decimals: 2, group: 'Cryptocurrencies' },
];

interface AssetRanking {
    id: string;
    name: string;
    winRate: number;
    direction: 'CALL' | 'PUT';
    score: number;
}

export function DashboardView() {
  const [balance, setBalance] = useState(1240.50);
  const [activeAsset, setActiveAsset] = useState(AVAILABLE_ASSETS[0]);
  const [stake, setStake] = useState(10);
  const [timeframe, setTimeframe] = useState('M1');
  
  // Estado da Análise
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [currentPrice, setCurrentPrice] = useState(activeAsset.basePrice);
  const [candles, setCandles] = useState<Candle[]>([]);

  // --- GERENCIAMENTO DE RISCO SNIPER ---
  const [dailyStats, setDailyStats] = useState({ trades: 0, wins: 0, losses: 0, profit: 0 });
  
  // --- MODO DE EXECUÇÃO ---
  const [executionMode, setExecutionMode] = useState<'MANUAL' | 'AUTO' | 'SCANNER'>('MANUAL');
  
  // --- CONFIGURAÇÃO BOT ---
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [botStatus, setBotStatus] = useState<'IDLE' | 'RUNNING' | 'WAITING_SCHEDULE' | 'STOPPED_BY_RISK'>('IDLE');
  
  // Estratégia de Parada (Stop Strategy)
  const [stopMode, setStopMode] = useState<'FINANCIAL' | 'QUANTITY'>('FINANCIAL');
  
  const [autoSettings, setAutoSettings] = useState({
      stake: 5.0,
      
      // Stop Financeiro
      stopWinValue: 20.0,
      stopLossValue: 15.0,
      
      // Stop Quantidade (Novo)
      stopWinCount: 2,  // Parar após X vitórias
      stopLossCount: 1, // Parar após Y derrotas

      // Agendamento
      scheduleEnabled: false,
      startTime: '09:00',
      endTime: '17:00',
      activeDays: [1, 2, 3, 4, 5] // 0=Dom, 1=Seg, ..., 6=Sab
  });

  // --- MARKET SCANNER (RANKING) ---
  const [marketRanking, setMarketRanking] = useState<AssetRanking[]>([]);

  // Configuração Global Manual
  const RISK_CONFIG = { maxTrades: 10, stopWin: 100.00, stopLoss: -50.00 };
  const isManualLocked = dailyStats.trades >= RISK_CONFIG.maxTrades || dailyStats.profit >= RISK_CONFIG.stopWin || dailyStats.profit <= RISK_CONFIG.stopLoss;

  // Verifica se o Bot deve parar
  const isAutoLocked = () => {
    if (stopMode === 'QUANTITY') {
        // Nova Lógica: Para se atingir X vitórias OU Y derrotas
        return dailyStats.wins >= autoSettings.stopWinCount || dailyStats.losses >= autoSettings.stopLossCount;
    } else {
        // Lógica Financeira
        return dailyStats.profit >= autoSettings.stopWinValue || dailyStats.profit <= -Math.abs(autoSettings.stopLossValue);
    }
  };

  const lastAutoTradeTimestamp = useRef<number>(0);
  const lastCandleCreationRef = useRef<number>(Date.now());

  // Simulação de Mercado
  useEffect(() => {
    setCandles([]); setAnalysis(null); lastCandleCreationRef.current = Date.now();
    const candleDuration = timeframe === 'M1' ? 60000 : timeframe === 'M5' ? 300000 : 900000;
    
    // Inicialização do Histórico
    const initialCandles: Candle[] = [];
    let price = activeAsset.basePrice;
    const now = Date.now();
    const volatilityMultiplier = (timeframe === 'M1' ? 1 : timeframe === 'M5' ? 2.5 : 5) * activeAsset.volatility;

    for (let i = 80; i > 0; i--) {
      const open = price;
      const move = (Math.random() - 0.5) * 5 * volatilityMultiplier;
      const close = price + move;
      initialCandles.push({
        time: now - (i * candleDuration),
        open, close,
        high: Math.max(open, close) + (Math.random() * volatilityMultiplier * 0.5),
        low: Math.min(open, close) - (Math.random() * volatilityMultiplier * 0.5)
      });
      price = close;
    }
    setCandles(initialCandles);
    setCurrentPrice(price);

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const shouldCreateNewCandle = currentTime - lastCandleCreationRef.current >= candleDuration;
      const tickVolatility = (timeframe === 'M1' ? 0.8 : 2) * activeAsset.volatility;
      const change = (Math.random() - 0.5) * tickVolatility;

      setCandles(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        let newHistory = [...prev];

        if (shouldCreateNewCandle) {
            const newCandle: Candle = {
                time: currentTime, open: last.close, close: last.close + change,
                high: Math.max(last.close, last.close + change), low: Math.min(last.close, last.close + change)
            };
            newHistory = [...prev.slice(1), newCandle]; 
            lastCandleCreationRef.current = currentTime;
            setCurrentPrice(newCandle.close);
        } else {
            const newClose = last.close + change;
            const updatedLast = { 
                ...last, close: newClose,
                high: Math.max(last.high, newClose), low: Math.min(last.low, newClose) 
            };
            newHistory = [...prev.slice(0, -1), updatedLast];
            setCurrentPrice(newClose);
        }

        const result = analyzeMarket(newHistory);
        setAnalysis(result);
        return newHistory;
      });
    }, 1000); 

    return () => clearInterval(interval);
  }, [timeframe, activeAsset]);

  // --- GERADOR DE RANKING FAKE ---
  useEffect(() => {
    const rankingInterval = setInterval(() => {
        const sorted = [...AVAILABLE_ASSETS]
            .map(asset => ({
                id: asset.id,
                name: asset.name,
                winRate: Math.floor(Math.random() * (98 - 70) + 70),
                direction: Math.random() > 0.5 ? 'CALL' : 'PUT' as 'CALL' | 'PUT',
                score: Math.floor(Math.random() * 100)
            }))
            .sort((a, b) => b.winRate - a.winRate)
            .slice(0, 5); 
        setMarketRanking(sorted);
    }, 10000);

    return () => clearInterval(rankingInterval);
  }, []);

  // --- LÓGICA DO BOT AUTOMÁTICO ---
  useEffect(() => {
      if (!isAutoRunning || executionMode !== 'AUTO') {
          setBotStatus('IDLE');
          return;
      }

      if (autoSettings.scheduleEnabled) {
          const now = new Date();
          const currentDay = now.getDay();
          
          if (!autoSettings.activeDays.includes(currentDay)) {
             setBotStatus('WAITING_SCHEDULE');
             return;
          }

          const [startHour, startMin] = autoSettings.startTime.split(':').map(Number);
          const [endHour, endMin] = autoSettings.endTime.split(':').map(Number);
          const start = new Date(now).setHours(startHour, startMin, 0, 0);
          const end = new Date(now).setHours(endHour, endMin, 0, 0);
          const current = now.getTime();

          if (current < start || current > end) {
              setBotStatus('WAITING_SCHEDULE');
              return;
          }
      }

      if (isAutoLocked()) {
          setBotStatus('STOPPED_BY_RISK');
          // Opcional: Desligar o bot automaticamente ao bater meta
          // setIsAutoRunning(false); 
          return;
      }

      setBotStatus('RUNNING');

      if (analysis && analysis.isSniperReady) {
          if (analysis.timestamp <= lastAutoTradeTimestamp.current) return;

          if (analysis.direction === 'CALL' || analysis.direction === 'PUT') {
              handleTrade(analysis.direction, autoSettings.stake);
              lastAutoTradeTimestamp.current = analysis.timestamp;
          }
      }
  }, [analysis, isAutoRunning, executionMode, dailyStats, autoSettings, stopMode]);


  const handleTrade = (type: 'CALL' | 'PUT', tradeStake = stake) => {
      if (executionMode === 'MANUAL' && isManualLocked) return;

      const isWin = Math.random() > 0.4;
      const profit = isWin ? tradeStake * 0.95 : -tradeStake;
      const newStats = {
          trades: dailyStats.trades + 1,
          wins: isWin ? dailyStats.wins + 1 : dailyStats.wins,
          losses: !isWin ? dailyStats.losses + 1 : dailyStats.losses,
          profit: dailyStats.profit + profit
      };
      setDailyStats(newStats);
      setBalance(prev => prev + profit);
  };

  const getAssetIcon = (type: string) => {
    switch(type) {
      case 'crypto': return <Bitcoin className="h-5 w-5 text-orange-500" />;
      case 'forex': return <Globe className="h-5 w-5 text-blue-500" />;
      case 'commodities': return <Box className="h-5 w-5 text-yellow-500" />;
      case 'synthetic': return <Activity className="h-5 w-5 text-purple-500" />;
      default: return <Flame className="h-5 w-5 text-red-500" />;
    }
  };

  const toggleDay = (dayIndex: number) => {
      if (isAutoRunning) return;
      const days = [...autoSettings.activeDays];
      if (days.includes(dayIndex)) {
          setAutoSettings({...autoSettings, activeDays: days.filter(d => d !== dayIndex)});
      } else {
          setAutoSettings({...autoSettings, activeDays: [...days, dayIndex]});
      }
  };

  const renderChart = () => {
    if (candles.length === 0) return <div className="h-full flex items-center justify-center text-slate-500">Carregando mercado...</div>;
    const minPrice = Math.min(...candles.map(c => c.low));
    const maxPrice = Math.max(...candles.map(c => c.high));
    const priceRange = maxPrice - minPrice || 1;
    const width = 800; const height = 350; const padding = 40; const usableHeight = height - (padding * 2);
    const candleWidth = (width / candles.length) * 0.7;
    const spacing = (width / candles.length);
    const formatPrice = (p: number) => p.toFixed(activeAsset.decimals);

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

        {candles.map((candle, index) => {
          const normalizeY = (val: number) => height - padding - ((val - minPrice) / priceRange) * usableHeight;
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
          <label className="text-[10px] uppercase font-bold text-slate-500 absolute -top-2 left-2 bg-slate-900 px-1 border border-slate-800 rounded">Ativo Selecionado</label>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {getAssetIcon(activeAsset.type)}
          </div>
          <select 
            value={activeAsset.id}
            onChange={(e) => setActiveAsset(AVAILABLE_ASSETS.find(a => a.id === e.target.value) || AVAILABLE_ASSETS[0])}
            className="w-full appearance-none bg-slate-950 text-slate-200 text-lg font-bold py-3 pl-12 pr-10 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all shadow-inner"
          >
            {['Derived Indices', 'Jump Indices', 'Crash/Boom', 'Forex Majors', 'Commodities', 'Cryptocurrencies'].map(group => (
              <optgroup key={group} label={group} className="bg-slate-900 text-slate-300">
                {AVAILABLE_ASSETS.filter(a => a.group === group).map(asset => (
                  <option key={asset.id} value={asset.id}>{asset.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 pointer-events-none" />
        </div>

        <div className="flex items-center gap-px bg-slate-950/80 text-white p-1 rounded-lg border border-slate-800 shadow-xl">
            <div className="px-5 py-2 border-r border-slate-800">
                <p className="text-[9px] uppercase text-slate-500 font-bold tracking-wider">Saldo Demo</p>
                <p className="text-sm font-bold text-green-400 font-mono tracking-tight">{formatCurrency(balance)}</p>
            </div>
            <div className="px-5 py-2 border-r border-slate-800">
                <p className="text-[9px] uppercase text-slate-500 font-bold tracking-wider">Meta do Dia</p>
                <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold font-mono ${dailyStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {dailyStats.profit >= 0 ? '+' : ''}{formatCurrency(dailyStats.profit)}
                    </p>
                    <span className="text-[10px] text-slate-600 font-mono">/ {stopMode === 'FINANCIAL' ? formatCurrency(autoSettings.stopWinValue) : '---'}</span>
                </div>
            </div>
            <div className="px-5 py-2">
                <p className="text-[9px] uppercase text-slate-500 font-bold tracking-wider">Stop Count</p>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-green-400" title="Vitórias">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="text-xs font-bold font-mono">{dailyStats.wins}</span>
                        {stopMode === 'QUANTITY' && <span className="text-[9px] text-slate-600">/{autoSettings.stopWinCount}</span>}
                    </div>
                    <div className="w-px h-3 bg-slate-700"></div>
                    <div className="flex items-center gap-1 text-red-400" title="Derrotas">
                        <XCircle className="h-3 w-3" />
                        <span className="text-xs font-bold font-mono">{dailyStats.losses}</span>
                        {stopMode === 'QUANTITY' && <span className="text-[9px] text-slate-600">/{autoSettings.stopLossCount}</span>}
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-220px)]">
        {/* --- COLUNA PRINCIPAL (GRÁFICO) --- */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-4 h-full">
          <Card className="flex-1 flex flex-col bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
            <div className="flex flex-row items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-slate-400" />
                <span className="font-bold text-slate-300">Análise Gráfica</span>
              </div>
              <div className="flex bg-slate-950 rounded-md border border-slate-800 p-1">
                {['M1', 'M5', 'M15'].map((tf) => (
                  <button 
                    key={tf} 
                    onClick={() => setTimeframe(tf)} 
                    className={cn(
                        "px-3 py-1 text-xs font-bold rounded transition-colors",
                        timeframe === tf ? "bg-slate-800 text-white shadow-sm border border-slate-700" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 bg-slate-950 p-4 relative">
                {renderChart()}
                <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1 bg-slate-900/90 rounded backdrop-blur-sm text-xs text-green-400 border border-slate-800 shadow-lg">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Mercado Aberto
                </div>
            </div>
          </Card>

          {/* --- PAINEL DE SINAL (SNIPER) --- */}
          <Card className={cn(
              "border-l-4 shadow-xl transition-all h-[200px] bg-slate-900 border-t border-r border-b border-slate-800",
              analysis?.isSniperReady 
                ? (analysis.direction === 'CALL' ? 'border-l-green-500 bg-green-950/10' : 'border-l-red-500 bg-red-950/10') 
                : 'border-l-slate-700'
          )}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2.5 rounded-lg shadow-inner", analysis?.isSniperReady ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" : "bg-slate-800 text-slate-500 border border-slate-700")}>
                        <Zap className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-base font-bold text-slate-200">Sniper IA <span className="text-xs text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded ml-1 border border-slate-800">PRO</span></CardTitle>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Algoritmo v3.2</p>
                    </div>
                  </div>
                  {analysis?.isSniperReady && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-950 bg-green-400 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(74,222,128,0.4)] animate-pulse">
                          <Target className="h-3.5 w-3.5" />
                          ENTRADA CONFIRMADA
                      </div>
                  )}
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {analysis ? (
                <div className="flex items-center justify-between gap-8">
                  <div className="flex flex-col items-center min-w-[140px] border-r border-slate-800 pr-4">
                      <span className="text-[10px] font-bold uppercase text-slate-500 mb-1">Recomendação</span>
                      <div className={cn(
                          "text-4xl font-black tracking-tighter flex items-center gap-2 filter drop-shadow-lg",
                          analysis.direction === 'CALL' ? 'text-green-500' : 
                          analysis.direction === 'PUT' ? 'text-red-500' : 'text-slate-600'
                      )}>
                          {analysis.direction === 'CALL' && <TrendingUp className="h-8 w-8" />}
                          {analysis.direction === 'PUT' && <TrendingDown className="h-8 w-8" />}
                          {analysis.direction === 'NEUTRO' && <Lock className="h-8 w-8" />}
                          {analysis.direction}
                      </div>
                  </div>
                  <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-500 mb-2">Assertividade</span>
                      <div className="relative h-16 w-16 flex items-center justify-center">
                          <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90">
                              <circle cx="32" cy="32" r="28" stroke="#1e293b" strokeWidth="6" fill="none" />
                              <circle 
                                cx="32" cy="32" r="28" stroke={analysis.probability >= 80 ? "#22c55e" : "#3b82f6"} strokeWidth="6" fill="none" 
                                strokeDasharray={175} strokeDashoffset={175 - (175 * analysis.probability) / 100}
                                className="transition-all duration-1000 ease-out"
                                strokeLinecap="round"
                              />
                          </svg>
                          <span className={cn("text-sm font-bold", analysis.probability >= 80 ? "text-green-400" : "text-blue-400")}>{analysis.probability}%</span>
                      </div>
                  </div>
                  <div className="flex-1 h-[100px] overflow-y-auto pr-2 border-l border-slate-800 pl-6 space-y-2 scrollbar-thin scrollbar-thumb-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500 sticky top-0 bg-slate-900 block pb-1">Confluências</span>
                    {analysis.factors.map((factor, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs border-b border-slate-800/50 pb-1 last:border-0">
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", 
                            factor.status === 'POSITIVE' ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 
                            factor.status === 'NEGATIVE' ? 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'bg-slate-600'
                        )} />
                        <span className="text-slate-300 font-medium leading-tight">{factor.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div className="text-center py-8 text-slate-600 animate-pulse">Calibrando IA...</div>}
            </CardContent>
          </Card>
        </div>

        {/* --- COLUNA LATERAL (EXECUÇÃO COM ABAS) --- */}
        <div className="col-span-12 lg:col-span-3 h-full">
          <Card className="h-full flex flex-col bg-slate-900 shadow-xl border-slate-800 relative overflow-hidden">
             
             {/* TABS HEADER */}
             <div className="grid grid-cols-3 border-b border-slate-800">
                <button onClick={() => setExecutionMode('MANUAL')} className={cn("p-3 text-xs font-bold transition-colors border-b-2", executionMode === 'MANUAL' ? "text-white border-green-500 bg-slate-800" : "text-slate-500 border-transparent hover:text-slate-300")}>
                    <Layers className="h-4 w-4 mx-auto mb-1" /> MANUAL
                </button>
                <button onClick={() => setExecutionMode('AUTO')} className={cn("p-3 text-xs font-bold transition-colors border-b-2", executionMode === 'AUTO' ? "text-white border-yellow-500 bg-slate-800" : "text-slate-500 border-transparent hover:text-slate-300")}>
                    <Bot className="h-4 w-4 mx-auto mb-1" /> BOT
                </button>
                <button onClick={() => setExecutionMode('SCANNER')} className={cn("p-3 text-xs font-bold transition-colors border-b-2", executionMode === 'SCANNER' ? "text-white border-purple-500 bg-slate-800" : "text-slate-500 border-transparent hover:text-slate-300")}>
                    <Trophy className="h-4 w-4 mx-auto mb-1" /> RANK
                </button>
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
                            <Button className="h-full bg-green-600 hover:bg-green-500 text-xl font-black" onClick={() => handleTrade('CALL')}>CALL</Button>
                            <Button className="h-full bg-red-600 hover:bg-red-500 text-xl font-black" onClick={() => handleTrade('PUT')}>PUT</Button>
                        </div>
                    </div>
                )}

                {/* --- MODO AUTOMÁTICO --- */}
                {executionMode === 'AUTO' && (
                    <div className="space-y-6 flex-1 flex flex-col">
                        <div className={cn("border rounded-lg p-3 text-xs mb-2 flex items-center gap-2", botStatus === 'RUNNING' ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-slate-800/50 border-slate-700 text-slate-400")}>
                            {botStatus === 'RUNNING' ? <Activity className="h-3 w-3 animate-pulse" /> : <Bot className="h-3 w-3" />}
                            <span className="font-bold">Status: {botStatus}</span>
                        </div>

                        {/* SELETOR DE ESTRATÉGIA DE STOP */}
                        <div className="bg-slate-950 p-1 rounded-lg grid grid-cols-2 border border-slate-800">
                            <button onClick={() => setStopMode('FINANCIAL')} className={cn("py-1.5 text-[10px] font-bold rounded uppercase", stopMode === 'FINANCIAL' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500")}>$ Financeiro</button>
                            <button onClick={() => setStopMode('QUANTITY')} className={cn("py-1.5 text-[10px] font-bold rounded uppercase", stopMode === 'QUANTITY' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500")}># Quantidade</button>
                        </div>

                        {stopMode === 'FINANCIAL' ? (
                            <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-left-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-400 uppercase">Stop Loss ($)</label>
                                    <input type="number" value={Math.abs(autoSettings.stopLossValue)} onChange={(e) => setAutoSettings({...autoSettings, stopLossValue: -Math.abs(Number(e.target.value))})} className="w-full h-9 px-2 bg-slate-950 border border-slate-800 rounded text-red-400 font-bold" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-400 uppercase">Stop Win ($)</label>
                                    <input type="number" value={autoSettings.stopWinValue} onChange={(e) => setAutoSettings({...autoSettings, stopWinValue: Number(e.target.value)})} className="w-full h-9 px-2 bg-slate-950 border border-slate-800 rounded text-green-400 font-bold" />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-right-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-400 uppercase">Meta de Wins</label>
                                    <div className="relative">
                                        <CheckCircle2 className="absolute left-2 top-2 h-3.5 w-3.5 text-green-500" />
                                        <input type="number" value={autoSettings.stopWinCount} onChange={(e) => setAutoSettings({...autoSettings, stopWinCount: Number(e.target.value)})} className="w-full h-9 pl-7 bg-slate-950 border border-slate-800 rounded text-white font-bold" />
                                    </div>
                                    <p className="text-[9px] text-slate-600">Parar após {autoSettings.stopWinCount} vitórias</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-400 uppercase">Limite de Loss</label>
                                    <div className="relative">
                                        <XCircle className="absolute left-2 top-2 h-3.5 w-3.5 text-red-500" />
                                        <input type="number" value={autoSettings.stopLossCount} onChange={(e) => setAutoSettings({...autoSettings, stopLossCount: Number(e.target.value)})} className="w-full h-9 pl-7 bg-slate-950 border border-slate-800 rounded text-white font-bold" />
                                    </div>
                                    <p className="text-[9px] text-slate-600">Parar após {autoSettings.stopLossCount} derrotas</p>
                                </div>
                            </div>
                        )}

                        {/* SCHEDULER */}
                        <div className="space-y-3 pt-4 border-t border-slate-800">
                             <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Agendamento</h4>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={autoSettings.scheduleEnabled} onChange={(e) => setAutoSettings({...autoSettings, scheduleEnabled: e.target.checked})} className="sr-only peer" />
                                  <div className="w-7 h-4 bg-slate-800 rounded-full peer peer-checked:bg-yellow-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all"></div>
                                </label>
                            </div>
                            
                            {autoSettings.scheduleEnabled && (
                                <div className="space-y-3">
                                    <div className="flex justify-between gap-1">
                                        {['D','S','T','Q','Q','S','S'].map((day, idx) => (
                                            <button key={idx} onClick={() => toggleDay(idx)} className={cn("w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all", autoSettings.activeDays.includes(idx) ? "bg-yellow-500 text-slate-900" : "bg-slate-800 text-slate-500 hover:bg-slate-700")}>{day}</button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="time" value={autoSettings.startTime} onChange={(e) => setAutoSettings({...autoSettings, startTime: e.target.value})} className="bg-slate-950 border border-slate-800 rounded text-xs px-2 py-1 text-white" />
                                        <input type="time" value={autoSettings.endTime} onChange={(e) => setAutoSettings({...autoSettings, endTime: e.target.value})} className="bg-slate-950 border border-slate-800 rounded text-xs px-2 py-1 text-white" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <Button className={cn("mt-auto h-12 font-black", isAutoRunning ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-yellow-500 hover:bg-yellow-600 text-slate-900")} onClick={() => setIsAutoRunning(!isAutoRunning)}>
                            {isAutoRunning ? "PARAR BOT" : "INICIAR BOT"}
                        </Button>
                    </div>
                )}

                {/* --- MODO SCANNER --- */}
                {executionMode === 'SCANNER' && (
                    <div className="space-y-4">
                        <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg text-xs text-purple-300">
                            <h4 className="font-bold flex items-center gap-2 mb-1"><Zap className="h-3 w-3" /> Scanner em Tempo Real</h4>
                            <p className="opacity-70">A IA analisa todos os ativos e rankeia as melhores oportunidades agora.</p>
                        </div>

                        <div className="space-y-2">
                            {marketRanking.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 text-xs">Escaneando mercado...</div>
                            ) : (
                                marketRanking.map((rank, idx) => (
                                    <div key={rank.id} onClick={() => setActiveAsset(AVAILABLE_ASSETS.find(a => a.id === rank.id) || AVAILABLE_ASSETS[0])} className="group bg-slate-950 border border-slate-800 hover:border-purple-500/50 p-3 rounded-lg cursor-pointer transition-all flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className={cn("text-xs font-black w-5 h-5 flex items-center justify-center rounded bg-slate-800 text-slate-400", idx === 0 && "bg-yellow-500 text-slate-900")}>#{idx + 1}</span>
                                            <div>
                                                <p className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">{rank.name}</p>
                                                <p className="text-[10px] text-slate-500 flex items-center gap-1">Win Rate: <span className="text-green-400">{rank.winRate}%</span></p>
                                            </div>
                                        </div>
                                        <div className={cn("text-[10px] font-bold px-2 py-1 rounded", rank.direction === 'CALL' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                                            {rank.direction}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
