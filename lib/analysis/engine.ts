
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

  // --- 1. Bandas de Bollinger (Estratégia: Fechou fora -> Reverte) ---
  const bb = calculateBollingerBands(closes, 20, 2);
  if (bb) {
    // Se a vela fechada rompeu ou tocou a banda superior
    if (lastClosed.high >= bb.upper) {
      putScore += 30;
      factors.push({ label: 'Preço testou Banda Superior', weight: 30, status: 'NEGATIVE' });
    }
    // Se a vela fechada rompeu ou tocou a banda inferior
    else if (lastClosed.low <= bb.lower) {
      callScore += 30;
      factors.push({ label: 'Preço testou Banda Inferior', weight: 30, status: 'POSITIVE' });
    }
  }

  // --- 2. RSI (Filtro de Tendência e Exaustão) ---
  const rsi = calculateRSI(closes, 14);
  if (rsi > 70) {
    putScore += 20;
    factors.push({ label: `RSI em Sobrecompra (${rsi.toFixed(0)})`, weight: 20, status: 'NEGATIVE' });
  } else if (rsi < 30) {
    callScore += 20;
    factors.push({ label: `RSI em Sobrevenda (${rsi.toFixed(0)})`, weight: 20, status: 'POSITIVE' });
  } else {
    // RSI neutro (entre 40 e 60) geralmente indica continuação da tendência da EMA
    factors.push({ label: 'RSI em zona neutra', weight: 0, status: 'NEUTRAL' });
  }

  // --- 3. Tendência Macro (EMA Cruzada) ---
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const currentEma9 = ema9[ema9.length - 1];
  const currentEma21 = ema21[ema21.length - 1];

  if (currentEma9 > currentEma21) {
    callScore += 10; // Viés de alta
    factors.push({ label: 'Tendência de Alta (EMA)', weight: 10, status: 'POSITIVE' });
  } else {
    putScore += 10; // Viés de baixa
    factors.push({ label: 'Tendência de Baixa (EMA)', weight: 10, status: 'NEGATIVE' });
  }

  // --- 4. Price Action Avançado (Vela Confirmada) ---
  const bodySize = Math.abs(lastClosed.close - lastClosed.open);
  const totalSize = lastClosed.high - lastClosed.low;
  const upperWick = lastClosed.high - Math.max(lastClosed.open, lastClosed.close);
  const lowerWick = Math.min(lastClosed.open, lastClosed.close) - lastClosed.low;
  
  // Evitar divisão por zero em velas doji perfeitas
  const safeTotalSize = totalSize === 0 ? 0.00001 : totalSize;

  // Padrão: Martelo (Rejeição de Fundo) -> CALL
  // Pavio inferior deve ser pelo menos 2x o tamanho do corpo
  if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
    callScore += 35; // Peso alto, padrão forte
    factors.push({ label: 'Padrão Hammer (Martelo)', weight: 35, status: 'POSITIVE' });
  }

  // Padrão: Shooting Star (Rejeição de Topo) -> PUT
  // Pavio superior deve ser pelo menos 2x o tamanho do corpo
  if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5) {
    putScore += 35; // Peso alto, padrão forte
    factors.push({ label: 'Padrão Shooting Star', weight: 35, status: 'NEGATIVE' });
  }

  // Padrão: Engolfo (Comparar com a antepenúltima vela)
  const prevCandle = confirmedCandles[confirmedCandles.length - 2];
  if (prevCandle) {
    const prevBody = Math.abs(prevCandle.close - prevCandle.open);
    // Engolfo de Alta
    if (lastClosed.close > lastClosed.open && prevCandle.close < prevCandle.open && bodySize > prevBody) {
        callScore += 25;
        factors.push({ label: 'Engolfo de Alta', weight: 25, status: 'POSITIVE' });
    }
    // Engolfo de Baixa
    if (lastClosed.close < lastClosed.open && prevCandle.close > prevCandle.open && bodySize > prevBody) {
        putScore += 25;
        factors.push({ label: 'Engolfo de Baixa', weight: 25, status: 'NEGATIVE' });
    }
  }

  // --- Decisão Final e Cálculo de Probabilidade ---
  let direction: 'CALL' | 'PUT' | 'NEUTRO' = 'NEUTRO';
  let rawScore = 0;

  // Diferencial mínimo para operar
  const THRESHOLD = 15;

  if (callScore > putScore + THRESHOLD) {
    direction = 'CALL';
    rawScore = callScore;
  } else if (putScore > callScore + THRESHOLD) {
    direction = 'PUT';
    rawScore = putScore;
  } else {
    // Se estiver muito equilibrado, é neutro
    rawScore = Math.max(callScore, putScore);
  }

  // Normalizar Score (Teto 100)
  if (rawScore > 100) rawScore = 100;

  // --- Cálculo de Probabilidade (%) ---
  // Base: 50% (Aleatório).
  // Cada ponto de Score adiciona confiança.
  // Score 100 -> ~92% (Nada é 100% no mercado)
  // Score 20  -> ~55%
  let probability = 50 + (rawScore * 0.42); 
  
  // Penalidade de Volatilidade Baixa (Doji)
  if (bodySize < safeTotalSize * 0.1) {
    probability -= 10;
    factors.push({ label: 'Baixa Volatilidade (Risco)', weight: -10, status: 'NEUTRAL' });
  }

  // Arredondar
  probability = Math.min(Math.max(probability, 50), 95);

  return {
    direction,
    score: rawScore,
    probability: Math.round(probability),
    factors,
    timestamp: Date.now()
  };
}
