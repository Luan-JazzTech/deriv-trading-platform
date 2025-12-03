import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TrendingUp, TrendingDown, DollarSign, Activity, Lock, Zap, Clock, ShieldAlert, ChevronDown, Globe, Bitcoin, Box, Layers, BarChart3, Target, Flame, Bot, Play, Pause, CalendarClock, Timer, CalendarDays, Trophy, Hash, MousePointerClick, ArrowRight, XCircle, CheckCircle2, AlertTriangle, Wallet, Timer as TimerIcon, StopCircle, Settings2, Sliders, Hourglass, ArrowUpRight, ArrowDownRight, RefreshCcw, Search, Brain, Zap as Lightning, TrendingUp as TrendUp } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { analyzeMarket, Candle, AnalysisResult } from '../lib/analysis/engine';
import { derivApi } from '../lib/deriv/api';
import { supabase } from '../lib/supabase';

// === IMPORTS DO SISTEMA PROFISSIONAL ===
import { 
    getAssetInfo, 
    formatDurationForAPI 
} from '../lib/deriv/durations';

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
    type: string;
    direction: 'CALL' | 'PUT' | 'NEUTRO';
    probability: number;
    score: number;
}

// NOVO: Interface para monitoramento em tempo real
interface AssetMonitor {
    id: string;
    name: string;
    status: 'ANALYZING' | 'APPROVED' | 'REJECTED' | 'COOLDOWN' | 'OPERATING';
    direction?: 'CALL' | 'PUT' | 'NEUTRO';
    probability?: number;
    score?: number;
    rejectReason?: string;
    lastAnalysis: number; // timestamp
    cooldownEnds?: number; // timestamp
}

interface DecisionLog {
    timestamp: number;
    asset: string;
    decision: 'APPROVED' | 'REJECTED' | 'COOLDOWN';
    direction?: 'CALL' | 'PUT';
    reason: string;
    probability?: number;
    score?: number;
}

interface TradeActivity {
    id: number;
    asset: string;
    time: string;
    type: 'CALL' | 'PUT';
    amount: number;
    status: 'PENDING' | 'WIN' | 'LOSS';
    profit?: number;
    potentialProfit?: number;
    startTime: number;
    totalDurationSeconds: number; 
    expiryTime?: number;
    entryPrice?: number;
    currentPrice?: number;
    exitPrice?: number;
    isWinning?: boolean;
    source: 'MANUAL' | 'BOT'; // NOVO: Identificar origem do trade
}

interface AccountInfo {
    balance: number;
    currency: string;
    isVirtual: boolean;
    email: string;
}

// --- MELHORIAS DO BOT: Sistema de Gerenciamento Avançado ---
interface BotMetrics {
    consecutiveWins: number;
    consecutiveLosses: number;
    lastTradeResult: 'WIN' | 'LOSS' | null;
    hourlyTrades: number;
    lastHourReset: number;
}

// Modo Martingale Opcional
interface MartingaleConfig {
    enabled: boolean;
    multiplier: number; // Ex: 2.0 = dobra o stake após loss
    maxLevel: number; // Ex: 3 = permite até 3 martingales
    currentLevel: number;
    resetOnWin: boolean;
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
  const [, setTick] = useState(0);

  // --- MODO DE EXECUÇÃO ---
  const [executionMode, setExecutionMode] = useState<'MANUAL' | 'AUTO' | 'SCANNER'>('MANUAL');
  
  // --- CONFIGURAÇÃO BOT MELHORADA ---
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [botStatus, setBotStatus] = useState<'IDLE' | 'RUNNING' | 'WAITING_SCHEDULE' | 'STOPPED_BY_RISK' | 'WAITING_COOLDOWN' | 'ANALYZING'>('IDLE');
  const [botTab, setBotTab] = useState<'CONFIG' | 'RISK' | 'ADVANCED' | 'MONITOR'>('CONFIG');
  const [botLogs, setBotLogs] = useState<string[]>([]);

  const [stopMode, setStopMode] = useState<'FINANCIAL' | 'QUANTITY'>('FINANCIAL');
  
  // --- NOVAS CONFIGURAÇÕES DO BOT ---
  const [autoSettings, setAutoSettings] = useState({
      stake: 1.0,
      stopWinValue: 10.0,
      stopLossValue: 5.0,
      stopWinCount: 5, 
      stopLossCount: 3,
      scheduleEnabled: false,
      startTime: '09:00',
      endTime: '17:00',
      activeDays: [1, 2, 3, 4, 5], // 1=Seg, 5=Sex
      
      // NOVO: Filtros de Qualidade
      minProbability: 75, // Só opera sinais com 75%+
      minScore: 50, // Score mínimo do sinal
      
      // NOVO: Cooldown entre trades
      tradeCooldownSeconds: 60, // Espera 60s entre trades
      
      // NOVO: Limite de trades por hora
      maxTradesPerHour: 10,
      
      // NOVO: Modo conservador (só opera com confluência máxima)
      conservativeMode: false,
  });

  // --- MARTINGALE (OPCIONAL - ALTO RISCO) ---
  const [martingaleConfig, setMartingaleConfig] = useState<MartingaleConfig>({
      enabled: false,
      multiplier: 2.0,
      maxLevel: 3,
      currentLevel: 0,
      resetOnWin: true
  });

  // --- MÉTRICAS DO BOT ---
  const [botMetrics, setBotMetrics] = useState<BotMetrics>({
      consecutiveWins: 0,
      consecutiveLosses: 0,
      lastTradeResult: null,
      hourlyTrades: 0,
      lastHourReset: Date.now()
  });

