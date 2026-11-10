// Tipos e Interfaces para o Módulo de Pesagem Automática e Balança Alfa 3102C.S

export type ScaleProtocol = 
  | "alfa_t02"          // Protocolo T02 Contínuo padrão Alfa Instrumentos (ex: ST,GS,+00450.5kg\r\n)
  | "alfa_continuous"   // Protocolo Contínuo Alfa Simples (ex: ST  00450.5 kg\r\n)
  | "generic_ascii"     // ASCII genérico com auto-detecção de números e decimais
  | "modbus_rtu"        // Protocolo industrial Modbus RTU
  | "auto_detect";      // Auto-detecção inteligente de padrão

export type SerialBaudRate = 1200 | 2400 | 4800 | 9600 | 19200 | 38400 | 57600 | 115200;
export type SerialDataBits = 7 | 8;
export type SerialStopBits = 1 | 2;
export type SerialParity = "none" | "even" | "odd";

export interface SerialConfig {
  baudRate: SerialBaudRate;
  dataBits: SerialDataBits;
  stopBits: SerialStopBits;
  parity: SerialParity;
  protocol: ScaleProtocol;
}

export interface StabilityConfig {
  minStabilityTimeMs: number;     // Tempo mínimo de estabilidade em milissegundos (padrão: 1500ms)
  toleranceKg: number;            // Tolerância máxima de oscilação em kg (padrão: 1.0 kg)
  minWeightKg: number;            // Peso mínimo para considerar animal na plataforma (padrão: 40 kg)
  zeroReturnThresholdKg: number;  // Limite de peso para considerar retorno a zero (padrão: 15 kg)
  soundEnabled: boolean;          // Emitir bipe sonoro de pesagem concluída
  autoAdvanceAnimal: boolean;     // Avançar para próximo animal da fila automaticamente após saída
}

export interface ScaleReading {
  raw: string;
  weight: number;
  isStable: boolean;
  isOverload: boolean;
  unit: "kg" | "lb" | "t";
  timestamp: number;
}

export type WeighingState = 
  | "DISCONNECTED"          // Balança desconectada
  | "IDLE_EMPTY"            // Plataforma vazia (< minWeightKg, peso em zero)
  | "WEIGHING_UNSTABLE"     // Animal sobre a plataforma, peso oscilando
  | "WEIGHING_STABILIZING"  // Peso dentro da tolerância, cronometrando tempo mínimo
  | "WEIGHT_CAPTURED"       // Peso estabilizado, capturado e congelado no visor
  | "WAITING_ZERO_RELEASE"; // Aguardando o animal descer da plataforma (< zeroReturnThresholdKg)

export interface WeighingRecord {
  id: string;
  sessionId?: string;
  animalId: string;
  tag: string;
  animalName?: string;
  loteNome?: string;
  categoria?: string;
  raca?: string;
  currentWeight: number;
  previousWeight?: number;
  previousDate?: string;
  weightGainKg?: number;
  daysBetween?: number;
  gmdGramsPerDay?: number;
  date: string;       // Formato ISO ou YYYY-MM-DD
  time: string;       // Formato HH:mm:ss
  origin: "automatica" | "manual";
  scaleModel: string;
  notes?: string;
  user_id?: string;
}

export interface WeighingSession {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime?: string;
  loteId?: string;
  loteNome?: string;
  operatorName?: string;
  scaleModel: string;
  totalWeighed: number;
  averageWeight: number;
  averageGmd: number;
  records: WeighingRecord[];
}

export const DEFAULT_STABILITY_CONFIG: StabilityConfig = {
  minStabilityTimeMs: 1500,
  toleranceKg: 1.0,
  minWeightKg: 40.0,
  zeroReturnThresholdKg: 15.0,
  soundEnabled: true,
  autoAdvanceAnimal: true
};

export const DEFAULT_SERIAL_CONFIG: SerialConfig = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  protocol: "alfa_t02"
};
