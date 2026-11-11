import { ScaleProtocol, ScaleReading, ModbusRegisterConfig, DEFAULT_MODBUS_CONFIG, ModbusDataEncoding, ModbusByteOrder } from "./types";

/**
 * Parser especializado para a balança Alfa Instrumentos 3102C.S
 * e compatível com protocolos contínuos TRC, T02, ASCII e Modbus RTU/ASCII.
 */
export class AlfaScaleParser {
  private protocol: ScaleProtocol;
  private modbusConfig: ModbusRegisterConfig;

  constructor(protocol: ScaleProtocol = "alfa_trc", modbusConfig: ModbusRegisterConfig = { ...DEFAULT_MODBUS_CONFIG }) {
    this.protocol = protocol;
    this.modbusConfig = { ...modbusConfig };
  }

  public setProtocol(protocol: ScaleProtocol): void {
    this.protocol = protocol;
  }

  public getProtocol(): ScaleProtocol {
    return this.protocol;
  }

  public setModbusConfig(config: Partial<ModbusRegisterConfig>): void {
    this.modbusConfig = { ...this.modbusConfig, ...config };
  }

  public getModbusConfig(): ModbusRegisterConfig {
    return { ...this.modbusConfig };
  }

  /**
   * Converte uma linha de texto bruta recebida da serial em uma leitura estruturada.
   * Quando um protocolo específico (ex: T02, TRC, Modbus) estiver selecionado,
   * respeita rigorosamente o protocolo SEM fazer fallback automático não solicitado.
   */
  public parseLine(rawLine: string): ScaleReading | null {
    if (!rawLine || typeof rawLine !== "string") return null;

    // Remove caracteres de controle ASCII comuns (\x00, STX \x02, ETX \x03, etc.) exceto quebras
    // eslint-disable-next-line no-control-regex
    const cleanLine = rawLine.replace(/[\x00-\x1F\x7F]/g, " ").trim();
    if (!cleanLine) return null;

    switch (this.protocol) {
      case "alfa_t02":
        // Estrito T02: se não bater, retorna null (sem fallback automático)
        return this.parseAlfaT02(cleanLine, rawLine);

      case "alfa_trc":
        // Estrito TRC (Transmissão Reduzida Contínua / Contínua Alfa)
        return this.parseAlfaTRC(cleanLine, rawLine);

      case "alfa_continuous":
        return this.parseAlfaContinuous(cleanLine, rawLine);

      case "modbus_ascii":
        return this.parseModbusASCII(rawLine, this.modbusConfig);

      case "modbus_rtu":
        // Tenta interpretar linha formatada em hex ou delega para parser binário
        return this.parseModbusHexLine(cleanLine, rawLine);

      case "generic_ascii":
        return this.parseGenericAscii(cleanLine, rawLine);

      case "auto_detect":
      default:
        return this.parseAutoDetect(cleanLine, rawLine);
    }
  }

  /**
   * Protocolo Alfa T02 Estrito:
   * Formato padrão Alfa Instrumentos:
   * "ST,GS,+00450.5kg" ou "US,GS,+00450.5kg" ou "OL,GS,+99999.9kg"
   * Campos: Status (ST=estável, US=instável, OL=sobrecarga), Modo (GS=bruto, NT=líquido), Peso, Unidade.
   * Não faz fallback para auto-detecção se a linha for inválida.
   */
  public parseAlfaT02(clean: string, originalRaw: string): ScaleReading | null {
    const t02Regex = /^(ST|US|OL)\s*,\s*(GS|NT|GR)?\s*,\s*([+-]?\s*\d+(?:[.,]\d+)?)\s*(kg|g|lb|t)?$/i;
    const match = clean.match(t02Regex);

    if (!match) {
      return null;
    }

    const statusToken = match[1].toUpperCase();
    const rawWeightStr = match[3].replace(/\s+/g, "").replace(",", ".");
    const weightVal = parseFloat(rawWeightStr);

    if (isNaN(weightVal)) {
      return null;
    }

    const isOverload = statusToken === "OL";
    const isStable = statusToken === "ST";
    let unit: "kg" | "lb" | "t" = "kg";
    const unitMatch = match[4]?.toLowerCase();
    if (unitMatch === "lb") unit = "lb";
    else if (unitMatch === "t") unit = "t";

    return {
      raw: originalRaw,
      weight: Math.abs(weightVal) < 0.0001 ? 0 : Math.round(weightVal * 100) / 100,
      isStable,
      isOverload,
      unit,
      timestamp: Date.now()
    };
  }

