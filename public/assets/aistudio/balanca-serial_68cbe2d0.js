// balanca-serial.js — módulo para ler balança RS232 pelo Chrome/Edge (Web Serial).
// Não depende de framework. Use em qualquer tela do FazendaControl.
//
// Uso:
//   import { BalancaSerial } from './balanca-serial.js';
//   const balanca = new BalancaSerial({ baudRate: 9600 });
//   balanca.onPeso = ({ kg, estavel }) => { ... };   // a cada leitura
//   balanca.onEstavel = kg => { ... };               // dispara 1x quando estabiliza
//   balanca.onStatus = (estado, msg) => { ... };     // 'desconectado' | 'conectando' | 'conectado' | 'erro'
//   balanca.onBruto = (texto, bytes) => { ... };     // útil para depurar
//   await balanca.conectar();       // PRECISA ser chamado de um clique do usuário
//   await balanca.reconectar();     // tenta a porta já autorizada, sem janela
//   await balanca.desconectar();

export class BalancaSerial {
  constructor(opcoes = {}) {
    this.cfg = {
      baudRate: 9600, dataBits: 8, parity: 'none', stopBits: 1,
      toleranciaKg: 0.5,     // variação máxima para considerar estável
      janelaEstavelMs: 2000, // tempo que o peso precisa ficar dentro da tolerância
      pesoMinimoKg: 5,       // ignora leituras abaixo disso (balança vazia/ruído)
      regex: null,           // ex.: /(\d+\.\d+)/ ; null = primeiro número decimal da linha
      quadroTimeoutMs: 150,  // fecha o quadro se não vier CR/LF
      ...opcoes,
    };
    this.onPeso = () => {}; this.onEstavel = () => {};
    this.onStatus = () => {}; this.onBruto = () => {};
    this.port = null; this.reader = null; this._ativo = false;
    this._buf = []; this._timer = null; this._hist = [];
    this._jaDisparouEstavel = false; this.ultimoKg = null; this.estavel = false;
    this._dec = new TextDecoder('latin1');
  }

  static suportado() { return typeof navigator !== 'undefined' && 'serial' in navigator; }

  async conectar() {
    if (!BalancaSerial.suportado()) throw new Error('Use Chrome ou Edge no computador (Web Serial).');
    this.onStatus('conectando', '');
    try {
      const port = await navigator.serial.requestPort();
      await this._abrir(port);
    } catch (e) { this.onStatus('erro', e.message); throw e; }
  }

  // Reabre automaticamente a porta que o usuário já autorizou antes.
  async reconectar() {
    if (!BalancaSerial.suportado()) return false;
    const portas = await navigator.serial.getPorts();
    if (!portas.length) return false;
    try { await this._abrir(portas[0]); return true; }
    catch (e) { this.onStatus('erro', e.message); return false; }
  }

  async _abrir(port) {
    const { baudRate, dataBits, parity, stopBits } = this.cfg;
    await port.open({ baudRate, dataBits, parity, stopBits });
    this.port = port; this._ativo = true;
    this.onStatus('conectado', 'Aguardando dados da balança');
    this._loop();
  }

  async _loop() {
    while (this.port && this.port.readable && this._ativo) {
      this.reader = this.port.readable.getReader();
      try {
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) this._receber(value);
        }
      } catch (e) {
        if (this._ativo) { this.onStatus('erro', 'Cabo desconectado ou erro de leitura: ' + e.message); this._ativo = false; }
      } finally { this.reader.releaseLock(); }
    }
    if (this._ativo === false && this.port) this.onStatus('desconectado', '');
  }

  async desconectar() {
    this._ativo = false;
    try { await this.reader?.cancel(); } catch {}
    try { await this.port?.close(); } catch {}
    this.port = null; this._hist = []; this.estavel = false;
    this.onStatus('desconectado', '');
  }

  // Também serve para testar sem balança: balanca.injetar('ST,GS,  452.3kg\r\n')
  injetar(texto) { this._receber(new TextEncoder().encode(texto)); }

  _receber(bytes) {
    for (const b of bytes) { if (b === 13 || b === 10) this._fechar(); else this._buf.push(b); }
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._fechar(), this.cfg.quadroTimeoutMs);
  }

  _fechar() {
    if (!this._buf.length) return;
    const bytes = Uint8Array.from(this._buf); this._buf = [];
    const texto = this._dec.decode(bytes);
    this.onBruto(texto, bytes);
    const kg = this._extrair(texto);
    if (kg !== null) this._leitura(kg);
  }

  _extrair(linha) {
    if (this.cfg.regex) {
      const m = this.cfg.regex.exec(linha);
      return m ? parseFloat(String(m[1] ?? m[0]).replace(',', '.')) : null;
    }
    const nums = linha.match(/\d+[.,]\d+|\d+/g);
    if (!nums) return null;
    const n = nums.find(x => /[.,]/.test(x)) ?? nums[0];
    const v = parseFloat(n.replace(',', '.'));
    return Number.isNaN(v) ? null : v;
  }

  _leitura(kg) {
    const agora = Date.now(), { janelaEstavelMs, toleranciaKg, pesoMinimoKg } = this.cfg;
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
    if (kg < pesoMinimoKg) this._jaDisparouEstavel = false; // animal saiu: libera próxima pesagem
    this.onPeso({ kg, estavel: this.estavel });
  }
}
