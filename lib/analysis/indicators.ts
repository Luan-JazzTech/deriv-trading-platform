
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
  const ema: number[] = [data[0]]; 
  
  for (let i = 1; i < data.length; i++) {
    const prevEma = ema[i - 1];
    const currPrice = data[i];
    const newEma = (currPrice * k) + (prevEma * (1 - k));
    ema.push(newEma);
  }

  return ema;
}

/**
 * Calcula Desvio Padrão (Necessário para Bollinger)
 */
function calculateStdDev(data: number[], period: number): number[] {
  if (data.length < period) return [];
  
  const stdDevs: number[] = [];
  const sma = calculateSMA(data, period);

  // O array de SMA começa no índice (period - 1) dos dados originais
  // Ajustamos o loop para alinhar
  for (let i = 0; i < sma.length; i++) {
    const sliceStart = i;
    const sliceEnd = i + period;
    const slice = data.slice(sliceStart, sliceEnd);
    const mean = sma[i];
    
    const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    stdDevs.push(Math.sqrt(avgSquaredDiff));
  }
  
  return stdDevs;
}

/**
 * Bandas de Bollinger
 * Retorna { upper, middle, lower } (apenas o último valor)
 */
export function calculateBollingerBands(data: number[], period: number = 20, multiplier: number = 2) {
  if (data.length < period) return null;

  const smaFull = calculateSMA(data, period);
  const stdDevFull = calculateStdDev(data, period);
  
  const lastSMA = smaFull[smaFull.length - 1];
  const lastStdDev = stdDevFull[stdDevFull.length - 1];

  return {
    upper: lastSMA + (lastStdDev * multiplier),
    middle: lastSMA,
    lower: lastSMA - (lastStdDev * multiplier)
  };
}

/**
 * Oscilador Estocástico (%K)
 * Retorna o valor atual (0-100)
 */
export function calculateStochastic(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (closes.length < period) return 50;

  const currentClose = closes[closes.length - 1];
  // Pega os últimos 'period' candles
  const relevantHighs = highs.slice(-period);
  const relevantLows = lows.slice(-period);

  const highestHigh = Math.max(...relevantHighs);
  const lowestLow = Math.min(...relevantLows);

  if (highestHigh === lowestLow) return 50;

  return ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
}

/**
 * Calcula o Índice de Força Relativa (RSI)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; 

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

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
