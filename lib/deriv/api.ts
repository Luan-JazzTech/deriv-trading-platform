
export class DerivAPI {
    private ws: WebSocket | null = null;
    private token: string | null = null;
    private appId: string = '1089'; // App ID público genérico para testes ou o seu
    private tickSubscriptionId: string | null = null;
    private onTickCallback: ((tick: any) => void) | null = null;
  
    constructor() {
      // Recupera token salvo
      if (typeof window !== 'undefined') {
        this.token = localStorage.getItem('deriv_token');
      }
    }
  
    connect(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          resolve();
          return;
        }
  
        this.ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`);
  
        this.ws.onopen = () => {
          console.log('✅ Conectado à Deriv WebSocket');
          if (this.token) {
            this.authorize(this.token).then(() => resolve());
          } else {
            resolve();
          }
        };
  
        this.ws.onmessage = (msg) => {
          const data = JSON.parse(msg.data);
          
          if (data.msg_type === 'tick' && this.onTickCallback) {
            this.onTickCallback(data.tick);
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
        if (res.error) throw new Error(res.error.message);
        console.log('🔓 Autorizado com sucesso:', res.authorize.email);
        return res;
      });
    }
  
    async getHistory(symbol: string, granularity: number = 60, count: number = 100) {
      // granularity: 60 = 1min, 300 = 5min, 900 = 15min
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
  
      return response.candles.map((c: any) => ({
        time: c.epoch * 1000,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));
    }
  
    subscribeTicks(symbol: string, callback: (tick: any) => void) {
      if (this.tickSubscriptionId) {
        this.send({ forget: this.tickSubscriptionId });
      }
      
      this.onTickCallback = callback;
      this.send({ ticks: symbol }).then(res => {
        if (!res.error) {
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
          reject('WebSocket não conectado');
          return;
        }
  
        // Wrapper simples para pegar a resposta correta (em prod usaria req_id)
        const listener = (msg: MessageEvent) => {
          const response = JSON.parse(msg.data);
          
          // Verifica se a resposta corresponde ao tipo de pedido (simplificado)
          const msgType = Object.keys(data)[0]; 
          if (response.msg_type === msgType || response.msg_type === 'authorize' || response.error) {
             this.ws?.removeEventListener('message', listener);
             resolve(response);
          }
        };
  
        this.ws.addEventListener('message', listener);
        this.ws.send(JSON.stringify(data));
      });
    }
  }
  
  export const derivApi = new DerivAPI();
  