  /**
   * Protocolo Alfa TRC (Transmissão Reduzida Contínua / Transmissão Contínua da Alfa 3102C.S):
   * O indicador envia continuamente linhas como:
   * "+00450.5 kg\r\n"
   * "-00012.0 kg\r\n"
   * " 00450.5 kg\r\n"
   * "00450.5\r\n"
   * "ST +00450.5 kg\r\n"
   * "US +00450.5 kg\r\n"
   * "ST,+00450.5,kg\r\n"
   */
  public parseAlfaTRC(clean: string, originalRaw: string): ScaleReading | null {
    // Regex flexível para o formato contínuo do indicador TRC
    // Identifica opcional status (ST, US, OL), opcional sinal (+/-), número decimal e unidade opcional
    const trcRegex = /^(?:(ST|US|OL)\s*,?\s*)?([+-]?\s*\d+(?:[.,]\d+)?)\s*,?\s*(kg|g|lb|t)?$/i;
    const match = clean.match(trcRegex);

    if (!match) {
      // Se tiver prefixo de modo como GS ou NT (ex: "GS +00450.5 kg")
      const altRegex = /^(?:(GS|NT)\s+)?([+-]?\s*\d+(?:[.,]\d+)?)\s*(kg|g|lb|t)?$/i;
      const altMatch = clean.match(altRegex);
      if (!altMatch) return null;

      const rawWeightStr = altMatch[2].replace(/\s+/g, "").replace(",", ".");
      const weightVal = parseFloat(rawWeightStr);
      if (isNaN(weightVal)) return null;

      return {
        raw: originalRaw,
        weight: Math.abs(weightVal) < 0.0001 ? 0 : Math.round(weightVal * 100) / 100,
        isStable: false, // Sem flag explícita de estabilidade
        isOverload: false,
        unit: (altMatch[3]?.toLowerCase() === "lb" ? "lb" : "kg") as "kg" | "lb" | "t",
        timestamp: Date.now()
      };
    }

    const statusToken = match[1] ? match[1].toUpperCase() : null;
    const rawWeightStr = match[2].replace(/\s+/g, "").replace(",", ".");
    const weightVal = parseFloat(rawWeightStr);

    if (isNaN(weightVal)) {
      return null;
    }

    const isOverload = statusToken === "OL";
    // Se o protocolo fornecer ST explícito, é estável.
    // Se fornecer US, é instável.
    // Se não fornecer token (comum em TRC contínuo puro), representamos como não confirmado (isStable: false),
    // permitindo que o detector de estabilidade temporal avalie com segurança.
    const isStable = statusToken === "ST";

    let unit: "kg" | "lb" | "t" = "kg";
    const unitMatch = match[3]?.toLowerCase();
    if (unitMatch === "lb") unit = "lb";
    else if (unitMatch === "t") unit = "t";

    return {
      raw: originalRaw,
      weight: Math.abs(weightVal) < 0.0001 ? 0 : Math.round(weightVal * 100) / 100,
      isStable,
      isOverload,
      unit,
      timestamp: Date.now()
    };
  }

