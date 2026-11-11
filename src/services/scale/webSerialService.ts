import { SerialConfig, ScaleReading, DEFAULT_SERIAL_CONFIG } from "./types";
import { AlfaScaleParser, defaultAlfaParser } from "./alfaParser";

export interface SerialDebugFrame {
  id: string;
  timestamp: string;
  rawAscii: string;
  rawHex: string;
  parsedWeight?: number;
  isStable?: boolean;
  protocol?: string;
  statusNote?: string;
}

export type SerialConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * Detecta se a aplicação está executando dentro de um iframe (como no preview do Google AI Studio)
 */
export function isRunningInIframe(): boolean {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    // Cross-origin iframe bloqueia acesso a window.top gerando exceção
    return true;
  }
}

export class WebSerialService {
  private port: any = null;
  private reader: any = null;
  private readableStreamClosed: Promise<void> | null = null;
  private keepReading = false;
  private parser: AlfaScaleParser;
  private config: SerialConfig;
  private status: SerialConnectionStatus = "disconnected";
  private errorMessage: string | null = null;
  private connectedPortInfo: string = "";

  // Buffer circular de diagnóstico (últimos 50 frames brutos em tempo real)
  private debugFrames: SerialDebugFrame[] = [];
  private maxDebugFrames = 50;

  // Listeners
  private onReadingListeners: ((reading: ScaleReading) => void)[] = [];
  private onStatusListeners: ((status: SerialConnectionStatus, error?: string | null, portInfo?: string) => void)[] = [];
  private onDebugListeners: ((frame: SerialDebugFrame) => void)[] = [];

  constructor(config?: Partial<SerialConfig>, parser?: AlfaScaleParser) {
    this.parser = parser || defaultAlfaParser;
    this.config = {
      ...DEFAULT_SERIAL_CONFIG,
      ...config
    };
    if (this.config.modbusConfig) {
      this.parser.setModbusConfig(this.config.modbusConfig);
    }
    this.parser.setProtocol(this.config.protocol);

    // Monitora evento nativo de desconexão física do dispositivo USB/Serial no navegador
    if (typeof navigator !== "undefined" && "serial" in navigator) {
      (navigator as any).serial.addEventListener("disconnect", (event: any) => {
        if (this.port && event.target === this.port) {
          this.handleDisconnect("O cabo serial/USB da balança Alfa foi desconectado fisicamente do computador.");
        }
      });
    }
  }

  /**
   * Verifica se o navegador atual suporta a Web Serial API nativa
   */
  public isWebSerialSupported(): boolean {
    return typeof navigator !== "undefined" && Boolean((navigator as any).serial);
  }

  public isInIframe(): boolean {
    return isRunningInIframe();
  }

  public getStatus(): SerialConnectionStatus {
    return this.status;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public getConnectedPortInfo(): string {
    return this.connectedPortInfo;
  }

  public getConfig(): SerialConfig {
    return { ...this.config };
  }

  public setConfig(newConfig: Partial<SerialConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.protocol) {
      this.parser.setProtocol(newConfig.protocol);
    }
    if (newConfig.modbusConfig) {
      this.parser.setModbusConfig(newConfig.modbusConfig);
    }
  }

  public getParser(): AlfaScaleParser {
    return this.parser;
  }

  public getDebugFrames(): SerialDebugFrame[] {
    return [...this.debugFrames];
  }

  public onReading(cb: (reading: ScaleReading) => void): () => void {
    this.onReadingListeners.push(cb);
    return () => {
      this.onReadingListeners = this.onReadingListeners.filter(l => l !== cb);
    };
  }

  public onStatusChange(cb: (status: SerialConnectionStatus, error?: string | null, portInfo?: string) => void): () => void {
    this.onStatusListeners.push(cb);
    return () => {
      this.onStatusListeners = this.onStatusListeners.filter(l => l !== cb);
    };
  }

  public onDebugFrame(cb: (frame: SerialDebugFrame) => void): () => void {
    this.onDebugListeners.push(cb);
    return () => {
      this.onDebugListeners = this.onDebugListeners.filter(l => l !== cb);
    };
  }

