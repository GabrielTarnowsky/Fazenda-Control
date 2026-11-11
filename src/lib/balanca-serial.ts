// balanca-serial.ts — módulo para ler balança RS232 pelo Chrome/Edge (Web Serial).
// Não depende de framework. Use em qualquer tela do FazendaControl.
//
// Uso:
//   import { BalancaSerial } from '@/lib/balanca-serial';
//   const balanca = new BalancaSerial({ baudRate: 9600 });
//   balanca.onPeso = ({ kg, estavel }) => { ... };   // a cada leitura
//   balanca.onEstavel = kg => { ... };               // dispara 1x quando estabiliza
//   balanca.onStatus = (estado, msg) => { ... };     // 'desconectado' | 'conectando' | 'conectado' | 'erro'
//   balanca.onBruto = (texto, bytes) => { ... };     // útil para depurar
//   await balanca.conectar();       // PRECISA ser chamado de um clique do usuário
//   await balanca.reconectar();     // tenta a porta já autorizada, sem janela
//   await balanca.desconectar();

export type BalancaStatus = 'desconectado' | 'conectando' | 'conectado' | 'erro';

export interface BalancaSerialOpcoes {
  baudRate?: number;
  dataBits?: 7 | 8;
  parity?: 'none' | 'even' | 'odd';
  stopBits?: 1 | 2;
  toleranciaKg?: number;     // variação máxima para considerar estável (ex: 0.5)
  janelaEstavelMs?: number; // tempo que o peso precisa ficar dentro da tolerância (ex: 2000)
  pesoMinimoKg?: number;   // ignora leituras abaixo disso (balança vazia/ruído, ex: 5)
  regex?: RegExp | null;     // ex.: /(\d+\.\d+)/ ; null = primeiro número decimal da linha
  quadroTimeoutMs?: number;  // fecha o quadro se não vier CR/LF (ex: 150)
}

interface LeituraHist {
  t: number;
  kg: number;
}

export class BalancaSerial {
  public cfg: Required<BalancaSerialOpcoes>;
  public onPeso: (dados: { kg: number; estavel: boolean }) => void = () => {};
  public onEstavel: (peso: number) => void = () => {};
  public onStatus: (estado: BalancaStatus, msg?: string) => void = () => {};
  public onBruto: (texto: string, bytes: Uint8Array) => void = () => {};

  public port: any = null;
  public reader: any = null;
  public ultimoKg: number | null = null;
  public estavel: boolean = false;

  private _ativo: boolean = false;
  private _buf: number[] = [];
  private _timer: any = null;
  private _hist: LeituraHist[] = [];
  private _jaDisparouEstavel: boolean = false;
  private _dec: TextDecoder = new TextDecoder('latin1');

  constructor(opcoes: BalancaSerialOpcoes = {}) {
    this.cfg = {
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      toleranciaKg: 0.5,
      janelaEstavelMs: 2000,
      pesoMinimoKg: 5,
      regex: null,
      quadroTimeoutMs: 150,
      ...opcoes,
    };
  }