  const [marketRanking, setMarketRanking] = useState<AssetRanking[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // --- MONITOR EM TEMPO REAL ---
  const [assetMonitors, setAssetMonitors] = useState<Map<string, AssetMonitor>>(new Map());
  const [decisionLogs, setDecisionLogs] = useState<DecisionLog[]>([]);
  const [monitorStats, setMonitorStats] = useState({
      analyzed: 0,
      approved: 0,
      rejected: 0,
      lastMinuteAnalyzed: 0
  });

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
  const lastTradeTime = useRef<number>(0);

  const addBotLog = (msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️';
      setBotLogs(prev => [`${icon} [${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
  };

  // NOVO: Registrar decisão do bot no monitor
  const logDecision = (asset: string, decision: 'APPROVED' | 'REJECTED' | 'COOLDOWN', reason: string, analysis?: AnalysisResult) => {
      const log: DecisionLog = {
          timestamp: Date.now(),
          asset,
          decision,
          reason,
          direction: analysis?.direction !== 'NEUTRO' ? analysis?.direction : undefined,
          probability: analysis?.probability,
          score: analysis?.score
      };
      
      setDecisionLogs(prev => [log, ...prev].slice(0, 50)); // Mantém últimas 50 decisões
      
      setMonitorStats(prev => ({
          ...prev,
          analyzed: prev.analyzed + 1,
          approved: prev.approved + (decision === 'APPROVED' ? 1 : 0),
          rejected: prev.rejected + (decision === 'REJECTED' ? 1 : 0)
      }));
  };
  
  // --- TIMER GLOBAL PARA UI DE PROGRESSO ---
  useEffect(() => {
    const interval = setInterval(() => {
        setTick(t => t + 1);
        
        // Reset contador horário
        const now = Date.now();
        if (now - botMetrics.lastHourReset > 3600000) { // 1 hora
            setBotMetrics(prev => ({ ...prev, hourlyTrades: 0, lastHourReset: now }));
            addBotLog('Contador de trades por hora resetado', 'info');
        }
    }, 500);
    return () => clearInterval(interval);
  }, [botMetrics.lastHourReset]);

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

  // --- LÓGICA DO BOT AUTOMÁTICO MELHORADA ---
  useEffect(() => {
      if (!isAutoRunning || executionMode !== 'AUTO') {
          setBotStatus('IDLE');
          return;
      }
      
      // 1. Verificar agendamento
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
      
      // 2. Verificar stop loss/win
      if (isAutoLocked()) { 
          setBotStatus('STOPPED_BY_RISK'); 
          setIsAutoRunning(false); 
          addBotLog(`🛑 STOP ATINGIDO! ${stopMode === 'FINANCIAL' ? `Lucro: ${formatCurrency(dailyStats.profit)}` : `Wins: ${dailyStats.wins} | Losses: ${dailyStats.losses}`}`, 'warning');
          return; 
      }
      
      // 3. Verificar limite de trades por hora
      if (botMetrics.hourlyTrades >= autoSettings.maxTradesPerHour) {
          setBotStatus('WAITING_COOLDOWN');
          return;
      }
      
      // 4. Verificar cooldown entre trades
      const now = Date.now();
      const timeSinceLastTrade = (now - lastTradeTime.current) / 1000; // segundos
      if (timeSinceLastTrade < autoSettings.tradeCooldownSeconds) {
          setBotStatus('WAITING_COOLDOWN');
          return;
      }
      
      // 5. Verificar sinal
      if (!analysis) {
          setBotStatus('ANALYZING');
          return;
      }
      
      setBotStatus('RUNNING');
      
      // 6. Filtros de qualidade do sinal
      if (analysis.isSniperReady) {
          // Verificar se já operou nesta vela
          if (analysis.timestamp <= lastAutoTradeTimestamp.current) return;
          
          // Verificar cooldown manual
          if (cooldown > 0) return;

          // Filtro de probabilidade mínima
          if (analysis.probability < autoSettings.minProbability) {
              const reason = `Probabilidade ${analysis.probability}% < ${autoSettings.minProbability}% (mínimo)`;
              logDecision(activeAsset.name, 'REJECTED', reason, analysis);
              addBotLog(`⏭️ Sinal ignorado: ${reason}`, 'info');
              return;
          }
          
          // Filtro de score mínimo
          if (analysis.score < autoSettings.minScore) {
              const reason = `Score ${analysis.score} < ${autoSettings.minScore} (mínimo)`;
              logDecision(activeAsset.name, 'REJECTED', reason, analysis);
              addBotLog(`⏭️ Sinal ignorado: ${reason}`, 'info');
              return;
          }
          
          // Modo conservador: exige confluência máxima
          if (autoSettings.conservativeMode && analysis.probability < 85) {
              const reason = `Modo Conservador: ${analysis.probability}% < 85% requerido`;
              logDecision(activeAsset.name, 'REJECTED', reason, analysis);
              addBotLog(`🛡️ ${reason}`, 'info');
              return;
          }

          // Verificar se deve evitar após losses consecutivas
          if (botMetrics.consecutiveLosses >= 3 && !martingaleConfig.enabled) {
              const reason = '3 losses consecutivas - Pausando';
              logDecision(activeAsset.name, 'REJECTED', reason, analysis);
              addBotLog(`⚠️ PAUSANDO: 3 losses consecutivas. Aguardando mercado estabilizar...`, 'warning');
              setCooldown(120); // 2 minutos de pausa
              return;
          }

          if (analysis.direction === 'CALL' || analysis.direction === 'PUT') {
              // Calcular stake (com Martingale se habilitado)
              let tradeStake = autoSettings.stake;
              
              if (martingaleConfig.enabled && martingaleConfig.currentLevel > 0) {
                  tradeStake = autoSettings.stake * Math.pow(martingaleConfig.multiplier, martingaleConfig.currentLevel);
                  
                  // Verificar limite de martingale
                  if (martingaleConfig.currentLevel >= martingaleConfig.maxLevel) {
                      addBotLog(`🚫 Martingale máximo atingido. Resetando para stake base.`, 'warning');
                      setMartingaleConfig(prev => ({ ...prev, currentLevel: 0 }));
                      tradeStake = autoSettings.stake;
                  }
                  
                  // Verificar se tem saldo suficiente
                  if (accountInfo && tradeStake > accountInfo.balance * 0.1) { // Max 10% do saldo por trade
                      addBotLog(`⚠️ Stake muito alto (${formatCurrency(tradeStake)}). Usando 10% do saldo.`, 'warning');
                      tradeStake = accountInfo.balance * 0.1;
                  }
              }
              
              const reason = `Sinal APROVADO - Prob: ${analysis.probability}%, Score: ${analysis.score}`;
              logDecision(activeAsset.name, 'APPROVED', reason, analysis);
              addBotLog(`🎯 EXECUTANDO ${analysis.direction} | Prob: ${analysis.probability}% | Score: ${analysis.score} | Stake: ${formatCurrency(tradeStake)}`, 'success');
              handleTrade(analysis.direction, tradeStake);
              lastAutoTradeTimestamp.current = analysis.timestamp;
              lastTradeTime.current = Date.now();
              
              // Incrementar contador horário
              setBotMetrics(prev => ({ ...prev, hourlyTrades: prev.hourlyTrades + 1 }));
          }
      }
  }, [analysis, isAutoRunning, executionMode, dailyStats, autoSettings, stopMode, cooldown, botMetrics, martingaleConfig, accountInfo]);


  const handleTrade = async (type: 'CALL' | 'PUT', tradeStake = stake) => {
      if (executionMode === 'MANUAL' && isManualLocked) {
          alert("Limite de trades manuais atingido!");
          return;
      }
      if (!isConnected) { alert('Conecte a API nas configurações!'); return; }
      if (cooldown > 0) return;

      setTradeLoading(true);

      try {
          // === CORREÇÃO: USAR DURAÇÃO CORRETA POR ATIVO ===
          const assetInfo = getAssetInfo(activeAsset.id);
          if (!assetInfo) {
              console.error(`❌ Asset ${activeAsset.id} not found`);
              alert(`Erro: Ativo ${activeAsset.id} não configurado`);
              setTradeLoading(false);
              return;
          }
          
          const duration = formatDurationForAPI(activeAsset.id);
          console.log(`✅ Usando duração: ${duration} para ${activeAsset.name}`);
          
          // Converter duration para número e unit
          const durationMatch = duration.match(/^(\d+)([tsmh])$/);
          if (!durationMatch) {
              console.error(`❌ Formato de duração inválido: ${duration}`);
              setTradeLoading(false);
              return;
          }
          
          const durationValue = parseInt(durationMatch[1]);
          const durationUnit = durationMatch[2];
          
          // Calcular duração em segundos para o timer local
          let durationSeconds = durationValue;
          if (durationUnit === 'm') durationSeconds = durationValue * 60;
          else if (durationUnit === 'h') durationSeconds = durationValue * 3600;
          else if (durationUnit === 't') durationSeconds = durationValue * 2; // Aproximação: 1 tick ≈ 2s
          // === FIM DA CORREÇÃO ===
          
          const response = await derivApi.buyContract(activeAsset.id, type, tradeStake, durationValue, durationUnit);

          if (response.error) {
              alert(`Erro na Deriv: ${response.error.message}`);
              if (isAutoRunning) addBotLog(`❌ ERRO DERIV: ${response.error.message}`, 'error');
              setTradeLoading(false);
              return;
          }

          const contractInfo = response.buy;
          const startTime = Date.now();
          
          // UI Optimistic Update
          setAccountInfo(prev => prev ? { ...prev, balance: prev.balance - tradeStake } : null);
          if (isAutoRunning) addBotLog(`📤 Ordem enviada! ID: ${contractInfo.contract_id}`, 'info');

          const newTrade: TradeActivity = {
              id: contractInfo.contract_id,
              asset: activeAsset.name,
              time: new Date().toLocaleTimeString(),
              type: type,
              amount: tradeStake,
              status: 'PENDING',
              startTime: startTime,
              totalDurationSeconds: durationSeconds,
              expiryTime: startTime + (durationSeconds * 1000),
              source: executionMode === 'AUTO' && isAutoRunning ? 'BOT' : 'MANUAL' // Identifica origem
          };
          setLiveTrades(prev => [newTrade, ...prev]);
          setCooldown(3); 

          // MONITORAR O CONTRATO ATÉ FECHAR
          derivApi.subscribeContract(contractInfo.contract_id, (update) => {
              
              setLiveTrades(prev => prev.map(t => {
                  if (t.id !== contractInfo.contract_id) return t;

                  const updatedTrade = { ...t };
                  if (update.date_expiry) updatedTrade.expiryTime = update.date_expiry * 1000;
                  if (update.entry_spot && !isNaN(update.entry_spot)) updatedTrade.entryPrice = Number(update.entry_spot);
                  if (update.current_spot && !isNaN(update.current_spot)) updatedTrade.currentPrice = Number(update.current_spot);
                  if (update.exit_tick && !isNaN(update.exit_tick)) updatedTrade.exitPrice = Number(update.exit_tick);
                  if (update.payout && !isNaN(update.payout)) updatedTrade.potentialProfit = Number(update.payout) - updatedTrade.amount;
                  
                  // IMPORTANTE: Em opções binárias, o status "isWinning" durante o trade
                  // é apenas uma estimativa. O que importa é o preço NO MOMENTO DA EXPIRAÇÃO.
                  // A API Deriv envia o status final via profit/is_sold.
                  
                  // Calcular status APENAS durante o trade (antes de finalizar)
                  if (!update.is_sold && updatedTrade.entryPrice && updatedTrade.currentPrice) {
                      if (updatedTrade.type === 'CALL') {
                          updatedTrade.isWinning = updatedTrade.currentPrice > updatedTrade.entryPrice;
                      } else {
                          updatedTrade.isWinning = updatedTrade.currentPrice < updatedTrade.entryPrice;
                      }
                  }

                  if (update.is_sold) {
                      const profit = Number(update.profit);
                      const status = profit >= 0 ? 'WIN' : 'LOSS';
                      
                      console.log(`🎯 TRADE FINALIZADO: ID ${contractInfo.contract_id}`, {
                          status,
                          profit,
                          exitPrice: update.exit_tick,
                          entryPrice: updatedTrade.entryPrice
                      });
                      
                      // Atualizar isWinning baseado no resultado REAL
                      updatedTrade.isWinning = status === 'WIN';
                      
                      // Garantir que exitPrice esteja setado
                      if (!updatedTrade.exitPrice && update.exit_tick) {
                          updatedTrade.exitPrice = Number(update.exit_tick);
                      }
                      // Fallback: usar currentPrice se exitPrice não veio
                      if (!updatedTrade.exitPrice && updatedTrade.currentPrice) {
                          updatedTrade.exitPrice = updatedTrade.currentPrice;
                      }
                      
                      if (t.status === 'PENDING') {
                         console.log(`📊 Atualizando dailyStats: +${profit}`);
                         setDailyStats(stats => ({
                             trades: stats.trades + 1,
                             wins: stats.wins + (profit >= 0 ? 1 : 0),
                             losses: stats.losses + (profit < 0 ? 1 : 0),
                             profit: stats.profit + profit
                         }));
                         
                         // Atualizar métricas do bot
                         setBotMetrics(prev => {
                             const newMetrics = { ...prev, lastTradeResult: status };
                             if (status === 'WIN') {
                                 newMetrics.consecutiveWins = prev.consecutiveWins + 1;
                                 newMetrics.consecutiveLosses = 0;
                             } else {
                                 newMetrics.consecutiveLosses = prev.consecutiveLosses + 1;
                                 newMetrics.consecutiveWins = 0;
                             }
                             return newMetrics;
                         });
                         
                         // Atualizar Martingale
                         if (martingaleConfig.enabled) {
                             setMartingaleConfig(prev => {
                                 if (status === 'WIN' && prev.resetOnWin) {
                                     return { ...prev, currentLevel: 0 };
                                 } else if (status === 'LOSS') {
                                     return { ...prev, currentLevel: Math.min(prev.currentLevel + 1, prev.maxLevel) };
                                 }
                                 return prev;
                             });
                         }
                         
                         if(isAutoRunning) {
                             const emoji = status === 'WIN' ? '🎉' : '😔';
                             addBotLog(`${emoji} Trade Fechado: ${status} | P&L: ${formatCurrency(profit)}`, status === 'WIN' ? 'success' : 'error');
                         }

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

                      // CRÍTICO: Desinscrever do WebSocket após finalizar
                      console.log(`🔌 Unsubscribe do contrato ${contractInfo.contract_id}`);
                      derivApi.unsubscribeContract(contractInfo.contract_id);

                      return { 
                          ...updatedTrade, 
                          status, 
                          profit,
                          isWinning: status === 'WIN'
                      };
                  }

                  return updatedTrade;
              }));
          });

      } catch (err) {
          console.error(err);
          alert('Falha ao enviar ordem.');
          if (isAutoRunning) addBotLog(`❌ Falha ao enviar ordem: ${err}`, 'error');
      } finally {
          setTradeLoading(false);
      }
  };

  const handleScanMarket = async () => {
      setIsScanning(true);
      setMarketRanking([]);
      addBotLog('🔍 Iniciando scan de mercado...', 'info');
      
      const assetsToScan = AVAILABLE_ASSETS.slice(0, 8);
      const results: AssetRanking[] = [];

      for (const asset of assetsToScan) {
          try {
              const history = await derivApi.getHistory(asset.id, 60, 50);
              if (history.length > 20) {
                  const analysis = analyzeMarket(history);
                  if (analysis.direction !== 'NEUTRO' && analysis.probability >= autoSettings.minProbability) {
                      results.push({
                          id: asset.id,
                          name: asset.name,
                          type: asset.type,
                          direction: analysis.direction,
                          probability: analysis.probability,
                          score: analysis.score
                      });
                  }
              }
          } catch(e) { console.error(e); }
      }

      setMarketRanking(results.sort((a,b) => b.probability - a.probability));
      addBotLog(`✅ Scan completo: ${results.length} oportunidades encontradas`, 'success');
      setIsScanning(false);
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
    
    const width = 800; const height = 350; const padding = 40; 
    const paddingRight = 65;
    const usableHeight = height - (padding * 2);
    const usableWidth = width - paddingRight;

    const candleWidth = (usableWidth / Math.max(safeCandles.length, 1)) * 0.7;
    const spacing = (usableWidth / Math.max(safeCandles.length, 1));
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
                <span className={cn("text-xs font-bold font-mono", dailyStats.profit >= 0 ? "text-green-400" : "text-red-400")}>
                    {dailyStats.profit >= 0 ? '+' : ''}{formatCurrency(dailyStats.profit)}
                </span>
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

          {/* --- PAINEL DE ATIVIDADE AO VIVO MELHORADO --- */}
          {liveTrades.length > 0 && (
              <div className="h-[280px] bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
                  <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                          <Hourglass className="h-4 w-4 text-slate-400" />
                          <span className="text-xs font-bold text-slate-300 uppercase">Operações em Tempo Real</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded">
                              <MousePointerClick className="h-3 w-3 text-blue-400" />
                              <span className="text-blue-400 font-bold">Manual</span>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded">
                              <Bot className="h-3 w-3 text-yellow-400" />
                              <span className="text-yellow-400 font-bold">Bot</span>
                          </div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {liveTrades.map((trade, idx) => {
                          const now = Date.now();
                          const expiry = trade.expiryTime || (trade.startTime + (trade.totalDurationSeconds * 1000));
                          const timeLeftMs = Math.max(0, expiry - now);
                          const timeLeftSeconds = Math.ceil(timeLeftMs / 1000);
                          const progress = Math.min(100, Math.max(0, 100 - (timeLeftMs / (trade.totalDurationSeconds * 1000) * 100)));
                          const isFinished = trade.status !== 'PENDING';
                          
                          // DEBUG: Log quando timer zera mas ainda está PENDING
                          if (timeLeftSeconds === 0 && trade.status === 'PENDING') {
                              console.warn(`⚠️ Timer zerou mas trade ${trade.id} ainda está PENDING. Aguardando API...`);
                          }
                          
                          return (
                            <div key={idx} className={cn("relative overflow-hidden flex flex-col p-3 rounded-lg text-xs border transition-all", 
                                trade.status === 'PENDING' ? "bg-slate-800/40 border-slate-700/50 shadow-md" : 
                                trade.status === 'WIN' ? "bg-green-950/20 border-green-500/30 shadow-lg shadow-green-500/10" : 
                                "bg-red-950/20 border-red-500/30 shadow-lg shadow-red-500/10")}>
                                
                                {/* HEADER COM ORIGEM E HORÁRIO */}
                                <div className="flex items-center justify-between z-10 relative mb-2">
                                    <div className="flex items-center gap-2">
                                        {/* Badge de Origem (MANUAL/BOT) */}
                                        <div className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border",
                                            trade.source === 'BOT' 
                                                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" 
                                                : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                        )}>
                                            {trade.source === 'BOT' ? <Bot className="h-3 w-3" /> : <MousePointerClick className="h-3 w-3" />}
                                            {trade.source}
                                        </div>
                                        
                                        {/* Status Badge */}
                                        {isFinished && (
                                            <div className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1",
                                                trade.status === 'WIN' 
                                                    ? "bg-green-500/30 text-green-300 border border-green-500/50" 
                                                    : "bg-red-500/30 text-red-300 border border-red-500/50"
                                            )}>
                                                {trade.status === 'WIN' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                                {trade.status === 'WIN' ? 'FINALIZADO ✓' : 'FINALIZADO ✗'}
                                            </div>
                                        )}
                                        
                                        {!isFinished && (
                                            <div className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse">
                                                ⏳ EM ANDAMENTO
                                            </div>
                                        )}
                                    </div>
                                    
                                    <span className="text-slate-500 font-mono text-[10px]">{trade.time}</span>
                                </div>

                                {/* INFORMAÇÕES DO ATIVO E DIREÇÃO */}
                                <div className="flex items-center justify-between z-10 relative mb-2">
                                    <div className="flex items-center gap-2">
                                        {trade.type === 'CALL' ? <ArrowUpRight className="h-5 w-5 text-green-500"/> : <ArrowDownRight className="h-5 w-5 text-red-500"/>}
                                        <div className="flex flex-col">
                                            <span className="font-bold text-white text-sm">{trade.asset}</span>
                                            <span className="text-[9px] text-slate-500 uppercase font-bold">{trade.type} • ID: {String(trade.id).slice(-8)}</span>
                                        </div>
                                    </div>
                                    
                                    {/* STATUS EM TEMPO REAL (Apenas para trades pendentes) */}
                                    {!isFinished && (
                                        <div className="flex items-center gap-2">
                                            <div className={cn("px-2 py-1 rounded text-[11px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1 border-2", 
                                                trade.isWinning ? "bg-green-500/30 text-green-300 border-green-500" : "bg-red-500/30 text-red-300 border-red-500"
                                            )}>
                                                {trade.isWinning ? '📈 GANHANDO' : '📉 PERDENDO'}
                                                <span className="font-mono ml-1 text-xs">
                                                    {trade.isWinning 
                                                        ? `+${formatCurrency(trade.potentialProfit || (trade.amount * 0.95))}` 
                                                        : `-${formatCurrency(trade.amount)}`}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* PREÇOS E VALORES */}
                                <div className="flex items-center justify-between z-10 relative">
                                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                                        <div className="flex flex-col bg-slate-900/50 p-1.5 rounded border border-slate-800/50">
                                            <span className="text-[8px] uppercase font-bold text-slate-600">Entrada</span>
                                            <span className="font-mono text-slate-300 font-bold">{trade.entryPrice?.toFixed(activeAsset.decimals) || '---'}</span>
                                        </div>
                                        <ArrowRight className="h-3 w-3 text-slate-600" />
                                        <div className="flex flex-col bg-slate-900/50 p-1.5 rounded border border-slate-800/50">
                                            <span className="text-[8px] uppercase font-bold text-slate-600">{isFinished ? 'Saída' : 'Atual'}</span>
                                            <span className={cn("font-mono font-bold", 
                                                isFinished 
                                                    ? (trade.status === 'WIN' ? "text-green-400" : "text-red-400")
                                                    : (trade.isWinning ? "text-green-400" : "text-red-400")
                                            )}>
                                                {(isFinished ? trade.exitPrice : trade.currentPrice)?.toFixed(activeAsset.decimals) || '---'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-end bg-slate-900/50 p-1.5 rounded border border-slate-800/50">
                                            <span className="text-[8px] uppercase font-bold text-slate-600">Stake</span>
                                            <span className="text-slate-300 font-bold text-xs">{formatCurrency(trade.amount)}</span>
                                        </div>
                                        
                                        {!isFinished ? (
                                            <div className="flex items-center gap-2 min-w-[80px] justify-end bg-slate-900 px-3 py-2 rounded-lg border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/20">
                                                <TimerIcon className="h-4 w-4 text-yellow-500 animate-spin" />
                                                <span className="font-mono font-bold text-yellow-400 text-sm">
                                                    {Math.floor(timeLeftSeconds / 60).toString().padStart(2,'0')}:{Math.floor(timeLeftSeconds % 60).toString().padStart(2,'0')}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className={cn("text-sm px-4 py-2 rounded-lg border-2 font-black min-w-[90px] text-center shadow-lg", 
                                                trade.status === 'WIN' 
                                                    ? "bg-green-500/30 text-green-300 border-green-500 shadow-green-500/20" 
                                                    : "bg-red-500/30 text-red-300 border-red-500 shadow-red-500/20"
                                            )}>
                                                {trade.status === 'WIN' ? `+${formatCurrency(trade.profit || 0)}` : formatCurrency(trade.profit || 0)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* BARRA DE PROGRESSO (Apenas para trades pendentes) */}
                                {!isFinished && (
                                    <div className="mt-2.5 h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 shadow-inner">
                                        <div 
                                            className={cn("h-full transition-all duration-500 ease-linear shadow-lg", 
                                                trade.isWinning ? "bg-gradient-to-r from-green-500 to-green-400" : "bg-gradient-to-r from-red-500 to-red-400"
                                            )}
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
                            <Button disabled={cooldown > 0 || isManualLocked} className="h-full bg-green-600 hover:bg-green-500 text-xl font-black disabled:opacity-50" onClick={() => handleTrade('CALL')}>
                                {cooldown > 0 ? `AGUARDE (${cooldown}s)` : isManualLocked ? 'LIMITE ATINGIDO' : 'CALL'}
                            </Button>
                            <Button disabled={cooldown > 0 || isManualLocked} className="h-full bg-red-600 hover:bg-red-500 text-xl font-black disabled:opacity-50" onClick={() => handleTrade('PUT')}>
                                {cooldown > 0 ? `AGUARDE (${cooldown}s)` : isManualLocked ? 'LIMITE ATINGIDO' : 'PUT'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* --- MODO AUTO (BOT UI MELHORADO) --- */}
                {executionMode === 'AUTO' && (
                    <div className="space-y-4 flex flex-col h-full">
                       {/* BOT STATUS HEADER MELHORADO */}
                       <div className={cn(
                           "p-4 rounded-xl border flex items-center gap-3 shadow-lg",
                           isAutoRunning ? "bg-green-950/20 border-green-500/30" : "bg-slate-950 border-slate-800"
                       )}>
                           <div className={cn("p-2 rounded-full", isAutoRunning ? "bg-green-500/20 animate-pulse" : "bg-slate-800")}>
                               <Brain className={cn("h-6 w-6", isAutoRunning ? "text-green-500" : "text-slate-500")} />
                           </div>
                           <div className="flex-1">
                               <h4 className="font-bold text-white text-sm flex items-center gap-2">
                                   Sniper Bot v2.0
                                   {martingaleConfig.enabled && martingaleConfig.currentLevel > 0 && (
                                       <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-black">
                                           MARTINGALE x{Math.pow(martingaleConfig.multiplier, martingaleConfig.currentLevel).toFixed(1)}
                                       </span>
                                   )}
                               </h4>
                               <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                   Status: <span className={cn("font-bold uppercase", 
                                       botStatus === 'RUNNING' ? 'text-green-400' : 
                                       botStatus === 'ANALYZING' ? 'text-blue-400' :
                                       botStatus === 'WAITING_COOLDOWN' ? 'text-yellow-400' :
                                       'text-slate-500'
                                   )}>{botStatus.replace('_', ' ')}</span>
                               </p>
                               {botMetrics.consecutiveWins > 0 && (
                                   <p className="text-[9px] text-green-500 flex items-center gap-1 mt-1">
                                       <TrendUp className="h-3 w-3" /> {botMetrics.consecutiveWins} Vitórias Seguidas
                                   </p>
                               )}
                               {botMetrics.consecutiveLosses > 0 && (
                                   <p className="text-[9px] text-red-500 flex items-center gap-1 mt-1">
                                       <TrendingDown className="h-3 w-3" /> {botMetrics.consecutiveLosses} Derrotas Seguidas
                                   </p>
                               )}
                           </div>
                       </div>
                       
                       {/* SETTINGS TABS */}
                       <div className="flex gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
                           <button 
                             onClick={() => setBotTab('CONFIG')}
                             className={cn("flex-1 py-2 text-[9px] font-bold rounded transition-colors flex items-center justify-center gap-1", botTab === 'CONFIG' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300")}
                           >
                               <Settings2 className="h-3 w-3" /> ESTRATÉGIA
                           </button>
                           <button 
                             onClick={() => setBotTab('RISK')}
                             className={cn("flex-1 py-2 text-[9px] font-bold rounded transition-colors flex items-center justify-center gap-1", botTab === 'RISK' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300")}
                           >
                               <ShieldAlert className="h-3 w-3" /> RISCO
                           </button>
                           <button 
                             onClick={() => setBotTab('ADVANCED')}
                             className={cn("flex-1 py-2 text-[9px] font-bold rounded transition-colors flex items-center justify-center gap-1", botTab === 'ADVANCED' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300")}
                           >
                               <Lightning className="h-3 w-3" /> AVANÇADO
                           </button>
                           <button 
                             onClick={() => setBotTab('MONITOR')}
                             className={cn("flex-1 py-2 text-[9px] font-bold rounded transition-colors flex items-center justify-center gap-1", botTab === 'MONITOR' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300")}
                           >
                               <Activity className="h-3 w-3" /> MONITOR
                           </button>
                       </div>

                       <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                           {botTab === 'CONFIG' && (
                               <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                   <div className="space-y-2">
                                       <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><DollarSign className="h-3 w-3" /> Stake Base</label>
                                       <input type="number" step="0.5" value={autoSettings.stake} onChange={(e) => setAutoSettings({...autoSettings, stake: Number(e.target.value)})} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg pl-4 text-white font-black text-lg focus:ring-2 focus:ring-yellow-500/50 outline-none" />
                                   </div>
                                   
                                   <div className="grid grid-cols-2 gap-3">
                                       <div className="space-y-2">
                                           <label className="text-[9px] font-bold text-slate-500 uppercase">Min. Probabilidade</label>
                                           <input type="number" min="50" max="95" value={autoSettings.minProbability} onChange={(e) => setAutoSettings({...autoSettings, minProbability: Number(e.target.value)})} className="w-full h-10 bg-slate-950 border border-slate-700 rounded px-3 text-white font-bold text-sm focus:ring-2 focus:ring-yellow-500/50 outline-none" />
                                       </div>
                                       <div className="space-y-2">
                                           <label className="text-[9px] font-bold text-slate-500 uppercase">Min. Score</label>
                                           <input type="number" min="0" max="100" value={autoSettings.minScore} onChange={(e) => setAutoSettings({...autoSettings, minScore: Number(e.target.value)})} className="w-full h-10 bg-slate-950 border border-slate-700 rounded px-3 text-white font-bold text-sm focus:ring-2 focus:ring-yellow-500/50 outline-none" />
                                       </div>
                                   </div>
                                   
                                   <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
                                       <label className="flex items-center gap-2 cursor-pointer">
                                           <input type="checkbox" checked={autoSettings.conservativeMode} onChange={(e) => setAutoSettings({...autoSettings, conservativeMode: e.target.checked})} className="rounded border-slate-700 bg-slate-900 text-green-500" />
                                           <span className="text-[10px] font-bold text-slate-300">🛡️ Modo Conservador (85%+)</span>
                                       </label>
                                   </div>
                                   
                                   {/* --- LOG DE DECISÃO --- */}
                                   <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                                       <h5 className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><Zap className="h-3 w-3 text-yellow-500"/> Cerebro do Bot (Logs)</h5>
                                       <div className="h-40 overflow-y-auto space-y-1 bg-slate-900/50 p-2 rounded text-[10px] font-mono border border-slate-800/50 scrollbar-thin scrollbar-thumb-slate-700">
                                           {botLogs.length === 0 ? <span className="text-slate-600 italic">Bot aguardando início...</span> : 
                                             botLogs.map((log, i) => (
                                                 <div key={i} className="text-slate-300 border-b border-slate-800/30 pb-0.5 mb-0.5 last:border-0">{log}</div>
                                             ))
                                           }
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
                                                   <input type="number" step="1" value={autoSettings.stopWinValue} onChange={(e) => setAutoSettings({...autoSettings, stopWinValue: Number(e.target.value)})} className="w-full bg-slate-900 border border-green-800/50 rounded h-9 px-2 text-green-400 font-mono text-sm font-bold mt-1" />
                                               </div>
                                               <div>
                                                   <label className="text-[9px] text-slate-500 uppercase font-bold">Stop Loss ($)</label>
                                                   <input type="number" step="1" value={autoSettings.stopLossValue} onChange={(e) => setAutoSettings({...autoSettings, stopLossValue: Number(e.target.value)})} className="w-full bg-slate-900 border border-red-800/50 rounded h-9 px-2 text-red-400 font-mono text-sm font-bold mt-1" />
                                               </div>
                                           </div>
                                       ) : (
                                           <div className="grid grid-cols-2 gap-3">
                                               <div>
                                                   <label className="text-[9px] text-slate-500 uppercase font-bold">Meta Wins</label>
                                                   <input type="number" min="1" value={autoSettings.stopWinCount} onChange={(e) => setAutoSettings({...autoSettings, stopWinCount: Number(e.target.value)})} className="w-full bg-slate-900 border border-green-800/50 rounded h-9 px-2 text-green-400 font-mono text-sm font-bold mt-1" />
                                               </div>
                                               <div>
                                                   <label className="text-[9px] text-slate-500 uppercase font-bold">Max Loss</label>
                                                   <input type="number" min="1" value={autoSettings.stopLossCount} onChange={(e) => setAutoSettings({...autoSettings, stopLossCount: Number(e.target.value)})} className="w-full bg-slate-900 border border-red-800/50 rounded h-9 px-2 text-red-400 font-mono text-sm font-bold mt-1" />
                                               </div>
                                           </div>
                                       )}
                                   </div>
                                   
                                   <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3">
                                       <div className="flex items-center gap-2">
                                          <input type="checkbox" checked={autoSettings.scheduleEnabled} onChange={(e) => setAutoSettings({...autoSettings, scheduleEnabled: e.target.checked})} className="rounded border-slate-700 bg-slate-900 text-green-500" />
                                          <label className="text-[10px] font-bold text-slate-400 uppercase">⏰ Agendar Horário</label>
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

                           {botTab === 'ADVANCED' && (
                               <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                   <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-3">
                                       <h5 className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800 pb-2">Cooldown & Limites</h5>
                                       <div className="grid grid-cols-2 gap-3">
                                           <div>
                                               <label className="text-[9px] text-slate-500 uppercase font-bold">Cooldown (seg)</label>
                                               <input type="number" min="0" max="300" value={autoSettings.tradeCooldownSeconds} onChange={(e) => setAutoSettings({...autoSettings, tradeCooldownSeconds: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded h-9 px-2 text-white font-mono text-sm font-bold mt-1" />
                                           </div>
                                           <div>
                                               <label className="text-[9px] text-slate-500 uppercase font-bold">Max/Hora</label>
                                               <input type="number" min="1" max="60" value={autoSettings.maxTradesPerHour} onChange={(e) => setAutoSettings({...autoSettings, maxTradesPerHour: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded h-9 px-2 text-white font-mono text-sm font-bold mt-1" />
                                           </div>
                                       </div>
                                       <div className="text-[9px] text-slate-500 bg-slate-900 p-2 rounded">
                                           Trades esta hora: <span className="text-white font-bold">{botMetrics.hourlyTrades}/{autoSettings.maxTradesPerHour}</span>
                                       </div>
                                   </div>
                                   
                                   {/* --- MARTINGALE (ALTO RISCO) --- */}
                                   <div className="bg-gradient-to-br from-red-950/30 to-slate-950 p-3 rounded-lg border border-red-500/30 space-y-3">
                                       <div className="flex items-center justify-between">
                                           <div>
                                               <h5 className="text-[10px] font-bold text-red-400 uppercase flex items-center gap-1">
                                                   ⚠️ Martingale (Risco)
                                               </h5>
                                               <p className="text-[8px] text-slate-500 mt-0.5">Dobra stake após loss</p>
                                           </div>
                                           <label className="relative inline-flex items-center cursor-pointer">
                                               <input type="checkbox" checked={martingaleConfig.enabled} onChange={(e) => setMartingaleConfig({...martingaleConfig, enabled: e.target.checked, currentLevel: 0})} className="sr-only peer" />
                                               <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                                           </label>
                                       </div>
                                       
                                       {martingaleConfig.enabled && (
                                           <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
                                               <div>
                                                   <label className="text-[8px] text-slate-500 uppercase font-bold">Multiplicador</label>
                                                   <input type="number" min="1.5" max="3" step="0.1" value={martingaleConfig.multiplier} onChange={(e) => setMartingaleConfig({...martingaleConfig, multiplier: Number(e.target.value)})} className="w-full bg-slate-900 border border-red-800/50 rounded h-8 px-2 text-red-400 font-mono text-xs font-bold mt-1" />
                                               </div>
                                               <div>
                                                   <label className="text-[8px] text-slate-500 uppercase font-bold">Nível Máx</label>
                                                   <input type="number" min="1" max="5" value={martingaleConfig.maxLevel} onChange={(e) => setMartingaleConfig({...martingaleConfig, maxLevel: Number(e.target.value)})} className="w-full bg-slate-900 border border-red-800/50 rounded h-8 px-2 text-red-400 font-mono text-xs font-bold mt-1" />
                                               </div>
                                               <div className="col-span-2">
                                                   <label className="flex items-center gap-2 cursor-pointer">
                                                       <input type="checkbox" checked={martingaleConfig.resetOnWin} onChange={(e) => setMartingaleConfig({...martingaleConfig, resetOnWin: e.target.checked})} className="rounded border-slate-700 bg-slate-900 text-green-500" />
                                                       <span className="text-[9px] text-slate-400">Resetar ao vencer</span>
                                                   </label>
                                               </div>
                                           </div>
                                       )}
                                   </div>
                               </div>
                           )}

                           {/* --- ABA MONITOR (NOVA!) --- */}
                           {botTab === 'MONITOR' && (
                               <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                   {!isAutoRunning ? (
                                       <div className="text-center py-8 text-slate-500">
                                           <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                           <p className="text-sm">Inicie o bot para ver o monitor em tempo real</p>
                                       </div>
                                   ) : (
                                       <>
                                           {/* STATUS ATUAL */}
                                           <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                                               <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                                                   <Target className="h-3 w-3 text-green-500 animate-pulse" /> Ativo Atual
                                               </h5>
                                               <div className="flex items-center justify-between">
                                                   <div className="flex items-center gap-2">
                                                       {getAssetIcon(activeAsset.type)}
                                                       <span className="text-white font-bold">{activeAsset.name}</span>
                                                   </div>
                                                   {analysis && (
                                                       <div className={cn("px-2 py-1 rounded text-[9px] font-black", 
                                                           analysis.isSniperReady && analysis.direction !== 'NEUTRO' 
                                                               ? (analysis.direction === 'CALL' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")
                                                               : "bg-slate-800 text-slate-400"
                                                       )}>
                                                           {analysis.isSniperReady ? (analysis.direction === 'CALL' ? '🚀 CALL' : analysis.direction === 'PUT' ? '📉 PUT' : '⏸️ NEUTRO') : '🔍 ANALISANDO'}
                                                       </div>
                                                   )}
                                               </div>
                                               {analysis && analysis.isSniperReady && analysis.direction !== 'NEUTRO' && (
                                                   <div className="mt-2 flex gap-2 text-[9px]">
                                                       <span className="text-slate-500">Prob: <b className="text-white">{analysis.probability}%</b></span>
                                                       <span className="text-slate-500">Score: <b className="text-white">{analysis.score}</b></span>
                                                   </div>
                                               )}
                                           </div>

                                           {/* ESTATÍSTICAS */}
                                           <div className="grid grid-cols-3 gap-2">
                                               <div className="bg-slate-950 p-2 rounded border border-slate-800 text-center">
                                                   <div className="text-[9px] text-slate-500 uppercase font-bold">Analisados</div>
                                                   <div className="text-lg font-black text-white">{monitorStats.analyzed}</div>
                                               </div>
                                               <div className="bg-green-950/20 p-2 rounded border border-green-500/30 text-center">
                                                   <div className="text-[9px] text-green-400 uppercase font-bold">Aprovados</div>
                                                   <div className="text-lg font-black text-green-400">{monitorStats.approved}</div>
                                               </div>
                                               <div className="bg-red-950/20 p-2 rounded border border-red-500/30 text-center">
                                                   <div className="text-[9px] text-red-400 uppercase font-bold">Rejeitados</div>
                                                   <div className="text-lg font-black text-red-400">{monitorStats.rejected}</div>
                                               </div>
                                           </div>

                                           {/* TAXA DE ENTRADA */}
                                           <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                                               <div className="flex justify-between items-center mb-2">
                                                   <span className="text-[10px] font-bold text-slate-400 uppercase">Taxa de Entrada</span>
                                                   <span className="text-sm font-black text-white">
                                                       {monitorStats.analyzed > 0 ? ((monitorStats.approved / monitorStats.analyzed) * 100).toFixed(1) : 0}%
                                                   </span>
                                               </div>
                                               <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                                   <div 
                                                       className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                                                       style={{ width: `${monitorStats.analyzed > 0 ? (monitorStats.approved / monitorStats.analyzed) * 100 : 0}%` }}
                                                   />
                                               </div>
                                           </div>

                                           {/* HISTÓRICO DE DECISÕES */}
                                           <div className="bg-slate-950 rounded-lg border border-slate-800">
                                               <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                                                   <h5 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                                                       <Clock className="h-3 w-3" /> Decisões Recentes
                                                   </h5>
                                                   <span className="text-[9px] text-slate-600">{decisionLogs.length} logs</span>
                                               </div>
                                               <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
                                                   {decisionLogs.length === 0 ? (
                                                       <div className="text-center py-4 text-slate-600 text-[10px]">
                                                           Aguardando análises...
                                                       </div>
                                                   ) : (
                                                       decisionLogs.map((log, i) => (
                                                           <div key={i} className={cn("p-2 rounded text-[10px] border", 
                                                               log.decision === 'APPROVED' ? "bg-green-950/10 border-green-500/20" :
                                                               log.decision === 'COOLDOWN' ? "bg-yellow-950/10 border-yellow-500/20" :
                                                               "bg-red-950/10 border-red-500/20"
                                                           )}>
                                                               <div className="flex justify-between items-start mb-1">
                                                                   <span className="font-bold text-white">{log.asset}</span>
                                                                   <span className="text-slate-500 font-mono text-[8px]">
                                                                       {new Date(log.timestamp).toLocaleTimeString()}
                                                                   </span>
                                                               </div>
                                                               <div className="flex items-center gap-2">
                                                                   <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase",
                                                                       log.decision === 'APPROVED' ? "bg-green-500/30 text-green-300" :
                                                                       log.decision === 'COOLDOWN' ? "bg-yellow-500/30 text-yellow-300" :
                                                                       "bg-red-500/30 text-red-300"
                                                                   )}>
                                                                       {log.decision === 'APPROVED' ? '✅ OPEROU' : 
                                                                        log.decision === 'COOLDOWN' ? '⏳ COOLDOWN' : '❌ REJEITADO'}
                                                                   </span>
                                                                   {log.direction && log.direction !== 'NEUTRO' && (
                                                                       <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-bold",
                                                                           log.direction === 'CALL' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                                                       )}>
                                                                           {log.direction}
                                                                       </span>
                                                                   )}
                                                               </div>
                                                               <p className="text-slate-400 text-[9px] mt-1 leading-relaxed">{log.reason}</p>
                                                               {log.probability && log.score && (
                                                                   <div className="flex gap-2 mt-1 text-[8px] text-slate-600">
                                                                       <span>Prob: {log.probability}%</span>
                                                                       <span>Score: {log.score}</span>
                                                                   </div>
                                                               )}
                                                           </div>
                                                       ))
                                                   )}
                                               </div>
                                           </div>
                                       </>
                                   )}
                               </div>
                           )}
                       </div>

                       <Button 
                         onClick={() => setIsAutoRunning(!isAutoRunning)}
                         disabled={isAutoLocked()}
                         className={cn("w-full font-black h-12 text-sm shadow-xl transition-all", 
                             isAutoRunning ? "bg-red-600 hover:bg-red-700 shadow-red-500/20" : 
                             isAutoLocked() ? "bg-slate-700 text-slate-500" :
                             "bg-green-600 hover:bg-green-700 shadow-green-500/20"
                         )}
                       >
                           {isAutoRunning ? <><StopCircle className="mr-2 h-5 w-5" /> PARAR BOT</> : 
                            isAutoLocked() ? '🛑 STOP ATINGIDO' :
                            <><Play className="mr-2 h-5 w-5" /> INICIAR AUTO</>}
                       </Button>
                    </div>
                )}

                {/* --- MODO SCANNER --- */}
                {executionMode === 'SCANNER' && (
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="text-center py-2 bg-slate-950 rounded border border-slate-800">
                             <h4 className="text-xs font-bold text-slate-400 uppercase">Scanner de Oportunidades</h4>
                             <p className="text-[10px] text-slate-600 mt-1">Filtro: Prob ≥ {autoSettings.minProbability}%</p>
                        </div>
                        
                        {isScanning ? (
                            <div className="flex-1 flex items-center justify-center flex-col gap-2 text-slate-500">
                                <RefreshCcw className="h-8 w-8 animate-spin text-purple-500" />
                                <span className="text-xs animate-pulse">Analisando mercados...</span>
                            </div>
                        ) : marketRanking.length > 0 ? (
                            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-slate-800">
                                {marketRanking.map((rank, i) => (
                                    <div key={rank.id} onClick={() => {
                                        setActiveAsset(AVAILABLE_ASSETS.find(a=>a.id===rank.id)!);
                                        setExecutionMode('AUTO');
                                    }} className="bg-slate-950 p-3 rounded-lg border border-slate-800 hover:border-purple-500 cursor-pointer transition-all">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-white">{rank.name}</span>
                                            <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded", rank.direction === 'CALL' ? "bg-green-500 text-slate-900" : "bg-red-500 text-white")}>{rank.direction}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                                            <span>Prob: <b className="text-white">{rank.probability}%</b></span>
                                            <span>Score: <b className="text-white">{rank.score}</b></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center px-4">
                                <Search className="h-8 w-8 mb-2 opacity-50" />
                                <p className="text-xs">Clique abaixo para escanear os melhores ativos do momento.</p>
                            </div>
                        )}
                        
                        <Button onClick={handleScanMarket} disabled={isScanning} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-12">
                            {isScanning ? 'ESCANEANDO...' : 'ESCANEAR MERCADO'}
                        </Button>
                    </div>
                )}

             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
