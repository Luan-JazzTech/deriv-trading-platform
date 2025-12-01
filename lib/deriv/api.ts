
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
      // Token é lido no connect() para garantir atualização
    }
  
    connect(): Promise<any> {
      return new Promise((resolve, reject) => {
        // Recarrega token do storage sempre que tentar conectar
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem('deriv_token');
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Se já estiver conectado, revalida autorização
          if (this.token) {
              this.authorize(this.token).then(resolve).catch(() => resolve(null));
          } else {
              resolve(null);
          }
          return;
        }
  
        this.ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`);
  
        this.ws.onopen = () => {
          console.log('✅ Conectado à Deriv WebSocket');
          if (this.token) {
            this.authorize(this.token)
                .then((res) => resolve(res))
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
          
          // 1. Tratamento de Requisições
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

          // 2. Streams
          if (data.msg_type === 'tick' && this.onTickCallback) {
            this.onTickCallback(data.tick);
          }
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
          this.ws = null;
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
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return [];

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
      
          if (response.error) return [];
          
          if (response.candles) {
              return response.candles.map((c: any) => ({
                time: c.epoch * 1000,
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close)
              }));
          }
          return [];
      } catch (e) {
          console.error("Exception getHistory", e);
          return [];
      }
    }
  
    subscribeTicks(symbol: string, callback: (tick: any) => void) {
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
      return this.send(payload);
    }
  
    private send(data: any): Promise<any> {
      return new Promise((resolve, reject) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.connect().then(() => {
              // Tenta enviar novamente após reconectar
              if (this.ws?.readyState === WebSocket.OPEN) {
                 const req_id = ++this.reqIdCounter;
                 this.pendingRequests.set(req_id, { resolve, reject });
                 this.ws.send(JSON.stringify({ ...data, req_id }));
              } else {
                 reject('Failed to reconnect');
              }
          }).catch(() => reject('WebSocket Offline'));
          return;
        }

        const req_id = ++this.reqIdCounter;
        this.pendingRequests.set(req_id, { resolve, reject });
        this.ws.send(JSON.stringify({ ...data, req_id }));
      });
    }
}
  
export const derivApi = new DerivAPI();
