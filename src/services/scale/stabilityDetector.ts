import { ScaleReading, StabilityConfig, WeighingState } from "./types";

export interface StabilityStatus {
  state: WeighingState;
  currentWeight: number;
  frozenWeight: number | null;
  isStable: boolean;
  stabilityProgressPct: number; // 0 a 100%
  stabilityElapsedMs: number;
  oscillationKg: number;
  message: string;
}

export class StabilityDetector {
  private config: StabilityConfig;
  private state: WeighingState = "IDLE_EMPTY";
  
  // Janela deslizante de leituras recentes (armazenando timestamp e peso)
  private readingsWindow: { weight: number; timestamp: number }[] = [];
  
  // Controle de estabilização
  private stableStartTime: number | null = null;
  private frozenWeight: number | null = null;
  private hasCapturedCurrentVisit = false;
  
  // Callbacks
  private onCapturedCallback?: (weight: number, reading: ScaleReading) => void;
  private onStateChangeCallback?: (status: StabilityStatus) => void;
  private onZeroReturnCallback?: () => void;

  constructor(config: StabilityConfig) {
    this.config = { ...config };
  }

  public updateConfig(newConfig: Partial<StabilityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): StabilityConfig {
    return { ...this.config };
  }

  public onCaptured(cb: (weight: number, reading: ScaleReading) => void): void {
    this.onCapturedCallback = cb;
  }

  public onStateChange(cb: (status: StabilityStatus) => void): void {
    this.onStateChangeCallback = cb;
  }

  public onZeroReturn(cb: () => void): void {
    this.onZeroReturnCallback = cb;
  }

  public reset(): void {
    this.state = "IDLE_EMPTY";
    this.readingsWindow = [];
    this.stableStartTime = null;
    this.frozenWeight = null;
    this.hasCapturedCurrentVisit = false;
    this.notifyState(0, 0, 0);
  }

  public forceManualCapture(currentWeight: number): void {
    if (currentWeight < this.config.minWeightKg) {
      throw new Error(`Peso atual (${currentWeight} kg) é inferior ao peso mínimo configurado (${this.config.minWeightKg} kg)`);
    }
    this.frozenWeight = currentWeight;
    this.hasCapturedCurrentVisit = true;
    this.state = "WEIGHT_CAPTURED";
    
    const syntheticReading: ScaleReading = {
      raw: `MANUAL_CAPTURE:${currentWeight}kg`,
      weight: currentWeight,
      isStable: true,
      isOverload: false,
      unit: "kg",
      timestamp: Date.now()
    };

    if (this.onCapturedCallback) {
      this.onCapturedCallback(currentWeight, syntheticReading);
    }

    this.notifyState(currentWeight, 100, 0);
  }