  /**
   * Abre o diálogo nativo do navegador para o usuário selecionar a porta COM e inicia a leitura.
   * Aciona navigator.serial.requestPort() por interação direta do usuário.
   */
  public async connectSerial(): Promise<void> {
    // 1. Verificação de compatibilidade com mensagem clara e amigável
    if (!this.isWebSerialSupported()) {
      const isHttps = typeof window !== "undefined" && (
        window.location.protocol === "https:" || 
        window.location.hostname === "localhost" || 
        window.location.hostname === "127.0.0.1"
      );

      const msg = !isHttps
        ? "A Web Serial API requer uma conexão segura (HTTPS). Acesse o sistema via HTTPS no Google Chrome ou Microsoft Edge."
        : "A Web Serial API não está disponível neste navegador. Para conectar a balança Alfa 3102C.S via cabo serial/USB, utilize o Google Chrome ou Microsoft Edge (versão 89 ou superior) em um computador ou notebook.";
      
      this.setStatus("error", msg);
      throw new Error(msg);
    }

    try {
      this.setStatus("connecting");

      // 2. Abre seletor nativo do navegador sem fixar COM específica (filters: [] permite qualquer conversor USB-Serial)
      this.port = await (navigator as any).serial.requestPort({ filters: [] });

      // Obtém informações do conversor USB conectado (se disponíveis pelo SO)
      let infoLabel = "Porta Serial";
      try {
        const info = this.port.getInfo();
        if (info && (info.usbVendorId || info.usbProductId)) {
          const vid = info.usbVendorId ? info.usbVendorId.toString(16).padStart(4, "0").toUpperCase() : "";
          const pid = info.usbProductId ? info.usbProductId.toString(16).padStart(4, "0").toUpperCase() : "";
          infoLabel = `Adaptador USB-Serial [VID:${vid} PID:${pid}]`;
        }
      } catch {}
      this.connectedPortInfo = infoLabel;

      // 3. Abre a porta com os parâmetros padrão da Alfa 3102C.S: baudRate 9600, 8 dataBits, 1 stopBit e parity "none"
      await this.port.open({
        baudRate: Number(this.config.baudRate) || 9600,
        dataBits: Number(this.config.dataBits) || 8,
        stopBits: Number(this.config.stopBits) || 1,
        parity: this.config.parity || "none",
        bufferSize: 4096
      });

      this.keepReading = true;
      this.setStatus("connected", null);

      // 4. Inicia loop assíncrono contínuo de leitura
      this.startContinuousReader();
    } catch (err: any) {
      if (err.name === "NotFoundError") {
        // Usuário cancelou o diálogo de seleção de porta
        this.setStatus("disconnected", null);
        throw new Error("Nenhuma porta serial foi selecionada.");
      }

      // Detecção de restrição de iframe (Preview do AI Studio / Permissions Policy)
      const isIframe = isRunningInIframe();
      const isSecurityError = err.name === "SecurityError" || 
        String(err.message || "").toLowerCase().includes("permission") ||
        String(err.message || "").toLowerCase().includes("policy") ||
        String(err.message || "").toLowerCase().includes("disallowed");

      if (isSecurityError && isIframe) {
        const iframeMsg = "Acesso à porta serial bloqueado pelo preview (iframe) do AI Studio. Para conectar a balança Alfa 3102C.S ao computador, abra a aplicação em uma nova aba (botão 'Open in new tab' ou acesse o link direto).";
        this.handleDisconnect(iframeMsg);
        throw new Error(iframeMsg);
      }

      // Porta já em uso
      if (err.name === "InvalidStateError" || 
          String(err.message || "").toLowerCase().includes("already open") || 
          String(err.message || "").toLowerCase().includes("in use")) {
        const busyMsg = "A porta serial selecionada já está aberta ou sendo utilizada por outro programa (ex: software da Alfa, Arduino IDE, PuTTY ou outra aba). Feche os outros programas e tente novamente.";
        this.handleDisconnect(busyMsg);
        throw new Error(busyMsg);
      }

      const errMsg = err.message || "Falha ao abrir comunicação com a porta serial selecionada.";
      this.handleDisconnect(errMsg);
      throw new Error(errMsg);
    }
  }

  /**
   * Encerra a conexão com a balança e libera a porta serial no navegador
   */
  public async disconnect(): Promise<void> {
    this.keepReading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {}
      try {
        this.reader.releaseLock();
      } catch {}
      this.reader = null;
    }

    if (this.readableStreamClosed) {
      try {
        await this.readableStreamClosed.catch(() => {});
      } catch {}
      this.readableStreamClosed = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {}
      this.port = null;
    }

