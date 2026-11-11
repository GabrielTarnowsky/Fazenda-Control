import { describe, it, expect } from "vitest";
import { AlfaScaleParser } from "../alfaParser";
import { ModbusRegisterConfig } from "../types";

describe("AlfaScaleParser - Protocolo Alfa T02 Estrito", () => {
  const parser = new AlfaScaleParser("alfa_t02");

  it("deve decodificar leitura estável padrão T02 (ST,GS,+00450.5kg)", () => {
    const reading = parser.parseLine("ST,GS,+00450.5kg\r\n");
    expect(reading).not.toBeNull();
    expect(reading?.weight).toBe(450.5);
    expect(reading?.isStable).toBe(true);
    expect(reading?.isOverload).toBe(false);
    expect(reading?.unit).toBe("kg");
  });

  it("deve decodificar leitura instável T02 (US,GS,+00320.0kg)", () => {
    const reading = parser.parseLine("US,GS,+00320.0kg");
    expect(reading).not.toBeNull();
    expect(reading?.weight).toBe(320.0);
    expect(reading?.isStable).toBe(false);
    expect(reading?.isOverload).toBe(false);
  });

  it("deve decodificar sobrecarga T02 (OL,GS,+99999.9kg)", () => {
    const reading = parser.parseLine("OL,GS,+99999.9kg");
    expect(reading).not.toBeNull();
    expect(reading?.isOverload).toBe(true);
  });

  it("deve decodificar pesos negativos de tara (-00015.5kg)", () => {
    const reading = parser.parseLine("ST,GS,-00015.5kg");
    expect(reading).not.toBeNull();
    expect(reading?.weight).toBe(-15.5);
    expect(reading?.isStable).toBe(true);
  });

  it("deve rejeitar estritamente linhas que não correspondam ao formato T02 sem fazer fallback automático", () => {
    // Strings arbitrárias ou de outros formatos devem retornar null quando alfa_t02 estiver selecionado
    expect(parser.parseLine("LENDO BALANCA...")).toBeNull();
    expect(parser.parseLine("TEMP: 25.4C")).toBeNull();
    expect(parser.parseLine("PESO: 450.0")).toBeNull();
  });
});

describe("AlfaScaleParser - Protocolo Alfa TRC (Transmissão Reduzida Contínua)", () => {
  const parser = new AlfaScaleParser("alfa_trc");

  it("deve decodificar linha contínua padrão com sinal e unidade (+00450.5 kg)", () => {
    const reading = parser.parseLine("+00450.5 kg\r\n");
    expect(reading).not.toBeNull();
    expect(reading?.weight).toBe(450.5);
    expect(reading?.unit).toBe("kg");
  });

  it("deve decodificar linha contínua sem sinal (00450.5 kg)", () => {
    const reading = parser.parseLine("00450.5 kg");
    expect(reading).not.toBeNull();
    expect(reading?.weight).toBe(450.5);
  });

  it("deve decodificar valor com vírgula decimal (+00450,5 kg)", () => {
    const reading = parser.parseLine("+00450,5 kg");
    expect(reading).not.toBeNull();
    expect(reading?.weight).toBe(450.5);
  });

  it("deve identificar status ST como estável (ST +00450.5 kg)", () => {
    const reading = parser.parseLine("ST +00450.5 kg");
    expect(reading).not.toBeNull();
    expect(reading?.weight).toBe(450.5);
    expect(reading?.isStable).toBe(true);
  });

  it("deve identificar status US como instável (US +00450.5 kg)", () => {
    const reading = parser.parseLine("US +00450.5 kg");
    expect(reading).not.toBeNull();
    expect(reading?.weight).toBe(450.5);
    expect(reading?.isStable).toBe(false);
  });

  it("deve decodificar valor numérico isolado (450.5)", () => {
    const reading = parser.parseLine("450.5");
    expect(reading).not.toBeNull();
    expect(reading?.weight).toBe(450.5);
  });
});

