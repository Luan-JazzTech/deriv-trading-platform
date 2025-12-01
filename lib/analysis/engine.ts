
import { calculateEMA, calculateRSI, calculateBollingerBands } from './indicators';

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
  probability: number;
  factors: AnalysisFactor[];
  timestamp: number;
  isSniperReady: boolean; // Indica se passou nos filtros rígidos
}

export function analyzeMarket(candles: Candle[]): AnalysisResult {
  // Mínimo de velas para médias longas (EMA 50)
  if (candles.length < 52) {
    return { direction: 'NEUTRO', score: 0, probability: 50, factors: [], timestamp: Date.now(), isSniperReady: false };
  }

  // Dados Históricos Confirmados (Penúltima vela)
  const confirmedCandles = candles.slice(0, -1); 
  const lastClosed = confirmedCandles[confirmedCandles.length - 1];
  
  const closes = confirmedCandles.map(c => c.close);

  const factors: AnalysisFactor[] = [];
  let callScore = 0;
  let putScore = 0;

  // --- 1. FILTRO DE LATERALIZAÇÃO (SQUEEZE) ---
  // Se as bandas estiverem muito apertadas, não operamos.
  const bb = calculateBollingerBands(closes, 20, 2);
  let isSqueezed = false;
  
  if (bb) {
    const bandwidth = (bb.upper - bb.lower) / bb.middle;
    // Se a largura da banda for muito pequena (ex: 0.05%), mercado está morto
    if (bandwidth < 0.0008) { 
        isSqueezed = true;
        factors.push({ label: '⚠️ Mercado Lateral (Perigoso)', weight: -100, status: 'NEUTRAL' });
    }
  }

  // --- 2. FILTRO DE TENDÊNCIA MACRO (EMA 50) ---
  // Sniper só opera a favor da maré.
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  
  const curEma20 = ema20[ema20.length - 1];
  const curEma50 = ema50[ema50.length - 1];

  let trend: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';

  if (curEma20 > curEma50 && lastClosed.close > curEma50) {
      trend = 'UP';
      callScore += 20; // Bônus base por estar a favor da tendência
      factors.push({ label: 'Tendência Macro de ALTA (Sniper)', weight: 20, status: 'POSITIVE' });
  } else if (curEma20 < curEma50 && lastClosed.close < curEma50) {
      trend = 'DOWN';
      putScore += 20; // Bônus base por estar a favor da tendência
      factors.push({ label: 'Tendência Macro de BAIXA (Sniper)', weight: 20, status: 'NEGATIVE' });
  } else {
      factors.push({ label: 'Tendência Indefinida', weight: 0, status: 'NEUTRAL' });
  }

  // Se o mercado estiver lateral, abortar análise profunda
  if (isSqueezed) {
      return { 
          direction: 'NEUTRO', 
          score: 0, 
          probability: 50, 
          factors, 
          timestamp: Date.now(),
          isSniperReady: false
      };
  }

  // --- 3. GATILHOS DE ENTRADA (Só analisa o lado da tendência) ---

  // RSI
  const rsi = calculateRSI(closes, 14);
  
  // Estratégia CALL (Só se tendência for UP)
  if (trend === 'UP') {
      // Pullback no RSI (Sobrevenda na tendência de alta é ouro)
      if (rsi < 40) { 
          callScore += 30;
          factors.push({ label: 'Oportunidade: Pullback de Alta (RSI)', weight: 30, status: 'POSITIVE' });
      }
      
      // Toque na Banda Inferior (Bateu no suporte da tendência)
      if (bb && lastClosed.low <= bb.lower) {
          callScore += 35;
          factors.push({ label: 'Preço barato na tendência (Banda Inf)', weight: 35, status: 'POSITIVE' });
      }

      // Engolfo de Alta ou Martelo a favor da tendência
      if (lastClosed.close > lastClosed.open) { // Vela verde
          callScore += 10; 
      }
  }

  // Estratégia PUT (Só se tendência for DOWN)
  if (trend === 'DOWN') {
      // Pullback no RSI (Sobrecompra na tendência de baixa é ouro)
      if (rsi > 60) {
          putScore += 30;
          factors.push({ label: 'Oportunidade: Pullback de Baixa (RSI)', weight: 30, status: 'NEGATIVE' });
      }

      // Toque na Banda Superior (Bateu na resistência da tendência)
      if (bb && lastClosed.high >= bb.upper) {
          putScore += 35;
          factors.push({ label: 'Preço caro na tendência (Banda Sup)', weight: 35, status: 'NEGATIVE' });
      }

      // Engolfo de Baixa ou Estrela a favor da tendência
      if (lastClosed.close < lastClosed.open) { // Vela vermelha
          putScore += 10;
      }
  }

  // --- DECISÃO SNIPER ---
  
  let direction: 'CALL' | 'PUT' | 'NEUTRO' = 'NEUTRO';
  let finalScore = 0;
  
  // Score mínimo para Sniper é alto (exige confluência)
  const SNIPER_THRESHOLD = 50; 

  if (trend === 'UP' && callScore >= SNIPER_THRESHOLD) {
      direction = 'CALL';
      finalScore = callScore;
  } else if (trend === 'DOWN' && putScore >= SNIPER_THRESHOLD) {
      direction = 'PUT';
      finalScore = putScore;
  }

  // Cálculo de Probabilidade Realista
  // Base 50%. Máximo 95%.
  let probability = 50 + (finalScore * 0.5);
  
  if (direction === 'NEUTRO') probability = 50;
  if (probability > 95) probability = 95;

  return {
    direction,
    score: finalScore,
    probability: Math.round(probability),
    factors,
    timestamp: Date.now(),
    isSniperReady: probability >= 75 // Só considera "Sniper Ready" se probabilidade for alta
  };
}