  static suportado(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  static emIframe(): boolean {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  }

  async conectar(): Promise<void> {
    if (!BalancaSerial.suportado()) {
      const err = new Error('Use Chrome ou Edge no computador (Web Serial via HTTPS).');
      this.onStatus('erro', err.message);
      throw err;
    }

    this.onStatus('conectando', 'Aguardando seleção da porta serial...');
    try {
      const nav = navigator as any;
      const port = await nav.serial.requestPort();
      await this._abrir(port);
    } catch (e: any) {
      let msg = e?.message || 'Falha ao acessar porta serial';
      if (e?.name === 'SecurityError' || msg.includes('SecurityError') || msg.includes('Permissions policy')) {
        msg = 'O navegador bloqueou a porta serial dentro do iframe. Abra a aplicação em uma nova aba do Chrome/Edge para conectar.';
      } else if (e?.name === 'NotFoundError' || msg.includes('No port selected')) {
        msg = 'Nenhuma porta serial foi selecionada.';
      } else if (e?.name === 'InvalidStateError' || msg.includes('already open')) {
        msg = 'A porta COM já está aberta por outro programa.';
      }
      this.onStatus('erro', msg);
      throw new Error(msg);
    }
  }

  // Reabre automaticamente a porta que o usuário já autorizou antes.
  async reconectar(): Promise<boolean> {
    if (!BalancaSerial.suportado()) return false;
    try {
      const nav = navigator as any;
      const portas = await nav.serial.getPorts();
      if (!portas.length) return false;
      await this._abrir(portas[0]);
      return true;
    } catch (e: any) {
      this.onStatus('erro', e?.message || 'Erro ao reconectar');
      return false;
    }
  }

  private async _abrir(port: any): Promise<void> {
    const { baudRate, dataBits, parity, stopBits } = this.cfg;
    await port.open({ baudRate, dataBits, parity, stopBits });
    this.port = port;
    this._ativo = true;
    this.onStatus('conectado', 'Balança conectada. Aguardando dados.');
    this._loop();
  }

  private async _loop(): Promise<void> {
    while (this.port && this.port.readable && this._ativo) {
      this.reader = this.port.readable.getReader();
      try {
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) this._receber(value);
        }
      } catch (e: any) {
        if (this._ativo) {
          this.onStatus('erro', 'Cabo desconectado ou erro de leitura: ' + (e?.message || 'Falha na porta'));
          this._ativo = false;
        }
      } finally {
        try {
          this.reader.releaseLock();
        } catch {}
      }
    }
    if (this._ativo === false && this.port) {
      this.onStatus('desconectado', 'Balança desconectada');
    }
  }

  async desconectar(): Promise<void> {
    this._ativo = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {}
      try {
        this.reader.releaseLock();
      } catch {}
      this.reader = null;
    }
    if (this.port) {
      try {
        await this.port.close();
      } catch {}
      this.port = null;
    }
    this._hist = [];
    this.estavel = false;
    this._jaDisparouEstavel = false;
    this.onStatus('desconectado', '');
  }

  // Também serve para testar sem balança: balanca.injetar('ST,GS,  452.3kg\r\n')
  injetar(texto: string): void {
    this._receber(new TextEncoder().encode(texto));
  }

  private _receber(bytes: Uint8Array): void {
    for (const b of bytes) {
      if (b === 13 || b === 10) {
        this._fechar();
      } else {
        this._buf.push(b);
      }
    }
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this._fechar(), this.cfg.quadroTimeoutMs);
  }

  private _fechar(): void {
    if (!this._buf.length) return;
    const bytes = Uint8Array.from(this._buf);
    this._buf = [];
    const texto = this._dec.decode(bytes);
    this.onBruto(texto, bytes);
    const kg = this._extrair(texto);
    if (kg !== null) {
      this._leitura(kg);
    }
  }

  private _extrair(linha: string): number | null {
    if (this.cfg.regex) {
      const m = this.cfg.regex.exec(linha);
      return m ? parseFloat(String(m[1] ?? m[0]).replace(',', '.')) : null;
    }

    // 1. Prioriza número diretamente antes de kg ou g (ex.: "ST,GS,  452.3kg" ou "01, 450 kg")
    const kgMatch = linha.match(/([+-]?\d+(?:[.,]\d+)?)\s*k?g\b/i);
    if (kgMatch && kgMatch[1]) {
      const v = parseFloat(kgMatch[1].replace(',', '.'));
      if (!Number.isNaN(v)) return v;
    }

    // 2. Extrai número decimal com ponto ou vírgula (considerando sinal positivo/negativo)
    const decimals = linha.match(/[+-]?\d+[.,]\d+/g);
    if (decimals && decimals.length > 0) {
      const v = parseFloat(decimals[decimals.length - 1].replace(',', '.'));
      if (!Number.isNaN(v)) return v;
    }

    // 3. Fallback: número inteiro (pega o último número para evitar pegar endereço/ID como "01")
    const nums = linha.match(/[+-]?\d+/g);
    if (!nums || nums.length === 0) return null;
    const n = nums[nums.length - 1];
    const v = parseFloat(n);
    return Number.isNaN(v) ? null : v;
  }

  private _leitura(kg: number): void {
    const agora = Date.now();
    const { janelaEstavelMs, toleranciaKg, pesoMinimoKg } = this.cfg;
    this.ultimoKg = kg;
    this._hist.push({ t: agora, kg });
    this._hist = this._hist.filter(h => agora - h.t <= janelaEstavelMs);
    const h = this._hist;
    const cobre = h.length >= 3 && (h[h.length - 1].t - h[0].t) >= janelaEstavelMs * 0.8;
    const faixa = Math.max(...h.map(x => x.kg)) - Math.min(...h.map(x => x.kg));
    this.estavel = cobre && faixa <= toleranciaKg && kg >= pesoMinimoKg;

    if (this.estavel && !this._jaDisparouEstavel) {
      this._jaDisparouEstavel = true;
      const media = h.reduce((s, x) => s + x.kg, 0) / h.length;
      this.onEstavel(Math.round(media * 10) / 10);
    }

    if (kg < pesoMinimoKg) {
      this._jaDisparouEstavel = false; // animal saiu: libera próxima pesagem
      this._hist = []; // zera o histórico para não misturar leituras com o próximo animal
    }

    this.onPeso({ kg, estavel: this.estavel });
  }
}
