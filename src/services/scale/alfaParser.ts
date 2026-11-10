import { ScaleProtocol, ScaleReading } from "./types";

/**
 * Parser especializado para a balança Alfa Instrumentos 3102C.S
 * e compatível com protocolos contínuos T02, ASCII simples e Modbus.
 */
export class AlfaScaleParser {
  private protocol: ScaleProtocol;

  constructor(protocol: ScaleProtocol = "auto_detect") {
    this.protocol = protocol;
  }

  public setProtocol(protocol: ScaleProtocol): void {
    this.protocol = protocol;
  }

  public getProtocol(): ScaleProtocol {
    return this.protocol;
  }

  /**
   * Converte uma linha de texto bruta recebida da serial em uma leitura estruturada.
   */
  public parseLine(rawLine: string): ScaleReading | null {
    if (!rawLine || typeof rawLine !== "string") return null;

    // Remove caracteres de controle ASCII comuns (STX \x02, ETX \x03, NUL \x00, etc.)
    // eslint-disable-next-line no-control-regex
    const cleanLine = rawLine.replace(/[\x00-\x1F\x7F]/g, " ").trim();
    if (!cleanLine) return null;

    switch (this.protocol) {
      case "alfa_t02":
        return this.parseAlfaT02(cleanLine, rawLine);
      case "alfa_continuous":
        return this.parseAlfaContinuous(cleanLine, rawLine);
      case "modbus_rtu":
        return this.parseModbusOrAscii(cleanLine, rawLine);
      case "generic_ascii":
        return this.parseGenericAscii(cleanLine, rawLine);
      case "auto_detect":
      default:
        return this.parseAutoDetect(cleanLine, rawLine);
    }
  }

  /**
   * Protocolo Alfa T02:
   * Exemplo típico: "ST,GS,+00450.5kg" ou "US,GS,+00450.5kg" ou "OL,GS,+99999.9kg"
   */
  private parseAlfaT02(clean: string, originalRaw: string): ScaleReading | null {
    // Procura padrão: (ST|US|OL),(GS|NT),(+/-?peso)(kg|lb)?
    const t02Regex = /(ST|US|OL)\s*,\s*(GS|NT|GR)?\s*,\s*([+-]?\s*\d+(?:[.,]\d+)?)\s*(kg|g|lb)?/i;
    const match = clean.match(t02Regex);

    if (match) {
      const statusToken = match[1].toUpperCase();
      const rawWeightStr = match[3].replace(/\s+/g, "").replace(",", ".");
      const weightVal = parseFloat(rawWeightStr);
      const isOverload = statusToken === "OL";
      const isStable = statusToken === "ST";
      const unit = (match[4]?.toLowerCase() === "lb" ? "lb" : "kg") as "kg" | "lb";

      if (!isNaN(weightVal)) {
        return {
          raw: originalRaw,
          weight: Math.abs(weightVal) < 0.001 ? 0 : weightVal,
          isStable,
          isOverload,
          unit,
          timestamp: Date.now()
        };
      }
    }

    // Fallback para auto-detect se não bater o regex estrito do T02
    return this.parseAutoDetect(clean, originalRaw);
  }

  /**
   * Protocolo Alfa Contínuo Padrão:
   * Exemplo: "ST  00450.5 kg" ou "US  00450.5 kg"
   */
  private parseAlfaContinuous(clean: string, originalRaw: string): ScaleReading | null {
    const contRegex = /(ST|US|OL)\s+([+-]?\s*\d+(?:[.,]\d+)?)\s*(kg|lb)?/i;
    const match = clean.match(contRegex);

    if (match) {
      const statusToken = match[1].toUpperCase();
      const rawWeightStr = match[2].replace(/\s+/g, "").replace(",", ".");
      const weightVal = parseFloat(rawWeightStr);
      const isOverload = statusToken === "OL";
      const isStable = statusToken === "ST";
      const unit = (match[3]?.toLowerCase() === "lb" ? "lb" : "kg") as "kg" | "lb";

      if (!isNaN(weightVal)) {
        return {
          raw: originalRaw,
          weight: Math.abs(weightVal) < 0.001 ? 0 : weightVal,
          isStable,
          isOverload,
          unit,
          timestamp: Date.now()
        };
      }
    }

    return this.parseAutoDetect(clean, originalRaw);
  }

  /**
   * Parser genérico de texto ASCII
   * Extrai o valor numérico mais relevante e sinais de estabilidade
   */
  private parseGenericAscii(clean: string, originalRaw: string): ScaleReading | null {
    // Identifica indicador de estabilidade por palavras chave
    const hasStable = /\b(ST|EST|ESTAVEL|STABLE|OK)\b/i.test(clean);
    const hasUnstable = /\b(US|INST|INSTAVEL|UNSTABLE|MOV)\b/i.test(clean);
    const hasOverload = /\b(OL|SOBRECARGA|OVERLOAD)\b/i.test(clean);

    // Extrai o número decimal (aceita . ou ,)
    const numMatch = clean.match(/([+-]?\s*\d+(?:[.,]\d+)?)/);
    if (!numMatch) return null;

    const numStr = numMatch[1].replace(/\s+/g, "").replace(",", ".");
    const weightVal = parseFloat(numStr);

    if (isNaN(weightVal)) return null;

    return {
      raw: originalRaw,
      weight: Math.abs(weightVal) < 0.001 ? 0 : weightVal,
      isStable: hasStable && !hasUnstable,
      isOverload: hasOverload,
      unit: "kg",
      timestamp: Date.now()
    };
  }

  /**
   * Parser para Modbus RTU decodificado ou ASCII
   */
  private parseModbusOrAscii(clean: string, originalRaw: string): ScaleReading | null {
    return this.parseGenericAscii(clean, originalRaw);
  }

  /**
   * Auto-detecção inteligente:
   * Tenta T02 -> Contínuo -> Genérico ASCII
   */
  private parseAutoDetect(clean: string, originalRaw: string): ScaleReading | null {
    // 1. Tenta T02
    if (clean.includes(",") && (clean.includes("ST") || clean.includes("US") || clean.includes("GS"))) {
      const t02 = this.parseAlfaT02(clean, originalRaw);
      if (t02) return t02;
    }

    // 2. Tenta Contínuo com prefixo ST/US
    if (/^(ST|US|OL)\b/i.test(clean)) {
      const cont = this.parseAlfaContinuous(clean, originalRaw);
      if (cont) return cont;
    }

    // 3. Tenta extrair número genérico com unidade kg
    const kgMatch = clean.match(/([+-]?\s*\d+(?:[.,]\d+)?)\s*kg/i);
    if (kgMatch) {
      const numStr = kgMatch[1].replace(/\s+/g, "").replace(",", ".");
      const weightVal = parseFloat(numStr);
      if (!isNaN(weightVal)) {
        const isStable = clean.toUpperCase().includes("ST") || !clean.toUpperCase().includes("US");
        return {
          raw: originalRaw,
          weight: Math.abs(weightVal) < 0.001 ? 0 : weightVal,
          isStable,
          isOverload: clean.toUpperCase().includes("OL"),
          unit: "kg",
          timestamp: Date.now()
        };
      }
    }

    // 4. Último fallback genérico
    return this.parseGenericAscii(clean, originalRaw);
  }
}

export const defaultAlfaParser = new AlfaScaleParser("auto_detect");
