import { SerialConfig, ScaleReading } from "./types";
import { AlfaScaleParser, defaultAlfaParser } from "./alfaParser";

export interface SerialDebugFrame {
  id: string;
  timestamp: string;
  rawAscii: string;
  rawHex: string;
  parsedWeight?: number;
  isStable?: boolean;
}

export type SerialConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export class WebSerialService {
  private port: any = null;
  private reader: any = null;
  private keepReading = false;
  private parser: AlfaScaleParser;
  private config: SerialConfig;
  private status: SerialConnectionStatus = "disconnected";
  private errorMessage: string | null = null;
  
  // Debug Log Buffer (últimos 40 frames para diagnóstico de técnicos no curral)
  private debugFrames: SerialDebugFrame[] = [];
  private maxDebugFrames = 40;

  // Web Socket Bridge para modo alternativo (ex: serviço Windows)
  private wsBridge: WebSocket | null = null;
  private isUsingBridge = false;

  // Listeners
  private onReadingListeners: ((reading: ScaleReading) => void)[] = [];
  private onStatusListeners: ((status: SerialConnectionStatus, error?: string | null) => void)[] = [];
  private onDebugListeners: ((frame: SerialDebugFrame) => void)[] = [];

  constructor(config?: Partial<SerialConfig>, parser?: AlfaScaleParser) {
    this.parser = parser || defaultAlfaParser;
    this.config = {
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      protocol: "auto_detect",
      ...config
    };

    // Monitora evento nativo de desconexão de dispositivo USB
    if (typeof navigator !== "undefined" && "serial" in navigator) {
      (navigator as any).serial.addEventListener("disconnect", (event: any) => {
        if (this.port && event.target === this.port) {
          this.handleDisconnect("Cabo serial da balança foi desconectado fisicamente.");
        }
      });
    }
  }

  public isWebSerialSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  public getStatus(): SerialConnectionStatus {
    return this.status;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public getConfig(): SerialConfig {
    return { ...this.config };
  }

  public setConfig(newConfig: Partial<SerialConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.protocol) {
      this.parser.setProtocol(newConfig.protocol);
    }
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

  public onStatusChange(cb: (status: SerialConnectionStatus, error?: string | null) => void): () => void {
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
   * Solicita autorização do usuário e conecta à porta serial do notebook
   */
  public async connectSerial(): Promise<void> {
    if (!this.isWebSerialSupported()) {
      throw new Error(
        "Web Serial API não é suportada neste navegador. Utilize o Google Chrome ou Microsoft Edge no notebook, ou utilize a ponte WebSocket."
      );
    }

    try {
      this.setStatus("connecting");

      // Abre diálogo nativo do navegador para o usuário selecionar a porta COM da Alfa 3102C.S
      this.port = await (navigator as any).serial.requestPort({ filters: [] });

      await this.port.open({
        baudRate: this.config.baudRate,
        dataBits: this.config.dataBits,
        stopBits: this.config.stopBits,
        parity: this.config.parity,
        bufferSize: 4096
      });

      this.keepReading = true;
      this.setStatus("connected");
      this.isUsingBridge = false;

      // Inicia leitura assíncrona contínua do fluxo serial
      this.readSerialLoop();
    } catch (err: any) {
      const msg = err.name === "NotFoundError" 
        ? "Nenhuma porta serial foi selecionada pelo usuário."
        : err.message || "Erro ao conectar à porta serial da balança.";
      
      this.handleDisconnect(msg);
      throw new Error(msg);
    }
  }

  /**
   * Conecta através de uma ponte WebSocket local (ex: script local no Windows ws://localhost:8080)
   */
  public async connectWebSocketBridge(url = "ws://localhost:8080"): Promise<void> {
    try {
      this.setStatus("connecting");
      if (this.wsBridge) {
        this.wsBridge.close();
      }

      this.wsBridge = new WebSocket(url);
      this.isUsingBridge = true;

      this.wsBridge.onopen = () => {
        this.setStatus("connected");
      };

      this.wsBridge.onmessage = (event) => {
        const text = typeof event.data === "string" ? event.data : "";
        this.processIncomingChunk(text);
      };

      this.wsBridge.onerror = () => {
        this.handleDisconnect(`Não foi possível conectar ao serviço de balança em ${url}. Verifique se o script local está em execução.`);
      };

      this.wsBridge.onclose = () => {
        if (this.status === "connected") {
          this.handleDisconnect("Conexão com a ponte de balança foi encerrada.");
        }
      };
    } catch (err: any) {
      this.handleDisconnect(err.message || "Erro na conexão WebSocket");
      throw err;
    }
  }

  /**
   * Encerra a conexão com a balança e libera a porta serial
   */
  public async disconnect(): Promise<void> {
    this.keepReading = false;

    if (this.wsBridge) {
      try {
        this.wsBridge.close();
      } catch {}
      this.wsBridge = null;
    }

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {}
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {}
      this.port = null;
    }

    this.setStatus("disconnected");
  }

  /**
   * Loop contínuo de leitura e decodificação de linhas
   */
  private async readSerialLoop(): Promise<void> {
    let textBuffer = "";
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }

        if (value) {
          textBuffer += value;

          // Processa linhas completas terminadas em \n ou \r
          const lines = textBuffer.split(/[\r\n]+/);
          // O último elemento pode ser incompleto, mantemos no buffer
          textBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              this.handleRawLine(trimmed);
            }
          }
        }
      }
    } catch (err: any) {
      if (this.keepReading) {
        this.handleDisconnect(`Erro na comunicação serial: ${err.message || "Falha de leitura"}`);
      }
    } finally {
      try {
        this.reader?.releaseLock();
        await readableStreamClosed.catch(() => {});
      } catch {}
    }
  }

  private processIncomingChunk(chunk: string): void {
    const lines = chunk.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        this.handleRawLine(trimmed);
      }
    }
  }

  /**
   * Processa uma linha completa recebida da balança
   */
  public handleRawLine(rawLine: string): void {
    const parsed = this.parser.parseLine(rawLine);

    // Registra frame de debug para diagnóstico
    const debugFrame: SerialDebugFrame = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour12: false }) + "." + String(Date.now() % 1000).padStart(3, "0"),
      rawAscii: rawLine,
      rawHex: this.asciiToHex(rawLine),
      parsedWeight: parsed ? parsed.weight : undefined,
      isStable: parsed ? parsed.isStable : undefined
    };

    this.debugFrames.unshift(debugFrame);
    if (this.debugFrames.length > this.maxDebugFrames) {
      this.debugFrames.pop();
    }

    this.onDebugListeners.forEach(l => l(debugFrame));

    if (parsed) {
      this.onReadingListeners.forEach(l => l(parsed));
    }
  }

  private handleDisconnect(errorReason?: string): void {
    this.keepReading = false;
    this.port = null;
    this.reader = null;
    this.setStatus("disconnected", errorReason || null);
  }

  private setStatus(status: SerialConnectionStatus, error: string | null = null): void {
    this.status = status;
    this.errorMessage = error;
    this.onStatusListeners.forEach(l => l(status, error));
  }

  private asciiToHex(str: string): string {
    return Array.from(str)
      .map(char => char.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase())
      .join(" ");
  }
}

export const defaultWebSerialService = new WebSerialService();
