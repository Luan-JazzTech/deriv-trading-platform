
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
    
    // Lock de Conexão (Evita múltiplas conexões ao mesmo tempo)
    private connectionPromise: Promise<any> | null = null;
  
    constructor() {
      // Token é lido no connect()
    }
  
    connect(): Promise<any> {
      // Se já existe uma conexão em andamento, retorna a promise dela
      if (this.connectionPromise) {
          return this.connectionPromise;
      }

      this.connectionPromise = new Promise((resolve, reject) => {
        // Recarrega token do storage sempre que tentar conectar
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem('deriv_token');
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Se já estiver conectado, revalida autorização
          if (this.token) {
              this.authorize(this.token)
                .then(res => {
                    this.connectionPromise = null; // Libera lock
                    resolve(res);
                })
                .catch(() => {
                    this.connectionPromise = null;
                    resolve(null);
                });
          } else {
              this.connectionPromise = null;
              resolve(null);
          }
          return;
        }
  
        try {
            this.ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`);
        } catch (e) {
            this.connectionPromise = null;
            reject(e);
            return;
        }
  
        this.ws.onopen = () => {
          console.log('✅ Conectado à Deriv WebSocket');
          if (this.token) {
            this.authorize(this.token)
                .then((res) => {
                    this.connectionPromise = null;
                    resolve(res);
                })
                .catch(err => {
                    console.error("Falha na autorização inicial:", err);
                    this.connectionPromise = null;
                    resolve(null); 
                });
          } else {
            this.connectionPromise = null;
            resolve(null);
          }
        };
  
        this.ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            
            // 1. Tratamento de Requisições
            if (data.req_id && this.pendingRequests.has(data.req_id)) {
                const { resolve, reject } = this.pendingRequests.get(data.req_id)!;
                
                if (data.error) {
                    console.error("API Error:", data.error);
                    // Não rejeita promise de conexão se for erro de auth, só loga
                    resolve(data); 
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
          } catch (e) {
              console.error("Erro ao processar mensagem WS:", e);
          }
        };
  
        this.ws.onerror = (err) => {
          console.error('❌ Erro WS Deriv:', err);
          this.connectionPromise = null;
          reject(err);
        };
  
        this.ws.onclose = () => {
          console.log('⚠️ Conexão Deriv fechada');
          this.ws = null;
          this.connectionPromise = null;
        };
      });

      return this.connectionPromise;
    }
  
    authorize(token: string): Promise<any> {
      return this.send({ authorize: token }).then(res => {
        if (res.authorize) {
            console.log('🔓 Autorizado:', res.authorize?.email);
        }
        return res;
      });
    }

    subscribeBalance(callback: (balanceData: any) => void) {
        this.onBalanceCallback = callback;
        if (this.ws?.readyState === WebSocket.OPEN) {
             this.send({ balance: 1, subscribe: 1 }).catch(() => {});
        }
    }
  
    async getHistory(symbol: string, granularity: number = 60, count: number = 100) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          await this.connect();
      }

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
          if (response.history) {
             // Fallback para ticks se candles falhar
             return [];
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
           // Tenta reconectar e enviar
           this.connect().then(() => {
              if (this.ws?.readyState === WebSocket.OPEN) {
                 const req_id = ++this.reqIdCounter;
                 this.pendingRequests.set(req_id, { resolve, reject });
                 this.ws.send(JSON.stringify({ ...data, req_id }));
              } else {
                 reject({ message: 'WebSocket Offline e falha ao reconectar' });
              }
           }).catch((e) => reject({ message: 'WebSocket Offline', error: e }));
           return;
        }

        const req_id = ++this.reqIdCounter;
        this.pendingRequests.set(req_id, { resolve, reject });
        this.ws.send(JSON.stringify({ ...data, req_id }));
      });
    }
}
  
export const derivApi = new DerivAPI();
