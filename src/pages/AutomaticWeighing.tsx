import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { store, Animal, AnimalEvent, formatDateDisplay } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Scale, Wifi, WifiOff, Terminal, Sliders, Play, Pause, 
  RotateCcw, Download, Check, AlertCircle, ArrowRight, ArrowLeft, 
  Beef, Sparkles, Volume2, VolumeX, Clock, Calendar, 
  TrendingUp, TrendingDown, FileSpreadsheet, RefreshCw, Zap,
  CheckCircle2, AlertTriangle, ShieldCheck, ChevronRight, Activity
} from "lucide-react";

import { ScaleReading, SerialConfig, StabilityConfig, WeighingRecord, WeighingState, DEFAULT_SERIAL_CONFIG, DEFAULT_STABILITY_CONFIG } from "@/services/scale/types";
import { defaultWebSerialService, SerialDebugFrame } from "@/services/scale/webSerialService";
import { StabilityDetector, StabilityStatus } from "@/services/scale/stabilityDetector";
import { defaultScaleSimulator, SimulatorStatus } from "@/services/scale/scaleSimulator";
import { soundEffects } from "@/services/scale/audioFeedback";
import { ScaleSettingsModal } from "@/components/scale/ScaleSettingsModal";
import { SerialMonitorModal } from "@/components/scale/SerialMonitorModal";

