
export class DerivAPI {
    private ws: WebSocket | null = null;
    private token: string | null = null;
    private appId: string = '1089'; // App ID público genérico
    private tickSubscriptionId: string | null = null;
    private onTickCallback: ((tick: any) => void) | null = null;
    private onBalanceCallback: ((balance: any) => void) | null = null;
    
    // Controle de Requisições
    private reqIdCounter = 0;
    private pendingRequests = new Map<number, { resolve: (value: any) => void, reject: (reason?: any) => void }>();
  
    constructor() {
      if (typeof window !== 'undefined') {
        this.token = localStorage.getItem('deriv_token');
      }
    }
  
    connect(): Promise<any> {
      return new Promise((resolve, reject) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          resolve(null);
          return;
        }
  
        this.ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`);
  
        this.ws.onopen = () => {
          console.log('✅ Conectado à Deriv WebSocket');
          if (this.token) {
            this.authorize(this.token)
                .then((res) => resolve(res)) // Retorna os dados da conta ao conectar
                .catch(err => {
                    console.error("Falha na autorização inicial:", err);
                    resolve(null); 
                });
          } else {
            resolve(null);
          }
        };
  
        this.ws.onmessage = (msg) => {
          const data = JSON.parse(msg.data);
          
          // 1. Tratamento de Requisições (Response-Request matching)
          if (data.req_id && this.pendingRequests.has(data.req_id)) {
              const { resolve, reject } = this.pendingRequests.get(data.req_id)!;
              
              if (data.error) {
                  console.error("API Error:", data.error);
                  reject(data.error);
              } else {
                  resolve(data);
              }
              this.pendingRequests.delete(data.req_id);
          }

          // 2. Tratamento de Streams (Ticks)
          if (data.msg_type === 'tick' && this.onTickCallback) {
            this.onTickCallback(data.tick);
          }

          // 3. Tratamento de Streams (Saldo/Balance)
          if (data.msg_type === 'balance' && this.onBalanceCallback) {
            this.onBalanceCallback(data.balance);
          }
        };
  
        this.ws.onerror = (err) => {
          console.error('❌ Erro WS Deriv:', err);
          reject(err);
        };
  
        this.ws.onclose = () => {
          console.log('⚠️ Conexão Deriv fechada');
        };
      });
    }
  
    authorize(token: string): Promise<any> {
      return this.send({ authorize: token }).then(res => {
        console.log('🔓 Autorizado:', res.authorize?.email);
        return res;
      });
    }

    subscribeBalance(callback: (balanceData: any) => void) {
        this.onBalanceCallback = callback;
        this.send({ balance: 1, subscribe: 1 });
    }
  
    async getHistory(symbol: string, granularity: number = 60, count: number = 100) {
      try {
          const response = await this.send({
            ticks_history: symbol,
            adjust_start_time: 1,
            count: count,
            end: 'latest',
            start: 1,
            style: 'candles',
            granularity: granularity
          });
      
          if (response.error) {
            console.error('Erro ao buscar histórico:', response.error);
            return [];
          }
          
          const list = response.candles || response.history;
          if (!list) return [];

          // Se for 'candles' (formato OHLC)
          if (response.candles) {
              return response.candles.map((c: any) => ({
                time: c.epoch * 1000,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close
              }));
          }
          
          // Tratamento para ativos que retornam 'history' (apenas ticks/preços) se candles falhar
          return [];

      } catch (e) {
          console.error("Exception getHistory", e);
          return [];
      }
    }
  
    subscribeTicks(symbol: string, callback: (tick: any) => void) {
      // Cancela anterior se existir
      if (this.tickSubscriptionId) {
        this.send({ forget: this.tickSubscriptionId }).catch(() => {});
        this.tickSubscriptionId = null;
      }
      
      this.onTickCallback = callback;
      this.send({ ticks: symbol }).then(res => {
        if (!res.error && res.subscription) {
          this.tickSubscriptionId = res.subscription.id;
        }
      });
    }
  
    async buyContract(symbol: string, contractType: 'CALL' | 'PUT', stake: number, duration: number, durationUnit: 't' | 'm') {
      const payload = {
        buy: 1,
        price: stake,
        parameters: {
          amount: stake,
          basis: 'stake',
          contract_type: contractType,
          currency: 'USD',
          duration: duration,
          duration_unit: durationUnit,
          symbol: symbol
        }
      };
  
      console.log('🚀 Enviando Ordem:', payload);
      return this.send(payload);
    }
  
    private send(data: any): Promise<any> {
      return new Promise((resolve, reject) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          // Tentar reconectar ou falhar
          console.warn("WS não conectado, tentando reconectar...");
          this.connect().then(() => {
              this.send(data).then(resolve).catch(reject);
          }).catch(() => reject('WebSocket Offline'));
          return;
        }

        const req_id = ++this.reqIdCounter;
        this.pendingRequests.set(req_id, { resolve, reject });
        
        const payload = { ...data, req_id };
        this.ws.send(JSON.stringify(payload));
      });
    }
}
  
export const derivApi = new DerivAPI();