    this.connectedPortInfo = "";
    this.setStatus("disconnected", null);
  }

  /**
   * Leitura contínua dos dados recebidos pela porta serial.
   * Utiliza TextDecoderStream para o fluxo contínuo TRC da Alfa 3102C.S,
   * acumulando em buffer e separando por quebra de linha (/\r?\n/).
   */
  private async startContinuousReader(): Promise<void> {
    if (!this.port || !this.port.readable) return;

    // Se o protocolo for Modbus RTU binário
    if (this.config.protocol === "modbus_rtu") {
      this.startBinaryModbusReader();
      return;
    }

    // Protocolos de texto (TRC da Alfa 3102C.S, T02, ASCII Simples)
    try {
      let textBuffer = "";

      // Utiliza TextDecoderStream nativo do navegador
      if (typeof TextDecoderStream !== "undefined") {
        const textDecoder = new TextDecoderStream();
        this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
        this.reader = textDecoder.readable.getReader();

        while (this.keepReading) {
          const { value, done } = await this.reader.read();
          if (done) break;

          if (value) {
            textBuffer += value;
            // Separa por quebra de linha CRLF padrão da transmissão contínua TRC da Alfa
            const lines = textBuffer.split(/\r?\n/);
            // Mantém no buffer o fragmento incompleto que ainda não recebeu quebra de linha
            textBuffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.length > 0) {
                this.handleRawLine(trimmed);
              }
            }
          }
        }
      } else {
        // Fallback robusto com TextDecoder para ambientes sem TextDecoderStream
        this.reader = this.port.readable.getReader();
        const decoder = new TextDecoder("ascii", { fatal: false });

        while (this.keepReading && this.port?.readable) {
          const { value, done } = await this.reader.read();
          if (done) break;

          if (value && value.length > 0) {
            textBuffer += decoder.decode(value);
            const lines = textBuffer.split(/\r?\n/);
            textBuffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.length > 0) {
                this.handleRawLine(trimmed);
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (this.keepReading) {
        this.handleDisconnect(`Comunicação serial interrompida: ${err.message || "Erro de leitura na porta"}`);
      }
    } finally {
      try {
        this.reader?.releaseLock();
      } catch {}
    }
  }

  /**
   * Leitura contínua para protocolos binários Modbus RTU
   */
  private async startBinaryModbusReader(): Promise<void> {
    if (!this.port || !this.port.readable) return;

    this.reader = this.port.readable.getReader();
    let modbusBuffer = new Uint8Array(0);

    try {
      while (this.keepReading && this.port?.readable) {
        const { value, done } = await this.reader.read();
        if (done) break;

        if (value && value.length > 0) {
          const combined = new Uint8Array(modbusBuffer.length + value.length);
          combined.set(modbusBuffer);
          combined.set(value, modbusBuffer.length);
          modbusBuffer = combined;

          // Alinhamento e extração de múltiplos quadros no buffer binário
          while (modbusBuffer.length >= 5) {
            const fc = modbusBuffer[1];
            if (fc !== 0x03 && fc !== 0x04) {
              modbusBuffer = modbusBuffer.slice(1);
              continue;
            }

            const byteCount = modbusBuffer[2];
            const expectedFrameLength = 3 + byteCount + 2;

            if (expectedFrameLength > 260) {
              modbusBuffer = modbusBuffer.slice(1);
              continue;
            }

            if (modbusBuffer.length < expectedFrameLength) {
              break;
            }

            const candidate = modbusBuffer.slice(0, expectedFrameLength);
            const reading = this.parser.parseModbusRTU(candidate, this.config.modbusConfig);

            if (reading) {
              this.recordDebugFrame(reading.raw, reading, "Quadro Modbus RTU decodificado com sucesso");
              this.onReadingListeners.forEach(l => l(reading));
              modbusBuffer = modbusBuffer.slice(expectedFrameLength);
            } else {
              modbusBuffer = modbusBuffer.slice(1);
            }
          }

          if (modbusBuffer.length > 512) {
            modbusBuffer = modbusBuffer.slice(-64);
          }
        }
      }
    } catch (err: any) {
      if (this.keepReading) {
        this.handleDisconnect(`Comunicação serial interrompida: ${err.message || "Erro de leitura na porta"}`);
      }
    } finally {
      try {
        this.reader?.releaseLock();
      } catch {}
    }
  }

  /**
   * Processa uma linha completa recebida da balança
   */
  public handleRawLine(rawLine: string): void {
    const parsed = this.parser.parseLine(rawLine);
    this.recordDebugFrame(
      rawLine, 
      parsed, 
      parsed ? "Linha decodificada com sucesso" : "Linha não reconhecida pelo protocolo configurado"
    );

    if (parsed) {
      this.onReadingListeners.forEach(l => l(parsed));
    }
  }

  private recordDebugFrame(raw: string, parsed: ScaleReading | null, statusNote?: string): void {
    const debugFrame: SerialDebugFrame = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour12: false }) + "." + String(Date.now() % 1000).padStart(3, "0"),
      rawAscii: raw,
      rawHex: this.asciiToHex(raw),
      parsedWeight: parsed ? parsed.weight : undefined,
      isStable: parsed ? parsed.isStable : undefined,
      protocol: this.config.protocol,
      statusNote
    };

    this.debugFrames.unshift(debugFrame);
    if (this.debugFrames.length > this.maxDebugFrames) {
      this.debugFrames.pop();
    }

    this.onDebugListeners.forEach(l => l(debugFrame));
  }

  private handleDisconnect(errorReason?: string): void {
    this.keepReading = false;
    this.port = null;
    this.reader = null;
    this.readableStreamClosed = null;
    this.connectedPortInfo = "";
    this.setStatus("disconnected", errorReason || null);
  }

  private setStatus(status: SerialConnectionStatus, error: string | null = null): void {
    this.status = status;
    this.errorMessage = error;
    this.onStatusListeners.forEach(l => l(status, error, this.connectedPortInfo));
  }

  private asciiToHex(str: string): string {
    return Array.from(str)
      .map(char => char.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase())
      .join(" ");
  }
}

export const defaultWebSerialService = new WebSerialService();
