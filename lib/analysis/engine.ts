
import { calculateEMA, calculateRSI, calculateBollingerBands, calculateStochastic } from './indicators';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface AnalysisFactor {
  label: string;
  weight: number; 
  status: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface AnalysisResult {
  direction: 'CALL' | 'PUT' | 'NEUTRO';
  score: number;
  probability: number; // Nova métrica: % de chance de Win
  factors: AnalysisFactor[];
  timestamp: number;
}

export function analyzeMarket(candles: Candle[]): AnalysisResult {
  // Precisamos de histórico para estabilidade. 
  // O último candle (index -1) é o que está "nascendo", então analisamos o PENÚLTIMO (index -2) que já fechou.
  if (candles.length < 30) {
    return { direction: 'NEUTRO', score: 0, probability: 50, factors: [], timestamp: Date.now() };
  }

  // Separar dados confirmados (Histórico fechado)
  const confirmedCandles = candles.slice(0, -1); 
  const lastClosed = confirmedCandles[confirmedCandles.length - 1]; // O gatilho do sinal
  
  const closes = confirmedCandles.map(c => c.close);
  const highs = confirmedCandles.map(c => c.high);
  const lows = confirmedCandles.map(c => c.low);

  const factors: AnalysisFactor[] = [];
  let callScore = 0;
  let putScore = 0;

  // --- 1. Bandas de Bollinger (Estratégia: Rejeição de Banda) ---
  const bb = calculateBollingerBands(closes, 20, 2);
  if (bb) {
    // Se a vela fechada rompeu ou tocou a banda superior
    if (lastClosed.high >= bb.upper) {
      putScore += 30;
      factors.push({ label: 'Preço na Banda Superior (Reversão)', weight: 30, status: 'NEGATIVE' });
    }
    // Se a vela fechada rompeu ou tocou a banda inferior
    else if (lastClosed.low <= bb.lower) {
      callScore += 30;
      factors.push({ label: 'Preço na Banda Inferior (Reversão)', weight: 30, status: 'POSITIVE' });
    }
  }

  // --- 2. RSI (Filtro de Tendência e Exaustão) ---
  const rsi = calculateRSI(closes, 14);
  if (rsi > 70) {
    putScore += 25;
    factors.push({ label: `RSI Sobrecompra (${rsi.toFixed(0)})`, weight: 25, status: 'NEGATIVE' });
  } else if (rsi < 30) {
    callScore += 25;
    factors.push({ label: `RSI Sobrevenda (${rsi.toFixed(0)})`, weight: 25, status: 'POSITIVE' });
  } else if (rsi > 55) {
      // Leve tendência de alta
      callScore += 5;
      factors.push({ label: 'RSI aponta alta', weight: 5, status: 'POSITIVE' });
  } else if (rsi < 45) {
      // Leve tendência de baixa
      putScore += 5;
      factors.push({ label: 'RSI aponta baixa', weight: 5, status: 'NEGATIVE' });
  }

  // --- 3. Tendência Macro (EMA Cruzada) ---
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const currentEma9 = ema9[ema9.length - 1];
  const currentEma21 = ema21[ema21.length - 1];

  // Aumentamos o peso da tendência para evitar empates (NEUTRO)
  if (currentEma9 > currentEma21) {
    callScore += 15; 
    factors.push({ label: 'Tendência de Alta (EMA 9>21)', weight: 15, status: 'POSITIVE' });
  } else {
    putScore += 15; 
    factors.push({ label: 'Tendência de Baixa (EMA 9<21)', weight: 15, status: 'NEGATIVE' });
  }

  // --- 4. Price Action Avançado (Vela Confirmada) ---
  const bodySize = Math.abs(lastClosed.close - lastClosed.open);
  const totalSize = lastClosed.high - lastClosed.low;
  const upperWick = lastClosed.high - Math.max(lastClosed.open, lastClosed.close);
  const lowerWick = Math.min(lastClosed.open, lastClosed.close) - lastClosed.low;
  
  // Evitar divisão por zero
  const safeTotalSize = totalSize === 0 ? 0.00001 : totalSize;

  // Padrão: Martelo (Rejeição de Fundo) -> CALL
  if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
    callScore += 35; 
    factors.push({ label: 'Padrão Hammer (Força Alta)', weight: 35, status: 'POSITIVE' });
  }

  // Padrão: Shooting Star (Rejeição de Topo) -> PUT
  if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5) {
    putScore += 35;
    factors.push({ label: 'Padrão Shooting Star (Força Baixa)', weight: 35, status: 'NEGATIVE' });
  }

  // Padrão: Vela de Força (Momentum)
  if (bodySize > safeTotalSize * 0.8) {
      if (lastClosed.close > lastClosed.open) {
          callScore += 20;
          factors.push({ label: 'Vela de Força Compradora', weight: 20, status: 'POSITIVE' });
      } else {
          putScore += 20;
          factors.push({ label: 'Vela de Força Vendedora', weight: 20, status: 'NEGATIVE' });
      }
  }

  // --- Decisão Final e Cálculo de Probabilidade ---
  let direction: 'CALL' | 'PUT' | 'NEUTRO' = 'NEUTRO';
  let rawScore = 0;

  // Reduzimos drasticamente o Threshold para forçar uma decisão sempre que possível
  const THRESHOLD = 5; 

  if (callScore > putScore + THRESHOLD) {
    direction = 'CALL';
    rawScore = callScore;
  } else if (putScore > callScore + THRESHOLD) {
    direction = 'PUT';
    rawScore = putScore;
  } else {
    // Desempate pela tendência se estiver muito próximo
    if (callScore > putScore) {
        direction = 'CALL';
        rawScore = callScore;
    } else if (putScore > callScore) {
        direction = 'PUT';
        rawScore = putScore;
    } else {
        rawScore = 0;
    }
  }

  // Normalizar Score (Teto 100)
  if (rawScore > 100) rawScore = 100;

  // --- Cálculo de Probabilidade (%) ---
  // Base: 55% (Ligeira vantagem técnica).
  // Cada ponto de Score adiciona confiança.
  let probability = 55 + (rawScore * 0.40); 
  
  // Penalidade de Volatilidade Baixa (Doji / Mercado Lateral)
  if (bodySize < safeTotalSize * 0.15) {
    probability -= 15;
    factors.push({ label: 'Baixa Volatilidade (Arriscado)', weight: -15, status: 'NEUTRAL' });
    // Se a probabilidade cair muito, voltamos para Neutro
    if (probability < 55) direction = 'NEUTRO';
  }

  // Limites
  probability = Math.min(Math.max(probability, 50), 98);

  return {
    direction,
    score: rawScore,
    probability: Math.round(probability),
    factors,
    timestamp: Date.now()
  };
}