  /**
   * Protocolo Alfa Contínuo Simples:
   * Exemplo: "ST  00450.5 kg" ou "US  00450.5 kg"
   */
  public parseAlfaContinuous(clean: string, originalRaw: string): ScaleReading | null {
    const contRegex = /^(ST|US|OL)\s+([+-]?\s*\d+(?:[.,]\d+)?)\s*(kg|lb|t)?$/i;
    const match = clean.match(contRegex);

    if (!match) return null;

    const statusToken = match[1].toUpperCase();
    const rawWeightStr = match[2].replace(/\s+/g, "").replace(",", ".");
    const weightVal = parseFloat(rawWeightStr);

    if (isNaN(weightVal)) return null;

    return {
      raw: originalRaw,
      weight: Math.abs(weightVal) < 0.0001 ? 0 : Math.round(weightVal * 100) / 100,
      isStable: statusToken === "ST",
      isOverload: statusToken === "OL",
      unit: (match[3]?.toLowerCase() === "lb" ? "lb" : "kg") as "kg" | "lb" | "t",
      timestamp: Date.now()
    };
  }

  /**
   * Cálculo de redundância cíclica Modbus CRC-16 padrão industrial (Polinômio standard 0xA001)
   */
  public static computeModbusCRC16(data: Uint8Array, length: number = data.length): number {
    let crc = 0xFFFF;
    const len = Math.min(length, data.length);
    for (let pos = 0; pos < len; pos++) {
      crc ^= data[pos];
      for (let i = 8; i !== 0; i--) {
        if ((crc & 0x0001) !== 0) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc = crc >> 1;
        }
      }
    }
    return crc;
  }

  /**
   * Cálculo de redundância longitudinal Modbus ASCII LRC
   * Soma de todos os bytes (módulo 256) e complemento de dois: ((~sum + 1) & 0xFF)
   */
  public static computeModbusLRC(data: Uint8Array, length: number = data.length): number {
    let sum = 0;
    const len = Math.min(length, data.length);
    for (let i = 0; i < len; i++) {
      sum = (sum + data[i]) & 0xFF;
    }
    return ((~sum + 1) & 0xFF);
  }

  /**
   * Decodifica valores numéricos a partir de bytes respeitando encoding e byte order
   */
  public static decodeNumericBytes(
    bytes: Uint8Array,
    offset: number,
    encoding: ModbusDataEncoding,
    byteOrder: ModbusByteOrder
  ): number | null {
    const neededBytes = (encoding === "int16" || encoding === "uint16") ? 2 : 4;
    if (offset < 0 || offset + neededBytes > bytes.length) {
      // Out of bounds: não lê registradores fora do quadro recebido
      return null;
    }

    if (neededBytes === 2) {
      const b0 = bytes[offset];
      const b1 = bytes[offset + 1];
      const val = byteOrder === "LE" ? (b1 << 8) | b0 : (b0 << 8) | b1;
      if (encoding === "int16") {
        return (val & 0x8000) ? val - 0x10000 : val;
      }
      return val;
    }

    // 4 bytes (int32, uint32, float32)
    const raw = [
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    ];

    let ordered: number[];
    switch (byteOrder) {
      case "LE":
        // Little-Endian (DCBA)
        ordered = [raw[3], raw[2], raw[1], raw[0]];
        break;
      case "CDAB":
        // Mid-Big / Word swap (CDAB)
        ordered = [raw[2], raw[3], raw[0], raw[1]];
        break;
      case "BADC":
        // Byte swap (BADC)
        ordered = [raw[1], raw[0], raw[3], raw[2]];
        break;
      case "BE":
      default:
        // Big-Endian standard (ABCD)
        ordered = [raw[0], raw[1], raw[2], raw[3]];
        break;
    }

    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    for (let i = 0; i < 4; i++) {
      view.setUint8(i, ordered[i]);
    }

    if (encoding === "float32") {
      const floatVal = view.getFloat32(0, false);
      return isNaN(floatVal) ? null : floatVal;
    } else if (encoding === "uint32") {
      return view.getUint32(0, false);
    } else {
      return view.getInt32(0, false);
    }
  }

  /**
   * Parser estrito para pacotes binários Modbus RTU (Funções 0x03 ou 0x04)
   * Estrutura de resposta esperada: [SlaveID, Function, ByteCount, Data..., CRC_Lo, CRC_Hi]
   * Valida:
   * 1. Tamanho real do quadro: len === 3 + byteCount + 2
   * 2. CRC-16
   * 3. Bounds do registrador configurado (offset + tamanho <= byteCount)
   * 4. Estabilidade: NÃO inventa estabilidade; isStable é false salvo confirmação de bit
   */
  public parseModbusRTU(bytes: Uint8Array, config: ModbusRegisterConfig = this.modbusConfig): ScaleReading | null {
    if (!bytes || bytes.length < 5) return null;

    const len = bytes.length;
    const functionCode = bytes[1];
    if (functionCode !== 0x03 && functionCode !== 0x04) {
      return null;
    }

    const byteCount = bytes[2];
    const expectedFrameLength = 3 + byteCount + 2;

    // 1. Validação estrita do tamanho do quadro
    if (len !== expectedFrameLength) {
      return null;
    }

    // 2. Validação estrita do CRC16
    const receivedCRC = bytes[len - 2] | (bytes[len - 1] << 8);
    const computedCRC = AlfaScaleParser.computeModbusCRC16(bytes, len - 2);
    if (receivedCRC !== computedCRC) {
      return null;
    }

    // 3. Extração e validação de limites do registrador
    const dataPayload = bytes.subarray(3, 3 + byteCount);
    const rawVal = AlfaScaleParser.decodeNumericBytes(
      dataPayload,
      config.registerOffset,
      config.dataEncoding,
      config.byteOrder
    );

    if (rawVal === null) {
      // Offset fora dos bytes retornados
      return null;
    }

    const weight = rawVal * (config.scaleFactor || 1.0);

    // 4. Verificação de estabilidade: não marca leitura Modbus como estável arbitrariamente
    let isStable = false;
    if (config.hasStabilityField && typeof config.stabilityByteOffset === "number" && config.stabilityBitMask) {
      if (config.stabilityByteOffset < dataPayload.length) {
        isStable = (dataPayload[config.stabilityByteOffset] & config.stabilityBitMask) !== 0;
      }
    }

    const hexStr = Array.from(bytes).map(b => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");

    return {
      raw: `MODBUS_RTU:[${hexStr}]`,
      weight: Math.round(weight * 100) / 100,
      isStable,
      isOverload: false,
      unit: "kg",
      timestamp: Date.now()
    };
  }

  /**
   * Parser estrito para Modbus ASCII:
   * Delimitador inicial ':', delimitadores finais CRLF, representação hexadecimal.
   * Valida LRC e tamanho de registradores.
   */
  public parseModbusASCII(rawLine: string, config: ModbusRegisterConfig = this.modbusConfig): ScaleReading | null {
    if (!rawLine || typeof rawLine !== "string") return null;

    const trimmed = rawLine.trim();
    if (!trimmed.startsWith(":")) {
      return null;
    }

    const hexStr = trimmed.substring(1).replace(/[^0-9A-Fa-f]/g, "");
    if (hexStr.length < 10 || hexStr.length % 2 !== 0) {
      return null;
    }

    const byteLen = hexStr.length / 2;
    const bytes = new Uint8Array(byteLen);
    for (let i = 0; i < byteLen; i++) {
      bytes[i] = parseInt(hexStr.substring(i * 2, i * 2 + 2), 16);
    }

    // Validação estrita do LRC (último byte)
    const receivedLRC = bytes[byteLen - 1];
    const computedLRC = AlfaScaleParser.computeModbusLRC(bytes, byteLen - 1);
    if (receivedLRC !== computedLRC) {
      return null;
    }

    const functionCode = bytes[1];
    if (functionCode !== 0x03 && functionCode !== 0x04) {
      return null;
    }

    const byteCount = bytes[2];
    const expectedByteLen = 3 + byteCount + 1; // Slave + FC + ByteCount + N Data + LRC
    if (byteLen !== expectedByteLen) {
      return null;
    }

    const dataPayload = bytes.subarray(3, 3 + byteCount);
    const rawVal = AlfaScaleParser.decodeNumericBytes(
      dataPayload,
      config.registerOffset,
      config.dataEncoding,
      config.byteOrder
    );

    if (rawVal === null) {
      return null;
    }

    const weight = rawVal * (config.scaleFactor || 1.0);

    let isStable = false;
    if (config.hasStabilityField && typeof config.stabilityByteOffset === "number" && config.stabilityBitMask) {
      if (config.stabilityByteOffset < dataPayload.length) {
        isStable = (dataPayload[config.stabilityByteOffset] & config.stabilityBitMask) !== 0;
      }
    }

    return {
      raw: rawLine,
      weight: Math.round(weight * 100) / 100,
      isStable,
      isOverload: false,
      unit: "kg",
      timestamp: Date.now()
    };
  }

  /**
   * Parser para linha Modbus RTU formatada em string hexadecimal (ex: "01 03 04 01 C4 00 00 E8 5D")
   */
  private parseModbusHexLine(clean: string, originalRaw: string): ScaleReading | null {
    const hexTokens = clean.split(/\s+/).filter(t => /^[0-9A-Fa-f]{2}$/.test(t));
    if (hexTokens.length >= 5) {
      const bytes = new Uint8Array(hexTokens.map(h => parseInt(h, 16)));
      const reading = this.parseModbusRTU(bytes, this.modbusConfig);
      if (reading) {
        reading.raw = originalRaw;
        return reading;
      }
    }
    return null;
  }

  /**
   * Parser genérico de texto ASCII
   * Extrai o valor numérico mais relevante e sinais de estabilidade
   */
  public parseGenericAscii(clean: string, originalRaw: string): ScaleReading | null {
    const hasStable = /\b(ST|EST|ESTAVEL|STABLE|OK)\b/i.test(clean);
    const hasUnstable = /\b(US|INST|INSTAVEL|UNSTABLE|MOV)\b/i.test(clean);
    const hasOverload = /\b(OL|SOBRECARGA|OVERLOAD)\b/i.test(clean);

    const numMatch = clean.match(/([+-]?\s*\d+(?:[.,]\d+)?)/);
    if (!numMatch) return null;

    const numStr = numMatch[1].replace(/\s+/g, "").replace(",", ".");
    const weightVal = parseFloat(numStr);

    if (isNaN(weightVal)) return null;

    return {
      raw: originalRaw,
      weight: Math.abs(weightVal) < 0.0001 ? 0 : Math.round(weightVal * 100) / 100,
      isStable: hasStable && !hasUnstable,
      isOverload: hasOverload,
      unit: "kg",
      timestamp: Date.now()
    };
  }

  /**
   * Auto-detecção inteligente:
   * Usada APENAS quando o protocolo configurado for "auto_detect".
   * Tenta T02 -> TRC -> Contínuo -> Modbus ASCII -> Genérico ASCII
   */
  public parseAutoDetect(clean: string, originalRaw: string): ScaleReading | null {
    // 1. Tenta T02
    if (clean.includes(",") && (clean.includes("ST") || clean.includes("US") || clean.includes("GS") || clean.includes("NT"))) {
      const t02 = this.parseAlfaT02(clean, originalRaw);
      if (t02) return t02;
    }

    // 2. Tenta Modbus ASCII se iniciar com ':'
    if (clean.startsWith(":")) {
      const mbAscii = this.parseModbusASCII(originalRaw, this.modbusConfig);
      if (mbAscii) return mbAscii;
    }

    // 3. Tenta TRC
    const trc = this.parseAlfaTRC(clean, originalRaw);
    if (trc) return trc;

    // 4. Tenta Contínuo com prefixo ST/US
    if (/^(ST|US|OL)\b/i.test(clean)) {
      const cont = this.parseAlfaContinuous(clean, originalRaw);
      if (cont) return cont;
    }

    // 5. Último fallback genérico
    return this.parseGenericAscii(clean, originalRaw);
  }
}

export const defaultAlfaParser = new AlfaScaleParser("alfa_trc");