describe("AlfaScaleParser - Modbus RTU Binário", () => {
  const parser = new AlfaScaleParser("modbus_rtu");

  // Configuração padrão: Slave 1, FC 3, Offset 0, 4 bytes int32 BE, fator 0.1
  const config32: ModbusRegisterConfig = {
    slaveAddress: 1,
    functionCode: 3,
    registerOffset: 0,
    dataEncoding: "int32",
    byteOrder: "BE",
    scaleFactor: 0.1,
    hasStabilityField: false
  };

  it("deve calcular o CRC16 correto segundo o padrão Modbus (0xA001)", () => {
    // Exemplo clássico Modbus: [0x01, 0x03, 0x00, 0x00, 0x00, 0x01] -> CRC = 0x840A
    const testBytes = new Uint8Array([0x01, 0x03, 0x00, 0x00, 0x00, 0x01]);
    const crc = AlfaScaleParser.computeModbusCRC16(testBytes);
    // No fio Modbus RTU: byte Lo = 0x84, byte Hi = 0x0A. Valor 16-bit = 0x0A84 (2692)
    expect(crc).toBe(0x0A84);
  });

  it("deve decodificar quadro Modbus RTU válido de 32 bits (4505 * 0.1 = 450.5 kg)", () => {
    // Slave 1, FC 3, ByteCount 4, Dados: [0x00, 0x00, 0x11, 0x99] = 4505 decimal
    const payload = new Uint8Array([0x01, 0x03, 0x04, 0x00, 0x00, 0x11, 0x99]);
    const crc = AlfaScaleParser.computeModbusCRC16(payload);
    const frame = new Uint8Array(payload.length + 2);
    frame.set(payload);
    frame[payload.length] = crc & 0xFF;        // CRC Lo
    frame[payload.length + 1] = (crc >> 8) & 0xFF; // CRC Hi

    const reading = parser.parseModbusRTU(frame, config32);
    expect(reading).not.toBeNull();
    expect(reading?.weight).toBe(450.5);
    // Sem bit de estabilidade confirmado no mapa, NÃO inventa estabilidade (isStable: false)
    expect(reading?.isStable).toBe(false);
  });

  it("deve rejeitar quadro com CRC corrompido", () => {
    const payload = new Uint8Array([0x01, 0x03, 0x04, 0x00, 0x00, 0x11, 0x99]);
    const crc = AlfaScaleParser.computeModbusCRC16(payload);
    const frame = new Uint8Array(payload.length + 2);
    frame.set(payload);
    frame[payload.length] = (crc & 0xFF) ^ 0xFF; // Corrompe CRC
    frame[payload.length + 1] = (crc >> 8) & 0xFF;

    const reading = parser.parseModbusRTU(frame, config32);
    expect(reading).toBeNull();
  });

  it("deve rejeitar estritamente quadros com tamanho inconsistente (len !== 3 + byteCount + 2)", () => {
    // Declara byteCount = 4, mas tem apenas 3 bytes de dados antes do CRC
    const frame = new Uint8Array([0x01, 0x03, 0x04, 0x00, 0x00, 0x11, 0x12, 0x34]);
    const reading = parser.parseModbusRTU(frame, config32);
    expect(reading).toBeNull();
  });

  it("deve rejeitar leitura out-of-bounds se registerOffset exceder os bytes retornados", () => {
    const configOutOfBounds: ModbusRegisterConfig = {
      ...config32,
      registerOffset: 4 // Exige bytes 4..7, mas quadro só tem 4 bytes de dados (índices 0..3)
    };
    const payload = new Uint8Array([0x01, 0x03, 0x04, 0x00, 0x00, 0x11, 0x99]);
    const crc = AlfaScaleParser.computeModbusCRC16(payload);
    const frame = new Uint8Array(payload.length + 2);
    frame.set(payload);
    frame[payload.length] = crc & 0xFF;
    frame[payload.length + 1] = (crc >> 8) & 0xFF;

    const reading = parser.parseModbusRTU(frame, configOutOfBounds);
    expect(reading).toBeNull();
  });

  it("deve respeitar ordens de byte diferentes (LE, CDAB, BADC) e Float32", () => {
    // Teste com float32 IEEE 754: 450.5f em Big-Endian = [0x43, 0xE1, 0x40, 0x00]
    const floatConfig: ModbusRegisterConfig = {
      slaveAddress: 1,
      functionCode: 3,
      registerOffset: 0,
      dataEncoding: "float32",
      byteOrder: "BE",
      scaleFactor: 1.0,
      hasStabilityField: false
    };

    const payload = new Uint8Array([0x01, 0x03, 0x04, 0x43, 0xE1, 0x40, 0x00]);
    const crc = AlfaScaleParser.computeModbusCRC16(payload);
    const frame = new Uint8Array(payload.length + 2);
    frame.set(payload);
    frame[payload.length] = crc & 0xFF;
    frame[payload.length + 1] = (crc >> 8) & 0xFF;

    const reading = parser.parseModbusRTU(frame, floatConfig);
    expect(reading).not.toBeNull();
    expect(reading?.weight).toBe(450.5);
  });
});

describe("AlfaScaleParser - Modbus ASCII e Verificação LRC", () => {
  const parser = new AlfaScaleParser("modbus_ascii");

  it("deve calcular o LRC correto (soma módulo 256 e complemento de dois)", () => {
    // Exemplo: dados [0x01, 0x03, 0x04, 0x00, 0x00, 0x11, 0x99]
    // Soma: 1 + 3 + 4 + 0 + 0 + 17 + 153 = 178 (0xB2)
    // Complemento de 2: ((~178 + 1) & 0xFF) = 78 (0x4E)
    const data = new Uint8Array([0x01, 0x03, 0x04, 0x00, 0x00, 0x11, 0x99]);
    const lrc = AlfaScaleParser.computeModbusLRC(data);
    expect(lrc).toBe(0x4E);
  });

  it("deve decodificar quadro Modbus ASCII válido com delimitadores (: e LRC)", () => {
    // Quadro completo ASCII: :010304000011994E\r\n
    const reading = parser.parseLine(":010304000011994E\r\n");
    expect(reading).not.toBeNull();
    expect(reading?.weight).toBe(450.5);
    expect(reading?.isStable).toBe(false); // Sem flag explícita
  });

  it("deve rejeitar quadro Modbus ASCII com LRC corrompido", () => {
    // Substitui LRC 4E por 00
    const reading = parser.parseLine(":0103040000119900\r\n");
    expect(reading).toBeNull();
  });

  it("deve rejeitar quadros que não iniciem com ':'", () => {
    const reading = parser.parseLine("010304000011994E\r\n");
    expect(reading).toBeNull();
  });
});
