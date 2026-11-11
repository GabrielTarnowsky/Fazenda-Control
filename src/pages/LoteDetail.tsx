import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { store, Animal } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Scale, DollarSign, Activity, ChevronRight, Calendar, Coins, Save, CheckCircle, Weight, AlertTriangle, ArrowRight, BarChart3, Syringe, RefreshCw, Truck, Beef, LandPlot, Plus, Utensils, Wifi, WifiOff, Lock, Unlock, Radio, Zap, ExternalLink, FileSpreadsheet, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { defaultWebSerialService, isRunningInIframe } from "@/services/scale/webSerialService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import WeighingReport from "@/components/WeighingReport";

export default function LoteDetail() {
  const { nome } = useParams<{ nome: string }>();
  const nomeDecodificado = nome ? decodeURIComponent(nome) : '';
  const navigate = useNavigate();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [animalsWithMetrics, setAnimalsWithMetrics] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [marketPrice, setMarketPrice] = useState(330);
  const [successMsg, setSuccessMsg] = useState("");
  const [quickWeight, setQuickWeight] = useState({
    date: new Date().toISOString().split("T")[0],
    tag: "",
    weight: 0
  });
  const tagInputRef = useRef<HTMLInputElement>(null);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportAnimalIds, setReportAnimalIds] = useState<string[]>([]);

  // Integração Web Serial Balança Alfa 3102C.S (Protocolo TRC - 9600 8N1)
  const [scaleStatus, setScaleStatus] = useState<"disconnected" | "connecting" | "connected" | "error">(() => defaultWebSerialService.getStatus());
  const [scalePortLabel, setScalePortLabel] = useState<string>("");
  const [liveScaleWeight, setLiveScaleWeight] = useState<number | null>(null);
  const [isScaleStable, setIsScaleStable] = useState<boolean>(false);
  const [isLiveAutoFill, setIsLiveAutoFill] = useState<boolean>(true); // Atualização ao vivo no input de peso
  const isLiveAutoFillRef = useRef<boolean>(true);
  isLiveAutoFillRef.current = isLiveAutoFill;

  // Estado de travamento pós-pesagem (5 segundos na tela com contagem e próximo boi)
  const [frozenWeighing, setFrozenWeighing] = useState<{
    tag: string;
    animalName?: string;
    weight: number;
    prevWeight?: number;
    gainKg?: number;
    gmdKg?: number;
    countdown: number;
  } | null>(null);
  const frozenWeighingRef = useRef<boolean>(false);
  frozenWeighingRef.current = Boolean(frozenWeighing);
  const countdownTimerRef = useRef<any>(null);

  // Limpa o timer de 5s ao desmontar
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Configura o serviço para Alfa TRC 9600 8N1
    defaultWebSerialService.setConfig({
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      protocol: "alfa_trc"
    });

    const unsubStatus = defaultWebSerialService.onStatusChange((status, err, info) => {
      setScaleStatus(status);
      if (info) setScalePortLabel(info);
      if (status === "connected") {
        toast.success("Balança Alfa 3102C.S conectada com sucesso (Protocolo TRC / 9600 8N1)!");
      } else if (status === "disconnected" && err) {
        toast.error(err);
      }
    });

    const unsubReading = defaultWebSerialService.onReading((reading) => {
      // Se a tela estiver travada nos 5 segundos após pesagem, mantém o valor congelado
      if (frozenWeighingRef.current) {
        return;
      }
      setLiveScaleWeight(reading.weight);
      setIsScaleStable(reading.isStable);
      // Se a sincronização ao vivo estiver ativa, preenche o campo input em tempo real
      if (isLiveAutoFillRef.current && reading.weight > 0) {
        setQuickWeight(prev => ({ ...prev, weight: reading.weight }));
      }
    });

    return () => {
      unsubStatus();
      unsubReading();
    };
  }, []);

  const handleConnectScale = async () => {
    if (!("serial" in navigator)) {
      toast.error(
        "A Web Serial API não está disponível neste navegador. Abra o sistema no Google Chrome ou Microsoft Edge pelo notebook/PC e certifique-se de acessar via HTTPS.",
        { duration: 7000 }
      );
      return;
    }

    try {
      defaultWebSerialService.setConfig({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        protocol: "alfa_trc"
      });
      await defaultWebSerialService.connectSerial();
    } catch (err: any) {
      if (err.message && !err.message.includes("Nenhuma porta")) {
        toast.error(err.message);
      }
    }
  };

  const handleDisconnectScale = async () => {
    await defaultWebSerialService.disconnect();
    toast.info("Balança desconectada da porta serial.");
  };

  const handleCaptureWeight = () => {
    if (liveScaleWeight !== null && liveScaleWeight > 0) {
      setQuickWeight(prev => ({ ...prev, weight: liveScaleWeight }));
      setIsLiveAutoFill(false);
      toast.success(`Peso de ${liveScaleWeight} kg capturado e travado no formulário!`);
    } else {
      toast.info("Aguardando leitura de peso da balança...");
    }
  };

  const [metrics, setMetrics] = useState({
    gmd: 0,
    rendimento: 52, // 52%
    custoArroba: 0,
    arrobasProduzidas: 0,
    pesoTotal: 0,
    custoTotal: 0,
    cicloDias: 0,
    custoDiarioPC: 0,
    lucroPC: 0,
    ganhoTotalKg: 0,
    mediaArroba: 0,
    custoAlimentacao: 0,
    totalVendas: 0,
    lucroTotalVendas: 0,
    custoPorCabeca: 0,
    custoOpPorCabeca: 0,
    custoPorHa: 0,
    areaHa: 0,
    pastureNames: ""
  });

  const [bulkMode, setBulkMode] = useState<{
    type: "vacina" | "status" | "lote" | "";
    value: string;
    date: string;
    description: string;
  }>({
    type: "",
    value: "",
    date: new Date().toISOString().split("T")[0],
    description: ""
  });
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const [loading, setLoading] = useState(true);

  const handleAdvanceNextBoi = (knownReportIds?: string[]) => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setFrozenWeighing(null);

    const weighedSet = new Set(knownReportIds || reportAnimalIds);
    const activeAnimals = animals.filter(a => a.status === "ativo");
    const unweighed = activeAnimals.filter(a => !weighedSet.has(a.id));

    // Zera o peso da balança na tela e seleciona o próximo animal não pesado
    setLiveScaleWeight(0);
    setQuickWeight(prev => ({
      ...prev,
      weight: 0,
      tag: unweighed.length > 0 ? unweighed[0].tag : ""
    }));

    setIsLiveAutoFill(true);

    if (unweighed.length > 0) {
      toast.info(`Balança zerada (0.0 kg). Próximo boi na fila: Brinco #${unweighed[0].tag}`);
    } else {
      toast.success("Balança zerada! Todos os animais ativos deste lote já foram pesados.");
      tagInputRef.current?.focus();
    }
  };

  const handleQuickWeight = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickWeight.tag || quickWeight.weight <= 0) {
      toast.error("Preencha o número do brinco e o peso");
      return;
    }

    const animal = animals.find(a => a.tag === quickWeight.tag);
    if (!animal) {
      toast.error(`Animal #${quickWeight.tag} não encontrado no lote`);
      return;
    }

    const weighedWeight = quickWeight.weight;
    const prevWeight = animal.weight || animal.peso_entrada || 0;
    const gainKg = prevWeight > 0 ? Math.round((weighedWeight - prevWeight) * 10) / 10 : 0;
    
    // Cálculo do GMD
    const lastDate = animal.data_compra || animal.birth_date || quickWeight.date;
    const diffDays = Math.max(1, Math.round((new Date(quickWeight.date).getTime() - new Date(lastDate).getTime()) / (1000 * 3600 * 24)));
    const gmdKg = gainKg / diffDays;

    try {
      // 1. Atualiza no store e banco
      await store.updateAnimal(animal.id, { weight: weighedWeight });

      // 2. Registra o evento de pesagem
      await store.addEvent({
        animal_id: animal.id,
        type: "pesagem",
        date: quickWeight.date,
        description: `Pesagem Balança Alfa 3102C.S - Brinco #${animal.tag} - GMD: ${Math.round(gmdKg * 1000)}g/dia`,
        weight: weighedWeight,
        value: weighedWeight
      });

      // 3. Adiciona animal ao relatório da sessão
      const updatedReportIds = Array.from(new Set([...reportAnimalIds, animal.id]));
      setReportAnimalIds(updatedReportIds);

      // 4. Atualiza estado local imediatamente e recarrega dados para atualizar todas as outras abas (Ativos, GMD, etc.)
      setAnimals(prev => prev.map(a => a.id === animal.id ? { ...a, weight: weighedWeight } : a));
      await loadData();

      toast.success(`Animal #${animal.tag} pesado com sucesso: ${weighedWeight.toFixed(1)} kg!`);

      // 5. Trava na tela por 5 segundos com contagem regressiva
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }

      setFrozenWeighing({
        tag: animal.tag,
        animalName: animal.categoria || animal.breed,
        weight: weighedWeight,
        prevWeight: prevWeight > 0 ? prevWeight : undefined,
        gainKg,
        gmdKg,
        countdown: 5
      });

      countdownTimerRef.current = setInterval(() => {
        setFrozenWeighing(prev => {
          if (!prev || prev.countdown <= 1) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
            // Ao término dos 5 segundos, zera automaticamente e avança para o próximo boi
            handleAdvanceNextBoi(updatedReportIds);
            return null;
          }
          return { ...prev, countdown: prev.countdown - 1 };
        });
      }, 1000);

    } catch (err: any) {
      toast.error(`Erro ao salvar pesagem: ${err.message || "Tente novamente"}`);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkMode.type || !bulkMode.value) {
      toast.error("Preencha todos os campos da ação");
      return;
    }

    const activeAnimals = animals.filter(a => a.status === "ativo");
    if (activeAnimals.length === 0) {
      toast.error("Não há animais ativos no lote para realizar a ação");
      return;
    }

    setIsBulkProcessing(true);
    const total = activeAnimals.length;
    let count = 0;

    try {
      for (const animal of activeAnimals) {
        if (bulkMode.type === "vacina") {
          await store.addEvent({
            animal_id: animal.id,
            type: "vacina",
            date: bulkMode.date,
            description: `${bulkMode.value}: ${bulkMode.description}`,
            weight: 0,
            value: 0
          });
        } else if (bulkMode.type === "status") {
          await store.updateAnimal(animal.id, { status: bulkMode.value });
        } else if (bulkMode.type === "lote") {
          await store.updateAnimal(animal.id, { lote_id: bulkMode.value } as any);
        }
        count++;
        if (count % 10 === 0) toast.info(`Processando... ${count}/${total}`, { id: "bulk-toast" });
      }

      toast.success(`Ação concluída com sucesso para ${total} animais!`, { id: "bulk-toast" });
      setBulkMode({ ...bulkMode, type: "", value: "", description: "" });
      loadData();
    } catch (error) {
      console.error("Bulk action error:", error);
      toast.error("Ocorreu um erro parcial no manejo em massa");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const loadData = async () => {
    if (!nomeDecodificado) return;
    setLoading(true);
    const loteNome = nomeDecodificado;
    const [allAnimals, allEvents, allFinancials, feedingLogsData, settings, allPastures] = await Promise.all([
      store.getAnimals(),
      store.getEvents(),
      store.getFinancials(),
      store.getFeedingLogs(),
      store.getSettings(),
      store.getPastures()
    ]);

    const price = settings.find(s => s.key === 'preco_arroba_pi')?.value;
    if (price) setMarketPrice(Number(price));

    const loteAnimals = allAnimals.filter(a => (a.lote_id || "Sem Lote") === loteNome);
    setAnimals(loteAnimals);
    setEvents(allEvents);
    setFinancials(allFinancials);

    if (loteAnimals.length === 0) {
      setLoading(false);
      return;
    }

    const PRECO_MERCADO_ARROBA = 280;
    const todayStr = new Date().toISOString().split("T")[0];
    const loteAnimalIds = loteAnimals.map(a => a.id);
    
    // Filtro inteligente de tratos por lote (case-insensitive e normalizado)
    const targetLoteClean = loteNome.trim().toLowerCase();
    const feedingLogs = feedingLogsData.filter(l => {
      const lNome = (l.lote_id || "Sem Lote").trim().toLowerCase();
      return lNome === targetLoteClean || 
             lNome.replace(/[^a-z0-9]/g, "") === targetLoteClean.replace(/[^a-z0-9]/g, "");
    });

    // Calc individual metrics for the list
    const enriched = loteAnimals.map(a => {
      const animalEvents = allEvents.filter(e => e.animal_id === a.id);
      
      // Peso entrada
      let pEnt = a.peso_entrada && a.peso_entrada > 0 ? a.peso_entrada : 0; 
      if (pEnt === 0) {
        const evsP = animalEvents
          .filter(e => e.type === "pesagem")
          .sort((ev1, ev2) => ev1.date.localeCompare(ev2.date));
        pEnt = evsP.length > 0 ? evsP[0].weight : (a.origem === "Nascimento" ? 30 : a.weight);
      }

      // Days
      const dEnt = a.data_compra || a.birth_date;
      let dFim = todayStr;
      const vOm = animalEvents.find(e => e.type === "venda" || e.type === "morte");
      if (a.status === "vendido" || a.status === "morto") {
        if (vOm && vOm.date) dFim = vOm.date;
      }
      const msDiff = new Date(dFim).getTime() - new Date(dEnt).getTime();
      const dias = Math.max(1, msDiff / (1000 * 3600 * 24));

      // Weight out
      let pSai = a.peso_saida && a.peso_saida > 0 ? a.peso_saida : 0;
      if (pSai === 0) {
        pSai = (vOm && vOm.weight > 0) ? vOm.weight : a.weight;
      }
      const pSaiAdj = a.status === "vendido" ? pSai * 2 : pSai;

      const gKg = pSaiAdj - pEnt;
      const gmdVal = gKg / dias;
      // 52% de rendimento de carcaça padrão do lote
      const arrG = (gKg * 0.52) / 15;

      // Financial
      const cAnim = a.valor_compra || 0;
      const prBase = a.preco_arroba > 0 ? a.preco_arroba : PRECO_MERCADO_ARROBA;
      let rev = 0;
      if (a.status === "vendido" || a.status === "morto") {
        rev = (vOm && vOm.value > 0) ? vOm.value : 0;
      } else {
        rev = ((pSaiAdj * 0.52) / 15) * prBase;
      }
      const luc = rev - cAnim;

      return {
        ...a,
        gmd: gmdVal,
        lucro: luc,
        arrobasGanhas: arrG,
        pesoEntradaCal: pEnt,
        diasPermanencia: dias,
        vendaValueReal: rev,
        displayWeight: pSaiAdj
      };
    });

    setAnimalsWithMetrics(enriched);

    // Aggregate metrics
    let somaPesosEntradaTotal = 0;
    let somaPesosSaidaTotal = 0;
    enriched.forEach(ea => {
      somaPesosEntradaTotal += ea.pesoEntradaCal;
      somaPesosSaidaTotal += ea.displayWeight;
    });

    const ganhoTotalKg = somaPesosSaidaTotal - somaPesosEntradaTotal;
    // Arrobas produzidas reais com 52% de rendimento de carcaça
    const arrobasTotal = (ganhoTotalKg * 0.52) / 15;
    const mediaArroba = enriched.length > 0 ? (arrobasTotal / enriched.length) : 0;

    let custoTotal = 0;
    let sumMaint = 0;
    let sumFinFeeding = 0;

    // Despesas de animais do lote e despesas gerais marcadas para este lote no financeiro
    allFinancials.forEach(f => {
      if (f.type === "despesa") {
        const isAnimalExpense = f.animal_id && loteAnimalIds.includes(f.animal_id);
        const descLower = (f.description || "").toLowerCase();
        const isLoteExpense = descLower.includes(`[lote: ${loteNome.toLowerCase()}]`) ||
                              descLower.includes(`[lote:${loteNome.toLowerCase()}]`);
        if (isAnimalExpense || isLoteExpense) {
          custoTotal += f.value;
          if (descLower.includes("compra")) {
            // compra de gado
          } else if (
            descLower.includes("trato") || 
            descLower.includes("ração") || 
            descLower.includes("suplemento") ||
            f.category === "Nutrição" ||
            f.category === "Alimentação"
          ) {
            sumFinFeeding += f.value;
          } else {
            sumMaint += f.value;
          }
        }
      }
    });

    loteAnimals.forEach(a => {
      const hasFinComp = allFinancials.some(f => f.animal_id === a.id && f.description.includes("Compra"));
      if (!hasFinComp && a.origem === "Compra" && a.valor_compra) {
        custoTotal += a.valor_compra;
      }
    });

    const cycleDaysAvg = enriched.reduce((acc, ea) => acc + ea.diasPermanencia, 0) / (enriched.length || 1);
    
    // Custo de alimentação consolidado (maior valor entre os registros do trato e lançamentos financeiros)
    const feedingLogsSum = feedingLogs.reduce((acc, l) => acc + (Number(l.total_cost) || 0), 0);
    const totalFeeding = Math.max(feedingLogsSum, sumFinFeeding);

    // Se o feeding log ainda não estava na tabela financeira de despesas gerais, incorpora no custo total
    if (sumFinFeeding === 0 && totalFeeding > 0) {
      custoTotal += totalFeeding;
    }
    
    const totalOp = totalFeeding + sumMaint;
    const costPerDayPC = (enriched.length > 0 && cycleDaysAvg > 0) ? (totalOp / enriched.length) / cycleDaysAvg : 0;
    
    // GMD médio do lote por CABEÇA por dia
    const gmdLote = (cycleDaysAvg > 0 && enriched.length > 0) ? (ganhoTotalKg / enriched.length) / cycleDaysAvg : 0;

    // Custo por @ (Custo operacional da arroba produzida ou custo total por @ no gancho)
    const arrobasTotaisLote = (somaPesosSaidaTotal * 0.52) / 15;
    const custoArroba = totalOp > 0 
      ? (arrobasTotal > 0 ? totalOp / arrobasTotal : 0)
      : (arrobasTotaisLote > 0 ? custoTotal / arrobasTotaisLote : 0);

    // Pastos alocados ao lote e área (ha)
    const lotePastures = allPastures.filter(p => p.current_lot === loteNome);
    const loteAreaHa = lotePastures.reduce((acc, p) => acc + (Number(p.area_ha) || 0), 0);
    const totalFarmPastureArea = allPastures.reduce((acc, p) => acc + (Number(p.area_ha) || 0), 0);
    const activeFarmAnimals = allAnimals.filter(a => a.status === "ativo").length;

    // Área efetiva do lote (usa pastos alocados ou área proporcional da fazenda)
    const effectiveAreaHa = loteAreaHa > 0
      ? loteAreaHa
      : (activeFarmAnimals > 0 && totalFarmPastureArea > 0 ? (totalFarmPastureArea * (enriched.length / activeFarmAnimals)) : 0);

    const custoPorCabeca = enriched.length > 0 ? (custoTotal / enriched.length) : 0;
    const custoOpPorCabeca = enriched.length > 0 ? (totalOp / enriched.length) : 0;
    const custoPorHa = effectiveAreaHa > 0 ? (custoTotal / effectiveAreaHa) : 0;
    const pastureNames = lotePastures.map(p => p.name || `Pasto ${p.number}`).join(", ");

    let totalVendasCalc = 0;
    let lucroVendasCalc = 0;

    loteAnimals.forEach(a => {
        const custoAnimal = a.valor_compra || 0;
        if (a.status === 'vendido') {
             const vendaOrMorte = allEvents.find(e => e.animal_id === a.id && e.type === "venda");
             const vendaValue = (vendaOrMorte && vendaOrMorte.value > 0) ? vendaOrMorte.value : 0;
             const freteDeVenda = allFinancials.find(f => f.animal_id === a.id && f.category === 'Frete de Venda')?.value || 0;
             totalVendasCalc += vendaValue;
             lucroVendasCalc += (vendaValue - custoAnimal - freteDeVenda);
        } else if (a.status === 'ativo') {
             const arrobasAnimal = ((a.weight || 0) * 0.52) / 15;
             const previsaoVenda = arrobasAnimal * (a.preco_arroba || marketPrice);
             totalVendasCalc += previsaoVenda;
             lucroVendasCalc += (previsaoVenda - custoAnimal);
        }
    });

    const totalLuc = lucroVendasCalc;

    setMetrics({
      gmd: gmdLote,
      rendimento: 52,
      custoArroba,
      arrobasProduzidas: arrobasTotal,
      pesoTotal: somaPesosSaidaTotal,
      custoTotal,
      cicloDias: cycleDaysAvg,
      custoDiarioPC: costPerDayPC,
      lucroPC: enriched.length > 0 ? totalLuc / enriched.length : 0,
      ganhoTotalKg,
      mediaArroba,
      custoAlimentacao: totalFeeding,
      totalVendas: totalVendasCalc,
      lucroTotalVendas: lucroVendasCalc,
      custoPorCabeca,
      custoOpPorCabeca,
      custoPorHa,
      areaHa: effectiveAreaHa,
      pastureNames
    });
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [nomeDecodificado]);

  if (loading) return <div className="p-4 text-center py-20 italic">Calculando performance do lote...</div>;

  if (!nomeDecodificado) return null;

  return (
    <div className="p-4 pb-20 animate-fade-in space-y-6">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Relatório do Lote</h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
            <span>{nomeDecodificado} — {animals.length} cabeças</span>
            {metrics.pastureNames && (
              <Badge variant="outline" className="text-[10px] font-bold border-blue-500/40 text-blue-700 bg-blue-500/10">
                Pasto: {metrics.pastureNames} ({metrics.areaHa.toFixed(1)} ha)
              </Badge>
            )}
          </p>
        </div>
        <Button 
          onClick={() => navigate(`/rations/log/new?lote=${encodeURIComponent(nomeDecodificado)}`)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 gap-1.5 shadow-sm self-start sm:self-auto"
        >
          <Utensils className="h-3.5 w-3.5" /> Lançar Ração / Trato
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3 flex flex-col items-center justify-center text-center h-full">
            <Activity className="h-5 w-5 text-primary mb-1" />
            <p className="text-xs text-muted-foreground font-medium mb-0.5">GMD do Lote</p>
            <p className="text-base font-bold text-primary">{metrics.gmd > 0 ? metrics.gmd.toFixed(2) + " kg/dia" : "--"}</p>
            <div className="flex flex-col gap-0.5 mt-1 border-t pt-1 w-full text-[10px] text-muted-foreground">
              <p>Ganho Total: {metrics.ganhoTotalKg.toLocaleString("pt-BR")} kg</p>
              <p>Média Dias: {metrics.cicloDias.toFixed(1)} dias</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-3 flex flex-col items-center justify-center text-center h-full">
            <Scale className="h-5 w-5 text-blue-500 mb-1" />
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Rend. Carcaça</p>
            <p className="text-base font-bold">{metrics.rendimento > 0 ? metrics.rendimento.toFixed(1) + "%" : "--"}</p>
          </CardContent>
        </Card>

        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-3 flex flex-col items-center justify-center text-center h-full">
            <DollarSign className="h-5 w-5 text-destructive mb-1" />
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Custo por @</p>
            <p className="text-base font-bold">R$ {metrics.custoArroba.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-3 flex flex-col items-center justify-center text-center h-full">
            <TrendingUp className="h-5 w-5 text-emerald-500 mb-1" />
            <p className="text-xs text-muted-foreground font-medium mb-0.5">@s Produzidas</p>
            <p className="text-base font-bold text-emerald-600">{metrics.arrobasProduzidas.toFixed(1)} @</p>
            <div className="flex flex-col mt-1 border-t pt-1 w-full text-[10px] text-muted-foreground">
               <p>Média: {metrics.mediaArroba.toFixed(1)} @/cab</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="p-3 flex flex-col items-center justify-center text-center h-full">
            <Coins className="h-5 w-5 text-orange-500 mb-1" />
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Custo do Lote</p>
            <p className="text-base font-bold">R$ {metrics.custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className="text-[9px] text-muted-foreground uppercase font-bold">Ração: R$ {metrics.custoAlimentacao.toLocaleString("pt-BR")}</span>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  navigate(`/rations/log/new?lote=${encodeURIComponent(nomeDecodificado)}`); 
                }}
                className="text-[9px] font-black text-orange-700 hover:text-orange-800 bg-orange-500/15 hover:bg-orange-500/25 px-1.5 py-0.5 rounded border border-orange-500/30 flex items-center gap-0.5 transition-colors"
                title="Lançar fornecimento de ração para este lote"
              >
                <Plus className="h-2.5 w-2.5" /> Trato
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Custo por Cabeça */}
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-3 flex flex-col items-center justify-center text-center h-full">
            <Beef className="h-5 w-5 text-emerald-600 mb-1" />
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Custo / Cabeça</p>
            <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">
              R$ {metrics.custoPorCabeca.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="flex flex-col mt-1 border-t pt-1 w-full text-[10px] text-muted-foreground">
              <p>Operacional: R$ {metrics.custoOpPorCabeca.toFixed(2)}/cab</p>
            </div>
          </CardContent>
        </Card>

        {/* Custo por Hectare */}
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-3 flex flex-col items-center justify-center text-center h-full">
            <LandPlot className="h-5 w-5 text-blue-600 mb-1" />
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Custo / Hectare</p>
            <p className="text-base font-bold text-blue-700 dark:text-blue-400">
              R$ {metrics.custoPorHa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="flex flex-col mt-1 border-t pt-1 w-full text-[10px] text-muted-foreground truncate" title={metrics.pastureNames || "Área proporcional"}>
              {metrics.areaHa > 0 ? (
                <p className="truncate">{metrics.areaHa.toFixed(1)} ha {metrics.pastureNames ? `(${metrics.pastureNames})` : ""}</p>
              ) : (
                <p>Sem pasto alocado</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="p-3 flex flex-col items-center justify-center text-center h-full">
            <Calendar className="h-5 w-5 text-purple-500 mb-1" />
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Ciclo/Dias</p>
            <p className="text-base font-bold">{metrics.cicloDias > 0 ? metrics.cicloDias.toFixed(0) : "--"}</p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-3 flex flex-col items-center justify-center text-center h-full">
            <Activity className="h-5 w-5 text-yellow-500 mb-1" />
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Diária</p>
            <p className="text-base font-bold">R$ {metrics.custoDiarioPC.toFixed(2)}</p>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase font-bold">P/ Cabeça</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-3 flex flex-col items-center justify-center text-center h-full">
            <TrendingUp className="h-5 w-5 text-emerald-500 mb-1" />
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Lucro P/C</p>
            <p className="text-base font-bold text-emerald-600">R$ {metrics.lucroPC.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/10 border-emerald-500/30 col-span-2 md:col-span-1 shadow-md hover:shadow-lg transition-all">
          <CardContent className="p-3 flex flex-col items-center justify-center text-center h-full">
            <DollarSign className="h-6 w-6 text-emerald-600 mb-1" />
            <p className="text-xs text-emerald-800 font-bold uppercase tracking-widest mb-0.5">Total de Vendas</p>
            <p className="text-xl font-black text-emerald-700 leading-none">R$ {metrics.totalVendas.toLocaleString("pt-BR")}</p>
            <div className="flex justify-between w-full mt-2 border-t border-emerald-500/20 pt-2 px-1 text-[11px] font-black uppercase">
               <span className="text-emerald-800/70">Lucro Total:</span>
               <span className={metrics.lucroTotalVendas >= 0 ? "text-emerald-700" : "text-destructive"}>R$ {metrics.lucroTotalVendas.toLocaleString("pt-BR")}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary bg-primary/5 ring-1 ring-primary/20 shadow-lg overflow-hidden rounded-2xl">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/50 backdrop-blur-sm border-b">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" /> Pesagem Rápida no Lote
              </CardTitle>
              {scaleStatus === "connected" ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-black uppercase tracking-wider gap-1.5 py-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Alfa Conectada (TRC 9600 8N1)
                </Badge>
              ) : scaleStatus === "connecting" ? (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px] font-bold gap-1 py-0.5">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Conectando...
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground border-dashed text-[10px] font-semibold gap-1 py-0.5">
                  <WifiOff className="h-3 w-3" /> Balança Desconectada
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conexão serial direta com o indicador Alfa Instrumentos 3102C.S
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Botão Ver Relatório da Sessão Atual */}
            {reportAnimalIds.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsReportOpen(true)}
                className="h-8 text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 gap-1.5 shadow-sm"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Relatório ({reportAnimalIds.length} pesados)
              </Button>
            )}

            {/* Botão Conectar / Desconectar Balança via Web Serial API */}
            {scaleStatus === "connected" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDisconnectScale}
                className="h-8 text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
              >
                <WifiOff className="h-3.5 w-3.5" /> Desconectar
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={scaleStatus === "connecting"}
                onClick={handleConnectScale}
                className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm"
              >
                <Wifi className="h-3.5 w-3.5" /> Conectar Balança Alfa
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(`/weighing?lote=${encodeURIComponent(nomeDecodificado)}`)}
              className="h-8 text-xs font-bold text-emerald-700 border-emerald-600/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 gap-1.5"
            >
              <Zap className="h-3.5 w-3.5 text-emerald-600" />
              Módulo Curral Automático
            </Button>

            <Input 
              type="date" 
              className="w-[125px] h-8 text-[11px] bg-white border-primary/20 font-bold" 
              value={quickWeight.date} 
              onChange={e => setQuickWeight({ ...quickWeight, date: e.target.value })} 
            />
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Aviso instrutivo caso esteja executando dentro do iframe do AI Studio */}
          {isRunningInIframe() && scaleStatus !== "connected" && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Balança conectada ao notebook?</strong> O preview do AI Studio roda em um iframe com restrição de portas seriais pelo navegador. Se o seletor não abrir, acesse em uma nova aba para liberar a porta COM da balança Alfa.
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => window.open(window.location.href, "_blank")}
                className="text-xs font-bold shrink-0 bg-white dark:bg-slate-900 border-blue-300 dark:border-blue-700 gap-1.5 h-8"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir em Nova Aba
              </Button>
            </div>
          )}

          {/* PAINEL DE PESO TRAVADO PÓS-PESAGEM (5 SEGUNDOS COM BOTÃO PRÓXIMO BOI) */}
          {frozenWeighing && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white border-2 border-emerald-500/60 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Lock className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                      PESO GRAVADO NO SISTEMA & TRAVADO
                    </span>
                    <Badge className="bg-emerald-500 text-slate-950 text-[10px] font-black animate-pulse">
                      Liberando em {frozenWeighing.countdown}s
                    </Badge>
                  </div>
                  <p className="text-2xl font-black italic tracking-tight text-white mt-0.5">
                    Brinco #{frozenWeighing.tag} — <span className="text-emerald-400">{frozenWeighing.weight.toFixed(1)} kg</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1 font-medium">
                    {frozenWeighing.prevWeight && (
                      <span className="text-slate-400">Anterior: {frozenWeighing.prevWeight.toFixed(1)} kg</span>
                    )}
                    {frozenWeighing.gainKg !== undefined && (
                      <span className={frozenWeighing.gainKg >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                        Ganho: {frozenWeighing.gainKg >= 0 ? "+" : ""}{frozenWeighing.gainKg.toFixed(1)} kg
                      </span>
                    )}
                    {frozenWeighing.gmdKg !== undefined && (
                      <span className="text-blue-400 font-bold">
                        GMD: {frozenWeighing.gmdKg.toFixed(2)} kg/dia
                      </span>
                    )}
                    <span className="text-emerald-400/80 text-[11px]">
                      • Atualizado nas abas Ativos e Relatório
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <Button
                  type="button"
                  onClick={() => handleAdvanceNextBoi()}
                  className="h-12 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider gap-2 shadow-2xl hover:scale-105 active:scale-95 transition-all w-full md:w-auto"
                >
                  <ArrowRight className="h-5 w-5" />
                  PRÓXIMO BOI (ZERAR AGORA)
                </Button>
              </div>
            </div>
          )}

          {/* Painel do Visor Digital da Balança quando Conectada */}
          {scaleStatus === "connected" && !frozenWeighing && (
            <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-inner flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400">
                  <Radio className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visor Alfa 3102C.S</span>
                    <Badge className={isScaleStable ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[9px] font-black" : "bg-amber-500/20 text-amber-400 border-amber-500/40 text-[9px] font-black"}>
                      {isScaleStable ? "ESTÁVEL" : "OSCILANDO"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                    {scalePortLabel || "RS-232 / USB Serial (TRC)"}
                  </p>
                </div>
              </div>

              {/* Peso em tempo real no visor digital */}
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                  {(liveScaleWeight !== null ? liveScaleWeight : 0).toFixed(1)}
                </span>
                <span className="text-sm font-bold text-slate-400">kg</span>
              </div>

              {/* Botões de controle de captura rápida */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant={isLiveAutoFill ? "secondary" : "outline"}
                  onClick={() => {
                    setIsLiveAutoFill(!isLiveAutoFill);
                    if (!isLiveAutoFill && liveScaleWeight !== null) {
                      setQuickWeight(prev => ({ ...prev, weight: liveScaleWeight }));
                    }
                  }}
                  className="h-8 text-xs font-bold gap-1.5"
                >
                  {isLiveAutoFill ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  {isLiveAutoFill ? "Ao Vivo (Ligado)" : "Travado"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleCaptureWeight}
                  className="h-8 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow"
                >
                  <Check className="h-3.5 w-3.5" />
                  Capturar Peso
                </Button>
              </div>
            </div>
          )}

          <form 
            onSubmit={handleQuickWeight}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end"
          >
            <div className="space-y-1.5 text-left col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase text-muted-foreground ml-1">Brinco</Label>
                {reportAnimalIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAdvanceNextBoi()}
                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <SkipForward className="h-3 w-3" /> Próximo
                  </button>
                )}
              </div>
              <Input 
                ref={tagInputRef}
                placeholder="Ex: 123" 
                value={quickWeight.tag}
                onChange={e => setQuickWeight({ ...quickWeight, tag: e.target.value })}
                className="h-12 text-xl font-black italic bg-white border-primary/30 focus-visible:ring-primary"
              />
            </div>

            <div className="space-y-1.5 text-left col-span-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase text-muted-foreground ml-1">Peso (kg)</Label>
                {scaleStatus === "connected" && liveScaleWeight !== null && !frozenWeighing && (
                  <button
                    type="button"
                    onClick={handleCaptureWeight}
                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    Usar Balança ({liveScaleWeight.toFixed(1)} kg)
                  </button>
                )}
              </div>
              <div className="relative">
                <Input 
                  type="number" 
                  step="0.1"
                  placeholder="0.0" 
                  value={quickWeight.weight || ""}
                  onChange={e => {
                    setIsLiveAutoFill(false);
                    setQuickWeight({ ...quickWeight, weight: Number(e.target.value) });
                  }}
                  className="h-12 text-xl font-black italic bg-white border-primary/30 focus-visible:ring-primary pr-20"
                />
                {scaleStatus === "connected" && !frozenWeighing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCaptureWeight}
                    className="absolute right-1 top-1 h-10 text-[11px] font-black text-emerald-700 hover:bg-emerald-50 px-2"
                  >
                    TRAVAR
                  </Button>
                )}
              </div>
            </div>

            {frozenWeighing ? (
              <Button 
                type="button" 
                onClick={() => handleAdvanceNextBoi()} 
                className="h-12 font-black italic uppercase tracking-widest col-span-2 md:col-span-1 shadow-xl bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
              >
                <ArrowRight className="h-5 w-5" /> PRÓXIMO BOI
              </Button>
            ) : (
              <Button type="submit" className="h-12 font-black italic uppercase tracking-widest col-span-2 md:col-span-1 shadow-xl bg-primary hover:bg-primary/90">
                <Save className="mr-2 h-5 w-5" /> SALVAR PESO
              </Button>
            )}
          </form>

          {successMsg && (
            <div className="mt-4 p-3 bg-white/80 rounded-xl border border-success/30 flex items-center gap-2 animate-in slide-in-from-top-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <p className="text-xs font-bold text-success capitalize">{successMsg}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="ativo" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4 h-11 bg-muted/40 p-1 rounded-xl border">
          <TabsTrigger 
            value="ativo" 
            className="text-xs sm:text-sm font-bold uppercase transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            Ativos
          </TabsTrigger>
          <TabsTrigger 
            value="bulk" 
            className="text-xs sm:text-sm font-bold uppercase transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            Manejo em Massa
          </TabsTrigger>
          <TabsTrigger 
            value="outros" 
            className="text-xs sm:text-sm font-bold uppercase transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            Histórico
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="ativo">
          <div className="space-y-3">
            {animals.filter(a => a.status === "ativo").map(animal => {
              const PRECO_MERCADO_ARROBA = 280;
              let pesoEnt = animal.peso_entrada && animal.peso_entrada > 0 ? animal.peso_entrada : 0;
              if (pesoEnt === 0) {
                const evs = events.filter(e => e.animal_id === animal.id && e.type === "pesagem").sort((ev1, ev2) => ev1.date.localeCompare(ev2.date));
                pesoEnt = evs.length > 0 ? evs[0].weight : (animal.origem === "Nascimento" ? 30 : animal.weight);
              }
              const ganhoKg = animal.weight - pesoEnt;
              const arrobasGanhas = (ganhoKg * 0.52) / 15;
              const dataEntrada = animal.data_compra || animal.birth_date;
              const msDiff = new Date().getTime() - new Date(dataEntrada).getTime();
              const days = Math.max(1, msDiff / (1000 * 3600 * 24));
              const gmd = ganhoKg / days;
              const custoAnimal = animal.valor_compra || 0;
              const precoBase = animal.preco_arroba > 0 ? animal.preco_arroba : PRECO_MERCADO_ARROBA;
              const valorAtual = ((animal.weight * 0.52) / 15) * precoBase;
              const lucro = valorAtual - custoAnimal;

              return (
                <div key={animal.id} onClick={() => navigate(`/animals/${animal.id}`)} className="bg-card rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99] border-muted/60">
                  <div className="flex items-center justify-between mb-3 border-b pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-black italic text-sm ${animal.sex === 'Macho' ? 'bg-blue-500/10 text-blue-600' : 'bg-pink-500/10 text-pink-600'}`}>
                        {animal.tag}
                      </div>
                      <div>
                        <p className="font-black text-lg leading-none mb-1 italic">#{animal.tag}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{animal.breed} · {animal.categoria}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black tracking-tighter leading-none">{animal.weight}kg</p>
                      <p className="text-[9px] text-muted-foreground uppercase font-black mt-1">Peso Atual</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <p className={`text-xs font-black leading-none ${lucro >= 0 ? 'text-emerald-700' : 'text-destructive'}`}>R$ {lucro.toFixed(0)}</p>
                      <p className="text-[7px] uppercase font-black text-muted-foreground mt-1">Lucro Est.</p>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-blue-500/5 border border-blue-500/10">
                      <p className="text-xs font-black text-blue-800 leading-none">{gmd.toFixed(2)}</p>
                      <p className="text-[7px] uppercase font-black text-muted-foreground mt-1">GMD (kg)</p>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-purple-500/5 border border-purple-500/10">
                      <p className="text-xs font-black text-purple-800 leading-none">{arrobasGanhas.toFixed(1)} @</p>
                      <p className="text-[7px] uppercase font-black text-muted-foreground mt-1">Ganho @</p>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-muted/40 border border-muted/50">
                      <p className="text-xs font-black text-muted-foreground leading-none">52%</p>
                      <p className="text-[7px] uppercase font-black text-muted-foreground mt-1">Rendimento</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="bulk">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Manejo do Rebanho ({animals.filter(a => a.status === 'ativo').length} cabeças)
              </CardTitle>
              <p className="text-xs text-muted-foreground">Aplique uma ação para todos os animais ativos deste lote de uma vez.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold">O que deseja fazer?</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <Button 
                      variant={bulkMode.type === "vacina" ? "default" : "outline"} 
                      className="justify-start h-12"
                      onClick={() => setBulkMode({ ...bulkMode, type: "vacina", value: "" })}
                    >
                      <Syringe className="mr-2 h-4 w-4" /> Registrar Vacinação Coletiva
                    </Button>
                    <Button 
                      variant={bulkMode.type === "lote" ? "default" : "outline"}
                      className="justify-start h-12"
                      onClick={() => setBulkMode({ ...bulkMode, type: "lote", value: "" })}
                    >
                      <Truck className="mr-2 h-4 w-4" /> Mudar Todo o Lote de Pasto
                    </Button>
                    <Button 
                      variant={bulkMode.type === "status" ? "default" : "outline"}
                      className="justify-start h-12"
                      onClick={() => setBulkMode({ ...bulkMode, type: "status", value: "" })}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" /> Alterar Status dos Animais
                    </Button>
                  </div>
                </div>

                {bulkMode.type && (
                  <div className="space-y-4 p-4 bg-white rounded-xl border border-primary/10 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-2">
                      <Label className="font-bold">
                        {bulkMode.type === "vacina" ? "Nome da Vacina" : 
                         bulkMode.type === "lote" ? "Novo Lote/Pasto" : "Novo Status"}
                      </Label>
                      {bulkMode.type === "status" ? (
                        <Select value={bulkMode.value} onValueChange={v => setBulkMode({ ...bulkMode, value: v })}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="vendido">Vendido</SelectItem>
                            <SelectItem value="morto">Morto</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input 
                          placeholder={bulkMode.type === "vacina" ? "Ex: Febre Aftosa" : "Ex: Pasto Norte"} 
                          value={bulkMode.value}
                          onChange={e => setBulkMode({ ...bulkMode, value: e.target.value })}
                          className="h-11"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase">Data</Label>
                      <Input 
                        type="date" 
                        value={bulkMode.date}
                        onChange={e => setBulkMode({ ...bulkMode, date: e.target.value })}
                        className="h-11"
                      />
                    </div>

                    {bulkMode.type === "vacina" && (
                      <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase">Observação (Opcional)</Label>
                        <Input 
                          placeholder="Ex: Reforço anual" 
                          value={bulkMode.description}
                          onChange={e => setBulkMode({ ...bulkMode, description: e.target.value })}
                          className="h-11"
                        />
                      </div>
                    )}

                    <Button 
                      className="w-full h-12 font-black uppercase tracking-widest shadow-lg" 
                      onClick={handleBulkAction}
                      disabled={isBulkProcessing}
                    >
                      {isBulkProcessing ? "Processando..." : "Confirmar Ação Coletiva"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outros">
          <div className="space-y-3">
             {animals.filter(a => a.status === "vendido" || a.status === "morto").map(animal => {
               const pesoBase = animal.peso_saida || animal.weight;
               const displayWeight = animal.status === "vendido" ? pesoBase * 2 : pesoBase;
               const vendaOrMorte = events.find(e => e.animal_id === animal.id && (e.type === "venda" || e.type === "morte"));
               const vendaValue = (vendaOrMorte && vendaOrMorte.value > 0) ? vendaOrMorte.value : 0;
               const custoAnimal = animal.valor_compra || 0;
               const freteDesc = financials.find(f => f.animal_id === animal.id && f.category === 'Frete de Venda')?.value || 0;
               
               // Lucro Diferenciado
               const lucro = animal.status === 'vendido' 
                  ? (vendaValue - custoAnimal - freteDesc)
                  : (((animal.weight * 0.52) / 15) * marketPrice - custoAnimal);

               // Cálculo do GMD
               let pesoEnt = animal.peso_entrada && animal.peso_entrada > 0 ? animal.peso_entrada : 0;
               if (pesoEnt === 0) {
                 const evs = events.filter(e => e.animal_id === animal.id && e.type === "pesagem").sort((ev1, ev2) => ev1.date.localeCompare(ev2.date));
                 pesoEnt = evs.length > 0 ? evs[0].weight : (animal.origem === "Nascimento" ? 30 : animal.weight);
               }
               const dataEntrada = animal.data_compra || animal.birth_date;
               const dataSaida = vendaOrMorte && vendaOrMorte.date ? vendaOrMorte.date : new Date().toISOString().split("T")[0];
               const msDiff = new Date(dataSaida).getTime() - new Date(dataEntrada).getTime();
               const days = Math.max(1, msDiff / (1000 * 3600 * 24));
               const ganhoKg = displayWeight - pesoEnt;
               const gmd = ganhoKg / days;

               return (
                 <div key={animal.id} onClick={() => navigate(`/animals/${animal.id}`)} className="bg-card rounded-2xl p-4 border flex flex-col cursor-pointer opacity-80 hover:opacity-100 transition-all shadow-sm border-muted/60">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center font-black text-muted-foreground italic text-xs">
                          {animal.tag}
                        </div>
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                              <p className="font-black text-base text-muted-foreground italic">#{animal.tag}</p>
                              <Badge variant="outline" className="text-[8px] h-4 uppercase font-bold">{animal.status}</Badge>
                           </div>
                           <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-none">{animal.breed} · {animal.categoria}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-xl font-black tracking-tighter text-muted-foreground leading-none">{displayWeight}kg</p>
                        <p className="text-[9px] text-muted-foreground uppercase font-black mt-1">Saída {animal.status === "vendido" ? "(Vivo)" : ""}</p>
                     </div>
                   </div>
                   <div className="mt-3 pt-3 border-t border-muted/50 flex justify-between items-center text-[10px] font-black uppercase text-muted-foreground">
                      <span>Lucro Real: <span className={lucro > 0 ? "text-emerald-600" : "text-destructive"}>R$ {lucro.toFixed(0)}</span></span>
                      <span className="text-blue-600">GMD: {gmd.toFixed(2)}</span>
                   </div>
                 </div>
               );
             })}
          </div>
        </TabsContent>
      </Tabs>

      <WeighingReport 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
        loteId={nomeDecodificado} 
        weightedAnimalIds={reportAnimalIds} 
      />
    </div>
  );
}