export default function AutomaticWeighing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryLote = searchParams.get("lote") ? decodeURIComponent(searchParams.get("lote")!) : "all";

  // Dados do Sistema
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [events, setEvents] = useState<AnimalEvent[]>([]);
  const [lotes, setLotes] = useState<string[]>([]);
  const [selectedLote, setSelectedLote] = useState<string>(queryLote);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string>("");
  const [searchAnimalQuery, setSearchAnimalQuery] = useState<string>("");

  // Configurações persistidas
  const [stabilityConfig, setStabilityConfig] = useState<StabilityConfig>(() => {
    try {
      const saved = localStorage.getItem("fc_scale_stability_cfg");
      return saved ? JSON.parse(saved) : DEFAULT_STABILITY_CONFIG;
    } catch {
      return DEFAULT_STABILITY_CONFIG;
    }
  });

  const [serialConfig, setSerialConfig] = useState<SerialConfig>(() => {
    try {
      const saved = localStorage.getItem("fc_scale_serial_cfg");
      return saved ? JSON.parse(saved) : DEFAULT_SERIAL_CONFIG;
    } catch {
      return DEFAULT_SERIAL_CONFIG;
    }
  });

  // Estado da Conexão Serial
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Modo Simulador
  const [isSimulatorActive, setIsSimulatorActive] = useState<boolean>(false);
  const [simStatus, setSimStatus] = useState<SimulatorStatus>({
    isActive: false,
    currentSimulatedWeight: 0,
    stage: "empty",
    isAutoCycleRunning: false
  });

  // Estado da Balança e Leituras
  const [currentWeight, setCurrentWeight] = useState<number>(0);
  const [frozenWeight, setFrozenWeight] = useState<number | null>(null);
  const [weighingState, setWeighingState] = useState<WeighingState>("IDLE_EMPTY");
  const [stabilityProgress, setStabilityProgress] = useState<number>(0);
  const [stabilityMessage, setStabilityMessage] = useState<string>("Aguardando entrada do animal...");
  const [rawTelemetry, setRawTelemetry] = useState<string>("--");
  const [softwareTareOffset, setSoftwareTareOffset] = useState<number>(0);

  // Histórico de Pesagens da Sessão
  const [sessionRecords, setSessionRecords] = useState<WeighingRecord[]>(() => {
    try {
      const saved = localStorage.getItem("fc_weighing_session_records");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isSessionActive, setIsSessionActive] = useState<boolean>(true);
  const [sessionStartTime] = useState<string>(() => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));

  // Modais
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isMonitorModalOpen, setIsMonitorModalOpen] = useState<boolean>(false);
  const [debugFrames, setDebugFrames] = useState<SerialDebugFrame[]>([]);

  // Instância do detector de estabilidade (usando ref para evitar reinicializações)
  const detectorRef = useRef<StabilityDetector | null>(null);

  if (!detectorRef.current) {
    detectorRef.current = new StabilityDetector(stabilityConfig);
  }

  // 1. CARREGAR DADOS INICIAIS
  const loadDatabaseData = useCallback(async () => {
    try {
      const [animList, eventList] = await Promise.all([
        store.getAnimals(),
        store.getEvents()
      ]);

      const activeList = (animList || []).filter(a => a.status === "ativo");
      setAnimals(activeList);
      setEvents(eventList || []);

      // Extrai lotes únicos
      const uniqueLotes = Array.from(new Set(activeList.map(a => a.lote_id || a.lot || "Sem Lote"))).filter(Boolean);
      setLotes(uniqueLotes);

      // Se não tiver selecionado animal, seleciona o primeiro
      if (!selectedAnimalId && activeList.length > 0) {
        setSelectedAnimalId(activeList[0].id);
      }
    } catch (err) {
      console.error("Erro ao carregar animais:", err);
    }
  }, [selectedAnimalId]);

  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData]);

  // Salva registros da sessão localmente
  useEffect(() => {
    try {
      localStorage.setItem("fc_weighing_session_records", JSON.stringify(sessionRecords));
    } catch {}
  }, [sessionRecords]);

  // 2. CONFIGURAR DETECTOR DE ESTABILIDADE E CALLBACKS
  useEffect(() => {
    const detector = detectorRef.current;
    if (!detector) return;

    detector.updateConfig(stabilityConfig);

    // Callback quando o peso é estabilizado e capturado com sucesso!
    detector.onCaptured((capturedWeight, reading) => {
      handleAutomaticCapture(capturedWeight, reading);
    });

    // Callback de mudança de status / progresso
    detector.onStateChange((status) => {
      setWeighingState(status.state);
      setStabilityProgress(status.stabilityProgressPct);
      setStabilityMessage(status.message);
      if (status.frozenWeight !== null) {
        setFrozenWeight(status.frozenWeight);
      }
    });

    // Callback quando a plataforma zera (animal desceu)
    detector.onZeroReturn(() => {
      setFrozenWeight(null);
      if (stabilityConfig.soundEnabled) {
        soundEffects.playZeroReleaseTone();
      }
      toast.info("Plataforma liberada. Pronto para o próximo animal!");

      // Avanço automático opcional para o próximo animal não pesado do lote
      if (stabilityConfig.autoAdvanceAnimal) {
        advanceToNextAnimal();
      }
    });
  }, [stabilityConfig]);

  // 3. ANIMAL SELECIONADO & CÁLCULO DE GANHO ANTERIOR
  const currentAnimal = useMemo(() => {
    return animals.find(a => a.id === selectedAnimalId);
  }, [animals, selectedAnimalId]);

  // Última pesagem registrada deste animal
  const previousWeighing = useMemo(() => {
    if (!selectedAnimalId) return null;
    const animalEvents = events
      .filter(e => e.animal_id === selectedAnimalId && e.type === "pesagem")
      .sort((a, b) => b.date.localeCompare(a.date));

    if (animalEvents.length === 0) {
      // Se não houver eventos, verifica se o animal tem peso inicial cadastrado
      if (currentAnimal && currentAnimal.peso_entrada) {
        return {
          weight: currentAnimal.peso_entrada,
          date: currentAnimal.data_compra || currentAnimal.birth_date || "Cadastro Inicial"
        };
      }
      return null;
    }

    return {
      weight: animalEvents[0].weight,
      date: animalEvents[0].date
    };
  }, [selectedAnimalId, events, currentAnimal]);

  // Cálculo de ganho e GMD com o peso que está na balança (ou congelado)
  const realTimePerformance = useMemo(() => {
    const targetWeightToCompare = frozenWeight !== null ? frozenWeight : currentWeight;
    if (!previousWeighing || targetWeightToCompare <= 0) return null;

    const gainKg = Math.round((targetWeightToCompare - previousWeighing.weight) * 10) / 10;
    
    // Dias entre pesagens
    let days = 1;
    if (previousWeighing.date && previousWeighing.date.includes("-")) {
      const prevDate = new Date(previousWeighing.date);
      const today = new Date();
      const diffMs = today.getTime() - prevDate.getTime();
      days = Math.max(1, Math.floor(diffMs / (1000 * 3600 * 24)));
    } else {
      days = 30; // fallback padrão
    }

    const gmdKgPerDay = gainKg / days;
    const gmdGramsPerDay = Math.round(gmdKgPerDay * 1000);

    return {
      previousWeight: previousWeighing.weight,
      previousDate: previousWeighing.date,
      currentWeight: targetWeightToCompare,
      gainKg,
      days,
      gmdKgPerDay: Math.round(gmdKgPerDay * 100) / 100,
      gmdGramsPerDay
    };
  }, [previousWeighing, frozenWeight, currentWeight]);

  // Lista de animais filtrada por lote e busca
  const filteredAnimals = useMemo(() => {
    return animals.filter(a => {
      const loteName = a.lote_id || a.lot || "Sem Lote";
      const matchesLote = selectedLote === "all" || loteName === selectedLote;
      const query = searchAnimalQuery.toLowerCase();
      const matchesSearch = !query || 
        a.tag.toLowerCase().includes(query) || 
        (a.categoria || "").toLowerCase().includes(query) ||
        (a.breed || "").toLowerCase().includes(query);
      return matchesLote && matchesSearch;
    });
  }, [animals, selectedLote, searchAnimalQuery]);

  // IDs de animais já pesados nesta sessão
  const weighedAnimalIdsInSession = useMemo(() => {
    return new Set(sessionRecords.map(r => r.animalId));
  }, [sessionRecords]);

  // Função para avançar automaticamente para o próximo animal da fila
  const advanceToNextAnimal = () => {
    const unweighed = filteredAnimals.filter(a => !weighedAnimalIdsInSession.has(a.id));
    if (unweighed.length > 0) {
      // Pega o primeiro não pesado diferente do atual
      const next = unweighed.find(a => a.id !== selectedAnimalId) || unweighed[0];
      if (next) {
        setSelectedAnimalId(next.id);
        toast.info(`Próximo na fila selecionado: Brinco ${next.tag}`);
      }
    }
  };

  // 4. CAPTURA AUTOMÁTICA E REGISTRO NO SUPABASE / STORE
  const handleAutomaticCapture = async (capturedWeight: number, reading: ScaleReading) => {
    if (!currentAnimal) {
      toast.error("Nenhum animal selecionado na tela para registrar a pesagem!");
      return;
    }

    // Toca som confirmatório
    if (stabilityConfig.soundEnabled) {
      soundEffects.playWeightCapturedBeep();
    }

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toLocaleTimeString("pt-BR", { hour12: false });

    // Calcula ganho em relação à pesagem anterior
    const prevW = previousWeighing ? previousWeighing.weight : currentAnimal.peso_entrada || 0;
    const gainKg = prevW > 0 ? Math.round((capturedWeight - prevW) * 10) / 10 : 0;
    
    let days = 1;
    if (previousWeighing && previousWeighing.date.includes("-")) {
      const prevDate = new Date(previousWeighing.date);
      const diffMs = now.getTime() - prevDate.getTime();
      days = Math.max(1, Math.floor(diffMs / (1000 * 3600 * 24)));
    }
    const gmdGrams = Math.round((gainKg / days) * 1000);

    const description = `[Pesagem Automática Alfa 3102C.S] ${timeStr} - Brinco: ${currentAnimal.tag} - GMD: ${gmdGrams}g/dia`;

    try {
      // 1. Salva evento no banco de dados Supabase / Store (atualiza o animal automaticamente)
      await store.addEvent({
        animal_id: currentAnimal.id,
        type: "pesagem",
        date: dateStr,
        description,
        value: capturedWeight,
        weight: capturedWeight
      });

      // 2. Cria registro detalhado para a sessão de pesagem
      const record: WeighingRecord = {
        id: Math.random().toString(36).substring(2, 9),
        animalId: currentAnimal.id,
        tag: currentAnimal.tag,
        animalName: currentAnimal.categoria || "Bovino",
        loteNome: currentAnimal.lote_id || currentAnimal.lot || "Sem Lote",
        categoria: currentAnimal.categoria,
        raca: currentAnimal.breed,
        currentWeight: capturedWeight,
        previousWeight: prevW > 0 ? prevW : undefined,
        previousDate: previousWeighing?.date,
        weightGainKg: prevW > 0 ? gainKg : undefined,
        daysBetween: days,
        gmdGramsPerDay: gmdGrams,
        date: dateStr,
        time: timeStr,
        origin: reading.raw.includes("MANUAL") ? "manual" : "automatica",
        scaleModel: "Alfa Instrumentos 3102C.S"
      };

      setSessionRecords(prev => [record, ...prev]);

      // Atualiza localmente a lista de eventos e animais para refletir na hora
      await loadDatabaseData();

      toast.success(
        `Pesagem capturada com sucesso: ${capturedWeight.toFixed(1)} kg no brinco ${currentAnimal.tag}!`,
        { duration: 4000 }
      );
    } catch (err: any) {
      console.error("Erro ao salvar pesagem:", err);
      toast.error(`Erro ao salvar pesagem: ${err.message || "Falha na sincronização"}`);
    }
  };

  // 5. PROCESSAMENTO DE LEITURAS SERIAIS DA BALANÇA
  const handleScaleReading = useCallback((reading: ScaleReading) => {
    // Aplica tara de software se configurada
    const adjustedWeight = Math.max(0, Math.round((reading.weight - softwareTareOffset) * 10) / 10);
    const adjustedReading: ScaleReading = {
      ...reading,
      weight: adjustedWeight
    };

    setCurrentWeight(adjustedWeight);
    setRawTelemetry(reading.raw.trim());

    // Alimenta o detector de estabilidade
    if (detectorRef.current) {
      detectorRef.current.pushReading(adjustedReading);
    }
  }, [softwareTareOffset]);

  // Listener para WebSerialService
  useEffect(() => {
    const unsubReading = defaultWebSerialService.onReading(handleScaleReading);
    const unsubStatus = defaultWebSerialService.onStatusChange((status, error) => {
      setIsConnected(status === "connected");
      setIsConnecting(status === "connecting");
      setConnectionError(error || null);

      if (status === "connected") {
        soundEffects.playConnectedTone();
        toast.success("Balança Alfa 3102C.S conectada com sucesso!");
      } else if (status === "disconnected" && error) {
        toast.error(error);
      }
    });

    const unsubDebug = defaultWebSerialService.onDebugFrame((frame) => {
      setDebugFrames(prev => [frame, ...prev.slice(0, 39)]);
    });

    return () => {
      unsubReading();
      unsubStatus();
      unsubDebug();
    };
  }, [handleScaleReading]);

  // Listener para Simulador
  useEffect(() => {
    defaultScaleSimulator.setOnReading((reading) => {
      if (isSimulatorActive) {
        handleScaleReading(reading);
      }
    });

    defaultScaleSimulator.setOnStatus((status) => {
      setSimStatus(status);
    });
  }, [isSimulatorActive, handleScaleReading]);

  // 6. AÇÕES DO OPERADOR
  const handleConnectSerial = async () => {
    if (isConnected) {
      await defaultWebSerialService.disconnect();
      setIsConnected(false);
      detectorRef.current?.reset();
      setWeighingState("DISCONNECTED");
      toast.info("Balança desconectada.");
      return;
    }

    try {
      defaultWebSerialService.setConfig(serialConfig);
      await defaultWebSerialService.connectSerial();
    } catch (err: any) {
      // O erro já é tratado no listener de status
    }
  };

  const handleToggleSimulator = () => {
    if (isSimulatorActive) {
      defaultScaleSimulator.stop();
      setIsSimulatorActive(false);
      detectorRef.current?.reset();
      toast.info("Modo simulador desativado.");
    } else {
      if (isConnected) {
        defaultWebSerialService.disconnect();
      }
      setIsSimulatorActive(true);
      defaultScaleSimulator.start();
      toast.success("Modo Simulador ativado! Teste o ciclo de pesagem sem cabos.");
    }
  };

  const handleManualForceCapture = () => {
    if (currentWeight < stabilityConfig.minWeightKg) {
      toast.warning(`Peso na balança (${currentWeight} kg) é inferior ao mínimo (${stabilityConfig.minWeightKg} kg)`);
      return;
    }
    try {
      detectorRef.current?.forceManualCapture(currentWeight);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleZeroTare = () => {
    setSoftwareTareOffset(currentWeight);
    toast.info(`Tara ajustada para ${currentWeight.toFixed(1)} kg`);
  };

  const handleResetTare = () => {
    setSoftwareTareOffset(0);
    toast.info("Tara zerada.");
  };

  // Salvar configurações dos modais
  const handleSaveSettings = (newStability: StabilityConfig, newSerial: SerialConfig) => {
    setStabilityConfig(newStability);
    setSerialConfig(newSerial);
    try {
      localStorage.setItem("fc_scale_stability_cfg", JSON.stringify(newStability));
      localStorage.setItem("fc_scale_serial_cfg", JSON.stringify(newSerial));
    } catch {}

    if (detectorRef.current) {
      detectorRef.current.updateConfig(newStability);
    }
    defaultWebSerialService.setConfig(newSerial);
  };

  // Exportar histórico da sessão para Excel (.CSV compatível com Excel em português)
  const handleExportToExcel = () => {
    if (sessionRecords.length === 0) {
      toast.warning("Nenhuma pesagem realizada nesta sessão para exportar.");
      return;
    }

    const headers = [
      "Data",
      "Hora",
      "Brinco",
      "Lote",
      "Categoria",
      "Raça",
      "Peso Atual (kg)",
      "Peso Anterior (kg)",
      "Ganho (kg)",
      "Dias Entre Pesagens",
      "GMD (g/dia)",
      "Origem",
      "Balança"
    ];

    const rows = sessionRecords.map(r => [
      r.date,
      r.time,
      `"${r.tag}"`,
      `"${r.loteNome || ''}"`,
      `"${r.categoria || ''}"`,
      `"${r.raca || ''}"`,
      r.currentWeight.toFixed(1).replace(".", ","),
      r.previousWeight ? r.previousWeight.toFixed(1).replace(".", ",") : "",
      r.weightGainKg !== undefined ? r.weightGainKg.toFixed(1).replace(".", ",") : "",
      r.daysBetween || "",
      r.gmdGramsPerDay || "",
      r.origin === "automatica" ? "Automática" : "Manual",
      `"${r.scaleModel}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(row => row.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pesagem_alfa3102_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Relatório de pesagem exportado com sucesso para Excel!");
  };

  // Resumo estatístico da sessão
  const sessionStats = useMemo(() => {
    if (sessionRecords.length === 0) return null;
    const weights = sessionRecords.map(r => r.currentWeight);
    const gains = sessionRecords.map(r => r.weightGainKg || 0).filter(g => g !== 0);
    const gmds = sessionRecords.map(r => r.gmdGramsPerDay || 0).filter(g => g !== 0);

    const totalWeighed = sessionRecords.length;
    const avgWeight = weights.reduce((acc, w) => acc + w, 0) / totalWeighed;
    const avgGmd = gmds.length > 0 ? gmds.reduce((acc, g) => acc + g, 0) / gmds.length : 0;
    const maxGain = gains.length > 0 ? Math.max(...gains) : 0;
    const minGain = gains.length > 0 ? Math.min(...gains) : 0;

    return {
      totalWeighed,
      avgWeight: Math.round(avgWeight * 10) / 10,
      avgGmd: Math.round(avgGmd),
      maxGain,
      minGain
    };
  }, [sessionRecords]);

  return (
    <div className="p-3 sm:p-6 pb-24 max-w-7xl mx-auto space-y-6 animate-fade-in font-sans">
      
      {/* 1. BARRA SUPERIOR DE COMANDO & CONEXÃO SERIAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/80 backdrop-blur-md p-4 rounded-3xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black italic tracking-tight text-foreground">
                PESAGEM AUTOMÁTICA
              </h1>
              <Badge variant="outline" className="text-[10px] font-black border-primary/30 text-primary uppercase">
                Alfa 3102C.S
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Captura contínua e travamento automático de peso via cabo serial RS-232 / USB
            </p>
          </div>
        </div>

        {/* Botões de Ação de Conexão */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Botão Conectar Balança */}
          <Button
            type="button"
            onClick={handleConnectSerial}
            disabled={isConnecting}
            className={`h-10 text-xs font-bold gap-2 px-4 shadow-sm transition-all ${
              isConnected 
                ? "bg-rose-600 hover:bg-rose-700 text-white" 
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {isConnecting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Conectando...
              </>
            ) : isConnected ? (
              <>
                <WifiOff className="h-4 w-4" />
                Desconectar Porta
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4" />
                Conectar Balança Alfa
              </>
            )}
          </Button>

          {/* Toggle Modo Simulador */}
          <Button
            type="button"
            variant={isSimulatorActive ? "default" : "outline"}
            onClick={handleToggleSimulator}
            className={`h-10 text-xs font-bold gap-1.5 ${
              isSimulatorActive 
                ? "bg-amber-600 hover:bg-amber-700 text-white shadow-md ring-2 ring-amber-400/40" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className={`h-4 w-4 ${isSimulatorActive ? "fill-current" : ""}`} />
            {isSimulatorActive ? "Simulador Ativo" : "Testar no Simulador"}
          </Button>

          {/* Botão Monitor Serial */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsMonitorModalOpen(true)}
            className="h-10 w-10 text-muted-foreground hover:text-foreground"
            title="Abrir Monitor de Dados Seriais Brutos"
          >
            <Terminal className="h-4 w-4" />
          </Button>

          {/* Botão Configurações */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsSettingsModalOpen(true)}
            className="h-10 w-10 text-muted-foreground hover:text-foreground"
            title="Configurações de Estabilidade e Balança"
          >
            <Sliders className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* BANNER DO MODO SIMULADOR (Quando ativado) */}
      {isSimulatorActive && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 p-4 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-amber-800 dark:text-amber-300 tracking-wide">
                Modo de Teste / Simulação Ativado
              </p>
              <p className="text-[11px] text-muted-foreground">
                Teste a oscilação, estabilização e captura automática no notebook sem precisar dos cabos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => defaultScaleSimulator.simulateAnimalCycle()}
              disabled={simStatus.isAutoCycleRunning}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 gap-1.5 shadow-sm"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {simStatus.isAutoCycleRunning ? "Ciclo em Andamento..." : "Subir Boi na Balança"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => defaultScaleSimulator.simulateAnimalExit()}
              className="text-xs font-bold h-9 gap-1.5 border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Abrir Saída (Zerar)
            </Button>
          </div>
        </div>
      )}

      {/* 2. GRID PRINCIPAL: VISOR INDUSTRIAL + CARD DO ANIMAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUNA ESQUERDA (7 colunas): VISOR DE PESO INDUSTRIAL ESTILO TERMINAL */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="rounded-3xl border-2 border-slate-800/80 bg-slate-950 text-white shadow-2xl overflow-hidden relative">
            
            {/* Cabeçalho do Visor */}
            <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`h-3 w-3 rounded-full ${
                  isConnected ? "bg-emerald-500 animate-pulse" : (isSimulatorActive ? "bg-amber-400 animate-pulse" : "bg-rose-500")
                }`} />
                <span className="text-xs font-black tracking-widest uppercase text-slate-300 font-mono">
                  {isConnected ? "ALFA 3102C.S ONLINE" : (isSimulatorActive ? "SIMULADOR VIRTUAL" : "OFFLINE")}
                </span>
                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                  {serialConfig.baudRate} 8N1 • {serialConfig.protocol.toUpperCase()}
                </span>
              </div>

              {/* Badges de Estado Industrial */}
              <div className="flex items-center gap-1.5">
                {currentWeight <= stabilityConfig.zeroReturnThresholdKg && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] font-black tracking-widest">
                    ZERO
                  </Badge>
                )}

                {weighingState === "WEIGHT_CAPTURED" || weighingState === "WAITING_ZERO_RELEASE" ? (
                  <Badge className="bg-emerald-500 text-slate-950 font-black text-[10px] tracking-wider animate-bounce">
                    PESO CONGELADO
                  </Badge>
                ) : weighingState === "WEIGHING_STABILIZING" ? (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-black tracking-wider">
                    ESTABILIZANDO
                  </Badge>
                ) : weighingState === "WEIGHING_UNSTABLE" ? (
                  <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] font-black tracking-wider">
                    INSTÁVEL
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500 border-slate-800 text-[10px]">
                    LIVRE
                  </Badge>
                )}
              </div>
            </div>

            {/* O VISOR GIGANTE (DIGITAL DISPLAY) */}
            <div className="p-6 sm:p-10 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-slate-950 to-[#03060a]">
              
              {/* Glow sutil de fundo quando congelado */}
              {(weighingState === "WEIGHT_CAPTURED" || weighingState === "WAITING_ZERO_RELEASE") && (
                <div className="absolute inset-0 bg-emerald-500/10 blur-3xl pointer-events-none" />
              )}

              {/* Rótulo superior */}
              <div className="w-full flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
                <span className="flex items-center gap-1 text-[11px] font-bold">
                  {softwareTareOffset > 0 && <span className="text-amber-400">(TARA: {softwareTareOffset.toFixed(1)}kg)</span>}
                  PESO BRUTO
                </span>
                <span className="text-[10px] text-slate-500 truncate max-w-[200px]" title={rawTelemetry}>
                  FRAME: {rawTelemetry}
                </span>
              </div>

              {/* DÍGITOS GIGANTES */}
              <div className="flex items-baseline justify-center gap-3 my-2 z-10">
                <span className={`text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter font-mono transition-colors drop-shadow-[0_0_25px_rgba(16,185,129,0.25)] ${
                  weighingState === "WEIGHT_CAPTURED" || weighingState === "WAITING_ZERO_RELEASE"
                    ? "text-emerald-400 drop-shadow-[0_0_35px_rgba(52,211,153,0.5)]"
                    : (weighingState === "WEIGHING_STABILIZING" ? "text-amber-300" : "text-white")
                }`}>
                  {(frozenWeight !== null ? frozenWeight : currentWeight).toFixed(1)}
                </span>
                <span className="text-2xl sm:text-3xl font-black text-slate-400 font-mono">
                  kg
                </span>
              </div>

              {/* BARRA DE PROGRESSO DE ESTABILIDADE */}
              <div className="w-full mt-4 space-y-1.5 z-10">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 font-mono">
                  <span>ESTABILIDADE:</span>
                  <span className={stabilityProgress === 100 ? "text-emerald-400 font-black" : "text-slate-300"}>
                    {stabilityProgress}%
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-150 ${
                      stabilityProgress === 100 
                        ? "bg-emerald-400 shadow-[0_0_15px_#34d399]" 
                        : (stabilityProgress > 0 ? "bg-amber-400" : "bg-transparent")
                    }`}
                    style={{ width: `${stabilityProgress}%` }}
                  />
                </div>
              </div>

              {/* Mensagem de Instrução no Visor */}
              <div className="mt-5 p-3 rounded-2xl bg-white/5 border border-white/10 w-full text-center z-10">
                <p className="text-xs sm:text-sm font-black italic tracking-wide text-slate-200">
                  {stabilityMessage}
                </p>
              </div>
            </div>

            {/* Rodapé de Comandos Manuais do Visor */}
            <div className="p-3.5 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleZeroTare}
                  className="h-8 text-xs font-bold text-slate-300 border-slate-700 bg-slate-800/80 hover:bg-slate-700"
                >
                  Zerar Tara
                </Button>
                {softwareTareOffset > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleResetTare}
                    className="h-8 text-xs font-bold text-amber-400 hover:text-amber-300 hover:bg-slate-800"
                  >
                    Reset Tara
                  </Button>
                )}
              </div>

              {/* Botão de Forçar Captura Manual */}
              <Button
                size="sm"
                onClick={handleManualForceCapture}
                disabled={currentWeight < stabilityConfig.minWeightKg}
                className="h-8 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-md"
              >
                <Check className="h-3.5 w-3.5" />
                Forçar Captura Manual
              </Button>
            </div>
          </Card>

          {/* Dica do Protocolo Alfa Instrumentos */}
          <div className="p-4 rounded-2xl bg-muted/40 border text-xs text-muted-foreground flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <p className="font-bold text-foreground">
                Comunicação com a Balança Alfa Instrumentos 3102C.S:
              </p>
              <p>
                O sistema lê continuamente o fluxo de pesagem pelo cabo serial/USB. Quando o peso estabilizar dentro de ±{stabilityConfig.toleranceKg} kg por {stabilityConfig.minStabilityTimeMs / 1000}s, o peso é gravado e congelado automaticamente, sem necessidade de tocar no teclado.
              </p>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA (5 colunas): ANIMAL EM PESAGEM & COMPARATIVO */}
        <div className="lg:col-span-5 space-y-4">
          
          <Card className="rounded-3xl border shadow-md overflow-hidden bg-card">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Beef className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-black italic">
                    ANIMAL NA PLATAFORMA
                  </CardTitle>
                </div>

                {currentAnimal && (
                  <Badge variant="outline" className="font-black text-xs border-primary/30 text-primary">
                    {currentAnimal.tag}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Selecione o animal que está entrando no brete
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              
              {/* Filtro de Lote e Busca Rápida de Brinco */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Filtrar por Lote</Label>
                  <Select value={selectedLote} onValueChange={setSelectedLote}>
                    <SelectTrigger className="font-bold text-xs h-9">
                      <SelectValue placeholder="Todos os Lotes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Lotes ({animals.length})</SelectItem>
                      {lotes.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Buscar por Brinco</Label>
                  <Input
                    placeholder="Digitar nº do brinco..."
                    value={searchAnimalQuery}
                    onChange={(e) => setSearchAnimalQuery(e.target.value)}
                    className="h-9 font-bold text-xs"
                  />
                </div>
              </div>

              {/* Seletor do Animal Ativo */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-muted-foreground">
                  <span>Selecionar Animal</span>
                  <span>{filteredAnimals.length} animais disponíveis</span>
                </div>
                <Select value={selectedAnimalId} onValueChange={setSelectedAnimalId}>
                  <SelectTrigger className="font-black text-sm h-11 bg-muted/40 border-primary/30">
                    <SelectValue placeholder="Escolha o animal..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {filteredAnimals.map(a => {
                      const isWeighed = weighedAnimalIdsInSession.has(a.id);
                      return (
                        <SelectItem key={a.id} value={a.id} className="font-medium text-xs py-2">
                          <div className="flex items-center justify-between w-full gap-4">
                            <span className="font-black text-foreground">
                              {isWeighed ? "✓ " : ""}{a.tag}
                            </span>
                            <span className="text-muted-foreground text-[11px]">
                              {a.categoria || "Bovino"} • {a.weight}kg • {a.lote_id || a.lot || "Sem Lote"}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Cartão de Detalhes do Animal Selecionado */}
              {currentAnimal ? (
                <div className="p-4 rounded-2xl bg-muted/30 border space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Identificação</p>
                      <h3 className="text-2xl font-black italic text-foreground tracking-tight">
                        BRINCO {currentAnimal.tag}
                      </h3>
                      <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                        {currentAnimal.categoria || "Bovino"} • {currentAnimal.breed || "Nelore"} • {currentAnimal.sex || "Macho"}
                      </p>
                    </div>

                    <Badge className="bg-primary/10 text-primary border-primary/20 font-bold text-xs">
                      {currentAnimal.lote_id || currentAnimal.lot || "Sem Lote"}
                    </Badge>
                  </div>

                  {/* Comparativo: Peso Anterior vs. Peso Atual */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div className="p-3 rounded-xl bg-card border">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Peso Anterior</p>
                      <p className="text-lg font-black text-foreground mt-0.5">
                        {previousWeighing ? `${previousWeighing.weight.toFixed(1)} kg` : "--"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {previousWeighing ? formatDateDisplay(previousWeighing.date) : "Sem histórico"}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                      <p className="text-[10px] font-black uppercase text-primary">Peso Atual (Balança)</p>
                      <p className="text-lg font-black text-primary mt-0.5">
                        {(frozenWeight !== null ? frozenWeight : currentWeight).toFixed(1)} kg
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Hoje, {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>

                  {/* Resumo de Ganho de Peso & GMD */}
                  {realTimePerformance && realTimePerformance.gainKg !== 0 && (
                    <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      realTimePerformance.gainKg >= 0 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300"
                    }`}>
                      <div>
                        <div className="flex items-center gap-1.5 font-black text-xs">
                          {realTimePerformance.gainKg >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-rose-600" />
                          )}
                          <span>
                            {realTimePerformance.gainKg >= 0 ? "+" : ""}{realTimePerformance.gainKg.toFixed(1)} kg no período
                          </span>
                        </div>
                        <p className="text-[10px] opacity-80 mt-0.5">
                          Intervalo de {realTimePerformance.days} dias entre pesagens
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black uppercase tracking-wider block opacity-70">
                          GMD Médio
                        </span>
                        <span className="text-base font-black">
                          {realTimePerformance.gmdGramsPerDay > 0 ? "+" : ""}{realTimePerformance.gmdGramsPerDay} g/dia
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Botão de Avanço Rápido */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={advanceToNextAnimal}
                    className="w-full text-xs font-bold gap-1.5 h-9"
                  >
                    <span>Próximo Animal da Fila</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed rounded-2xl text-muted-foreground text-xs">
                  Nenhum animal cadastrado disponível para pesagem.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. RESUMO DA SESSÃO ATUAL & ESTATÍSTICAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Animais Pesados</p>
              <p className="text-2xl font-black text-foreground mt-0.5">
                {sessionStats ? sessionStats.totalWeighed : 0}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Nesta sessão</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Beef className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Peso Médio</p>
              <p className="text-2xl font-black text-foreground mt-0.5">
                {sessionStats ? `${sessionStats.avgWeight.toFixed(1)} kg` : "--"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Média do lote pesado</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Scale className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">GMD Médio da Sessão</p>
              <p className="text-2xl font-black text-emerald-600 mt-0.5">
                {sessionStats && sessionStats.avgGmd ? `${sessionStats.avgGmd} g/dia` : "--"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Desempenho zootécnico</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Início da Sessão</p>
              <p className="text-2xl font-black text-foreground mt-0.5 font-mono">
                {sessionStartTime}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Sessão em andamento</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. HISTÓRICO DAS PESAGENS DA SESSÃO */}
      <Card className="rounded-3xl border shadow-md overflow-hidden bg-card">
        <CardHeader className="bg-muted/20 border-b pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-black italic flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              HISTÓRICO DE PESAGENS DA SESSÃO
            </CardTitle>
            <CardDescription className="text-xs">
              Registros gravados no banco de dados e sincronizados com a ficha individual de cada animal
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportToExcel}
              disabled={sessionRecords.length === 0}
              className="h-9 text-xs font-bold gap-1.5 bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 border-emerald-500/30"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar para Excel (.csv)
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-black tracking-wider border-b">
                <tr>
                  <th className="px-4 py-3.5">Horário</th>
                  <th className="px-4 py-3.5">Brinco</th>
                  <th className="px-4 py-3.5">Lote / Categoria</th>
                  <th className="px-4 py-3.5 text-right">Peso Atual</th>
                  <th className="px-4 py-3.5 text-right">Peso Anterior</th>
                  <th className="px-4 py-3.5 text-right">Ganho (&Delta;kg)</th>
                  <th className="px-4 py-3.5 text-right">GMD</th>
                  <th className="px-4 py-3.5 text-center">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-medium">
                {sessionRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-xs font-semibold">
                      Nenhuma pesagem realizada nesta sessão ainda. Conecte a balança ou utilize o simulador para começar.
                    </td>
                  </tr>
                ) : (
                  sessionRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {r.time}
                      </td>
                      <td className="px-4 py-3 font-black text-foreground text-sm">
                        {r.tag}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-semibold">
                        {r.loteNome || "Sem Lote"} • {r.categoria || "Bovino"}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-primary text-sm">
                        {r.currentWeight.toFixed(1)} kg
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {r.previousWeight ? `${r.previousWeight.toFixed(1)} kg` : "--"}
                      </td>
                      <td className="px-4 py-3 text-right font-black">
                        {r.weightGainKg !== undefined ? (
                          <span className={r.weightGainKg >= 0 ? "text-emerald-600" : "text-rose-600"}>
                            {r.weightGainKg >= 0 ? "+" : ""}{r.weightGainKg.toFixed(1)} kg
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {r.gmdGramsPerDay ? (
                          <span className={r.gmdGramsPerDay >= 0 ? "text-emerald-600" : "text-rose-600"}>
                            {r.gmdGramsPerDay > 0 ? "+" : ""}{r.gmdGramsPerDay} g/dia
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={`text-[10px] font-bold ${
                          r.origin === "automatica" 
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" 
                            : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                        }`}>
                          {r.origin === "automatica" ? "Alfa 3102C.S" : "Manual"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* MODAL DE CONFIGURAÇÕES DA BALANÇA */}
      <ScaleSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        stabilityConfig={stabilityConfig}
        serialConfig={serialConfig}
        onSave={handleSaveSettings}
      />

      {/* MODAL DE MONITOR SERIAL EM TEMPO REAL */}
      <SerialMonitorModal
        isOpen={isMonitorModalOpen}
        onClose={() => setIsMonitorModalOpen(false)}
        frames={debugFrames}
        onClear={() => setDebugFrames([])}
        isConnected={isConnected}
        scaleModel="Alfa Instrumentos 3102C.S"
      />
    </div>
  );
}
