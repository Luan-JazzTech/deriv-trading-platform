
/**
 * Calcula a Média Móvel Simples (SMA)
 */
export function calculateSMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  
  const sma: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
}

/**
 * Calcula a Média Móvel Exponencial (EMA)
 */
export function calculateEMA(data: number[], period: number): number[] {
  if (data.length < period) return [];

  const k = 2 / (period + 1);
  const ema: number[] = [data[0]]; // Ponto de partida simples

  // Primeiro calculamos uma SMA inicial para estabilizar
  // Mas para simplificar em realtime arrays pequenos, usamos o primeiro valor
  
  for (let i = 1; i < data.length; i++) {
    const prevEma = ema[i - 1];
    const currPrice = data[i];
    const newEma = (currPrice * k) + (prevEma * (1 - k));
    ema.push(newEma);
  }

  return ema;
}

/**
 * Calcula o Índice de Força Relativa (RSI)
 * Retorna apenas o valor mais recente (atual)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; // Dados insuficientes

  let gains = 0;
  let losses = 0;

  // Primeiro cálculo (Média simples dos ganhos/perdas iniciais)
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Suavização Wilders para o restante dos dados
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const currentGain = change > 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;

    avgGain = ((avgGain * (period - 1)) + currentGain) / period;
    avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
  }

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Verifica Padrão de Engolfo (Alta ou Baixa) nos últimos 2 candles
 */
export function checkEngulfing(prevOpen: number, prevClose: number, currOpen: number, currClose: number): 'BULLISH' | 'BEARISH' | null {
  const prevBody = Math.abs(prevClose - prevOpen);
  const currBody = Math.abs(currClose - currOpen);

  // Engolfo de Alta
  // Anterior vermelho (Close < Open), Atual verde (Close > Open)
  // Atual abre abaixo do fechamento anterior e fecha acima da abertura anterior
  if (prevClose < prevOpen && currClose > currOpen) {
    if (currOpen <= prevClose && currClose >= prevOpen) {
      return 'BULLISH';
    }
  }

  // Engolfo de Baixa
  // Anterior verde, Atual vermelho
  if (prevClose > prevOpen && currClose < currOpen) {
    if (currOpen >= prevClose && currClose <= prevOpen) {
      return 'BEARISH';
    }
  }

  return null;
}
