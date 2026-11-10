import { ScaleReading } from "./types";

export interface SimulatorStatus {
  isActive: boolean;
  currentSimulatedWeight: number;
  stage: "empty" | "entering" | "oscillating" | "stabilized" | "exiting";
  isAutoCycleRunning: boolean;
}

export class ScaleSimulator {
  private isActive = false;
  private intervalId: any = null;
  private targetWeight = 0;
  private currentWeight = 0;
  private stage: "empty" | "entering" | "oscillating" | "stabilized" | "exiting" = "empty";
  private isAutoCycleRunning = false;
  private autoCycleTimeoutId: any = null;

  private onReadingCallback?: (reading: ScaleReading) => void;
  private onStatusCallback?: (status: SimulatorStatus) => void;

  constructor() {}

  public setOnReading(cb: (reading: ScaleReading) => void): void {
    this.onReadingCallback = cb;
  }

  public setOnStatus(cb: (status: SimulatorStatus) => void): void {
    this.onStatusCallback = cb;
  }

  public start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.currentWeight = 0;
    this.targetWeight = 0;
    this.stage = "empty";

    // Frequência de transmissão típica de balanças rodoviárias/pecuárias (10 Hz = 100ms)
    this.intervalId = setInterval(() => this.tick(), 100);
    this.notifyStatus();
  }

  public stop(): void {
    this.isActive = false;
    this.isAutoCycleRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.autoCycleTimeoutId) {
      clearTimeout(this.autoCycleTimeoutId);
      this.autoCycleTimeoutId = null;
    }
    this.currentWeight = 0;
    this.targetWeight = 0;
    this.stage = "empty";
    this.notifyStatus();
  }

  public isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Simula o ciclo completo automático de pesagem de um boi no brete:
   * 1. Boi sobe na plataforma (peso sobre rápido para o peso alvo)
   * 2. Boi se mexe (oscilação real por ~1.8s)
   * 3. Boi para quieto (estabiliza dentro de ±0.3kg)
   * 4. A captura é acionada e congela
   * 5. Opcional: abre a porteira e o boi desce após alguns segundos
   */
  public simulateAnimalCycle(customWeight?: number, autoExitAfterMs = 4000): void {
    if (!this.isActive) {
      this.start();
    }

    // Se já estiver rodando, cancela timer anterior
    if (this.autoCycleTimeoutId) {
      clearTimeout(this.autoCycleTimeoutId);
    }

    this.isAutoCycleRunning = true;
    // Peso típico de gado de corte (ex: entre 380 kg e 560 kg com 1 casa decimal)
    const baseWeight = customWeight && customWeight > 0 
      ? customWeight 
      : Math.round((390 + Math.random() * 160) * 10) / 10;

    this.targetWeight = baseWeight;
    this.stage = "entering";
    this.notifyStatus();

    // Fase 1: Rampa de subida rápida (400ms)
    setTimeout(() => {
      if (!this.isActive) return;
      this.stage = "oscillating";
      this.notifyStatus();

      // Fase 2: Oscilação de movimentação do gado (1800ms)
      setTimeout(() => {
        if (!this.isActive) return;
        this.stage = "stabilized";
        this.notifyStatus();

        // Fase 3: Saída do animal após a pesagem ter sido congelada
        if (autoExitAfterMs > 0) {
          this.autoCycleTimeoutId = setTimeout(() => {
            if (!this.isActive) return;
            this.simulateAnimalExit();
          }, autoExitAfterMs);
        }
      }, 1800);
    }, 450);
  }

  /**
   * Simula a abertura da porteira dianteira e a saída do animal (retorno a zero)
   */
  public simulateAnimalExit(): void {
    if (!this.isActive) return;
    this.stage = "exiting";
    this.targetWeight = 0;
    this.notifyStatus();

    setTimeout(() => {
      if (!this.isActive) return;
      this.currentWeight = 0;
      this.stage = "empty";
      this.isAutoCycleRunning = false;
      this.notifyStatus();
    }, 500);
  }

  /**
   * Ajusta peso instantâneo manualmente (para sliders e testes interativos)
   */
  public setInstantWeight(weight: number, isStable = false): void {
    this.targetWeight = Math.max(0, weight);
    this.currentWeight = this.targetWeight;
    this.stage = weight <= 10 ? "empty" : (isStable ? "stabilized" : "oscillating");
    this.notifyStatus();
  }

  private tick(): void {
    if (!this.isActive) return;

    let emittedWeight = this.currentWeight;
    let isStable = false;

    switch (this.stage) {
      case "empty":
        // Pequena variação de célula de carga em vazio (ex: ±0.1 kg)
        emittedWeight = Math.max(0, Math.round((Math.random() * 0.2 - 0.1) * 10) / 10);
        this.currentWeight = emittedWeight;
        isStable = true;
        break;

      case "entering":
        // Rampa de subida rápida até próximo do peso alvo
        this.currentWeight += (this.targetWeight - this.currentWeight) * 0.45;
        emittedWeight = Math.round(this.currentWeight * 10) / 10;
        isStable = false;
        break;

      case "oscillating": {
        // Movimentação do animal no brete: oscilação senoidal + ruído aleatório (±3.0 kg)
        const noise = (Math.sin(Date.now() / 140) * 3.5) + ((Math.random() - 0.5) * 2.0);
        emittedWeight = Math.round((this.targetWeight + noise) * 10) / 10;
        this.currentWeight = emittedWeight;
        isStable = false;
        break;
      }

      case "stabilized": {
        // Animal estabilizado: variação mínima imperceptível dentro de ±0.2 kg
        const microNoise = (Math.random() - 0.5) * 0.3;
        emittedWeight = Math.round((this.targetWeight + microNoise) * 10) / 10;
        this.currentWeight = emittedWeight;
        isStable = true;
        break;
      }

      case "exiting":
        // Rampa de descida rápida para zero
        this.currentWeight *= 0.35;
        if (this.currentWeight < 1.0) this.currentWeight = 0;
        emittedWeight = Math.round(this.currentWeight * 10) / 10;
        isStable = false;
        break;
    }

    // Formata linha bruta simulando o protocolo padrão Alfa T02:
    // Ex: "ST,GS,+00450.5kg\r\n" ou "US,GS,+00452.1kg\r\n"
    const statusToken = isStable ? "ST" : "US";
    const sign = emittedWeight >= 0 ? "+" : "-";
    const weightPadded = Math.abs(emittedWeight).toFixed(1).padStart(7, "0");
    const rawFrame = `${statusToken},GS,${sign}${weightPadded}kg\r\n`;

    const reading: ScaleReading = {
      raw: rawFrame,
      weight: emittedWeight,
      isStable,
      isOverload: false,
      unit: "kg",
      timestamp: Date.now()
    };

    if (this.onReadingCallback) {
      this.onReadingCallback(reading);
    }
  }

  private notifyStatus(): void {
    if (this.onStatusCallback) {
      this.onStatusCallback({
        isActive: this.isActive,
        currentSimulatedWeight: this.currentWeight,
        stage: this.stage,
        isAutoCycleRunning: this.isAutoCycleRunning
      });
    }
  }
}

export const defaultScaleSimulator = new ScaleSimulator();
