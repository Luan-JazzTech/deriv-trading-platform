
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
  factors: AnalysisFactor[];
  timestamp: number;
}

export function analyzeMarket(candles: Candle[]): AnalysisResult {
  // Precisamos de histórico suficiente para EMA20 e BB20
  if (candles.length < 25) {
    return { direction: 'NEUTRO', score: 0, factors: [], timestamp: Date.now() };
  }

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  
  const lastCandle = candles[candles.length - 1];

  const factors: AnalysisFactor[] = [];
  let callScore = 0;
  let putScore = 0;

  // --- 1. Bandas de Bollinger (Estratégia de Reversão ou Breakout) ---
  const bb = calculateBollingerBands(closes, 20, 2); // 20 períodos, 2 desvios
  if (bb) {
    // Preço tocou na banda superior -> Possível reversão para baixo (PUT)
    if (lastCandle.high >= bb.upper) {
      putScore += 25;
      factors.push({ label: 'Preço na Banda Superior (BB)', weight: 25, status: 'NEGATIVE' });
    }
    // Preço tocou na banda inferior -> Possível reversão para cima (CALL)
    else if (lastCandle.low <= bb.lower) {
      callScore += 25;
      factors.push({ label: 'Preço na Banda Inferior (BB)', weight: 25, status: 'POSITIVE' });
    } else {
      factors.push({ label: 'Preço dentro das Bandas', weight: 0, status: 'NEUTRAL' });
    }
  }

  // --- 2. Oscilador Estocástico (Timing de Entrada) ---
  const stoch = calculateStochastic(highs, lows, closes, 14);
  if (stoch > 80) {
    putScore += 20; // Sobrecompra forte
    factors.push({ label: `Estocástico Sobrecomprado (${stoch.toFixed(0)})`, weight: 20, status: 'NEGATIVE' });
  } else if (stoch < 20) {
    callScore += 20; // Sobrevenda forte
    factors.push({ label: `Estocástico Sobrevendido (${stoch.toFixed(0)})`, weight: 20, status: 'POSITIVE' });
  }

  // --- 3. Análise de Tendência (EMA) ---
  const emaFast = calculateEMA(closes, 9);
  const emaSlow = calculateEMA(closes, 21);
  const lastFast = emaFast[emaFast.length - 1];
  const lastSlow = emaSlow[emaSlow.length - 1];

  if (lastFast > lastSlow) {
    callScore += 15; // Tendência de Alta
    factors.push({ label: 'Tendência de Alta (EMA 9>21)', weight: 15, status: 'POSITIVE' });
  } else {
    putScore += 15; // Tendência de Baixa
    factors.push({ label: 'Tendência de Baixa (EMA 9<21)', weight: 15, status: 'NEGATIVE' });
  }

  // --- 4. Price Action (Psicologia da Vela Atual) ---
  const bodySize = Math.abs(lastCandle.close - lastCandle.open);
  const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
  const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;

  // Shooting Star (Martelo Invertido no topo) - Sinal de PUT forte
  if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5) {
    putScore += 30;
    factors.push({ label: 'Rejeição Superior (Shooting Star)', weight: 30, status: 'NEGATIVE' });
  }
  // Hammer (Martelo no fundo) - Sinal de CALL forte
  else if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
    callScore += 30;
    factors.push({ label: 'Rejeição Inferior (Hammer)', weight: 30, status: 'POSITIVE' });
  }
  // Vela de Força (Corpo Grande, pouco pavio) - Continuação
  else if (bodySize > (lastCandle.high - lastCandle.low) * 0.8) {
    if (lastCandle.close > lastCandle.open) {
      callScore += 20;
      factors.push({ label: 'Vela de Força Compradora', weight: 20, status: 'POSITIVE' });
    } else {
      putScore += 20;
      factors.push({ label: 'Vela de Força Vendedora', weight: 20, status: 'NEGATIVE' });
    }
  }

  // --- Decisão Final ---
  let direction: 'CALL' | 'PUT' | 'NEUTRO' = 'NEUTRO';
  let finalScore = 0;

  // Precisamos de uma diferença clara para dar o sinal
  if (callScore > putScore + 10) {
    direction = 'CALL';
    finalScore = callScore;
  } else if (putScore > callScore + 10) {
    direction = 'PUT';
    finalScore = putScore;
  } else {
    // Mercado indeciso
    finalScore = Math.max(callScore, putScore);
  }

  // Teto de 99%
  if (finalScore > 99) finalScore = 99;

  return {
    direction,
    score: finalScore,
    factors,
    timestamp: Date.now()
  };
}