  /**
   * Processa uma nova leitura instantânea da balança
   */
  public pushReading(reading: ScaleReading): StabilityStatus {
    const now = reading.timestamp || Date.now();
    const weight = reading.weight;

    // Atualiza a janela deslizante (mantém leituras dentro do tempo de estabilidade * 1.5)
    const windowRetentionTime = Math.max(3000, this.config.minStabilityTimeMs * 1.5);
    this.readingsWindow.push({ weight, timestamp: now });
    this.readingsWindow = this.readingsWindow.filter(r => (now - r.timestamp) <= windowRetentionTime);

    // 1. VERIFICAÇÃO DE RETORNO A ZERO (Animal desceu da plataforma)
    if (weight <= this.config.zeroReturnThresholdKg) {
      const wasHolding = this.hasCapturedCurrentVisit || this.state === "WAITING_ZERO_RELEASE" || this.state === "WEIGHT_CAPTURED";
      
      this.state = "IDLE_EMPTY";
      this.hasCapturedCurrentVisit = false;
      this.stableStartTime = null;
      this.frozenWeight = null;

      if (wasHolding && this.onZeroReturnCallback) {
        this.onZeroReturnCallback();
      }

      return this.notifyState(weight, 0, 0);
    }

    // 2. SE JÁ CAPTUROU O ANIMAL ATUAL: Manter congelado até que ele desça (< zeroReturnThresholdKg)
    if (this.hasCapturedCurrentVisit) {
      this.state = "WAITING_ZERO_RELEASE";
      return this.notifyState(weight, 100, 0);
    }

    // 3. ANIMAL NA PLATAFORMA (Peso >= minWeightKg)
    if (weight < this.config.minWeightKg) {
      // Peso acima do retorno a zero, mas ainda abaixo do peso de animal (ex: 25 kg - tara ou sujeira na balança)
      this.state = "IDLE_EMPTY";
      this.stableStartTime = null;
      return this.notifyState(weight, 0, 0);
    }

    // Filtra leituras dentro do período de estabilidade configurado (ex: últimos 1.5s)
    const stabilityWindow = this.readingsWindow.filter(r => (now - r.timestamp) <= this.config.minStabilityTimeMs);

    if (stabilityWindow.length < 2) {
      this.state = "WEIGHING_UNSTABLE";
      this.stableStartTime = now;
      return this.notifyState(weight, 10, 0);
    }

    const weights = stabilityWindow.map(r => r.weight);
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const oscillation = maxW - minW;

    // Critério de Estabilidade:
    // A oscilação máxima na janela deve ser <= toleranceKg E a balança não reportar sobrecarga
    const isWithinTolerance = oscillation <= this.config.toleranceKg && !reading.isOverload;

    if (isWithinTolerance) {
      if (this.stableStartTime === null) {
        this.stableStartTime = now;
      }

      const elapsedMs = now - this.stableStartTime;
      const progress = Math.min(100, Math.round((elapsedMs / this.config.minStabilityTimeMs) * 100));

      // Se manteve estável pelo tempo mínimo exigido: CAPTURA AUTOMÁTICA!
      if (elapsedMs >= this.config.minStabilityTimeMs) {
        // Média aparada das leituras estáveis para máxima precisão zootécnica
        const sum = weights.reduce((acc, val) => acc + val, 0);
        const averageStableWeight = Math.round((sum / weights.length) * 10) / 10;

        this.state = "WEIGHT_CAPTURED";
        this.frozenWeight = averageStableWeight;
        this.hasCapturedCurrentVisit = true;

        if (this.onCapturedCallback) {
          this.onCapturedCallback(averageStableWeight, reading);
        }

        return this.notifyState(weight, 100, oscillation);
      } else {
        this.state = "WEIGHING_STABILIZING";
        return this.notifyState(weight, progress, oscillation);
      }
    } else {
      // Oscilou além da tolerância: reinicia o cronômetro de estabilidade
      this.stableStartTime = null;
      this.state = "WEIGHING_UNSTABLE";
      return this.notifyState(weight, 0, oscillation);
    }
  }

  private notifyState(weight: number, progressPct: number, oscillation: number): StabilityStatus {
    const elapsed = this.stableStartTime ? Math.max(0, Date.now() - this.stableStartTime) : 0;
    
    let message = "Aguardando entrada do animal na plataforma";
    if (this.state === "WEIGHING_UNSTABLE") {
      message = "Animal em movimentação (leitura oscilando...)";
    } else if (this.state === "WEIGHING_STABILIZING") {
      message = `Estabilizando leitura... (${progressPct}%)`;
    } else if (this.state === "WEIGHT_CAPTURED") {
      message = "Peso capturado com sucesso! Valor congelado.";
    } else if (this.state === "WAITING_ZERO_RELEASE") {
      message = "Animal pesado. Aguardando saída para liberar próximo animal.";
    }

    const status: StabilityStatus = {
      state: this.state,
      currentWeight: weight,
      frozenWeight: this.frozenWeight,
      isStable: this.state === "WEIGHT_CAPTURED" || this.state === "WAITING_ZERO_RELEASE" || this.state === "WEIGHING_STABILIZING",
      stabilityProgressPct: progressPct,
      stabilityElapsedMs: elapsed,
      oscillationKg: Math.round(oscillation * 10) / 10,
      message
    };

    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(status);
    }

    return status;
  }
}
