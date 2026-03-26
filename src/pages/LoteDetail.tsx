import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { store, Animal } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Scale, DollarSign, Activity, ChevronRight, Calendar, Coins, Save, CheckCircle, Weight, AlertTriangle, ArrowRight, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import WeighingReport from "@/components/WeighingReport";

export default function LoteDetail() {
  const { nome } = useParams<{ nome: string }>();
  const navigate = useNavigate();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [animalsWithMetrics, setAnimalsWithMetrics] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [quickWeight, setQuickWeight] = useState({
    date: new Date().toISOString().split("T")[0],
    tag: "",
    weight: 0
  });
  const tagInputRef = useRef<HTMLInputElement>(null);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportAnimalIds, setReportAnimalIds] = useState<string[]>([]);

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
    custoAlimentacao: 0
  });

  const [loading, setLoading] = useState(true);

  const handleQuickWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickWeight.tag || quickWeight.weight <= 0) {
      toast.error("Preencha o número e o peso");
      return;
    }

    const animal = animals.find(a => a.tag === quickWeight.tag);
    if (!animal) {
      toast.error(`Animal #${quickWeight.tag} não encontrado no lote`);
      return;
    }

    await store.addEvent({
      animal_id: animal.id,
      type: "pesagem",
      date: quickWeight.date,
      description: "Pesagem Rápida no Lote",
      weight: quickWeight.weight,
      value: 0
    });

    setReportAnimalIds(prev => [...new Set([...prev, animal.id])]);
    setIsReportOpen(true);
    toast.success("Peso registrado!");

    setSuccessMsg(`Animal #${quickWeight.tag}: ${quickWeight.weight}kg salvo!`);
    setQuickWeight({ ...quickWeight, tag: "", weight: 0 });
    
    // Refresh
    loadData();
    tagInputRef.current?.focus();
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const loadData = async () => {
    if (!nome) return;
    setLoading(true);
    const loteNome = decodeURIComponent(nome);
    const [allAnimals, allEvents, allFinancials, feedingLogsData] = await Promise.all([
      store.getAnimals(),
      store.getEvents(),
      store.getFinancials(),
      store.getFeedingLogs()
    ]);

    const loteAnimals = allAnimals.filter(a => (a.lote_id || "Sem Lote") === loteNome);
    setAnimals(loteAnimals);
    setEvents(allEvents);

    if (loteAnimals.length === 0) {
      setLoading(false);
      return;
    }

    const PRECO_MERCADO_ARROBA = 280;
    const todayStr = new Date().toISOString().split("T")[0];
    const loteAnimalIds = loteAnimals.map(a => a.id);
    const feedingLogs = feedingLogsData.filter(l => (l.lote_id || "Sem Lote") === loteNome);

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
      const arrG = gKg / 15;

      // Financial
      const cAnim = a.valor_compra || 0;
      const prBase = a.preco_arroba > 0 ? a.preco_arroba : PRECO_MERCADO_ARROBA;
      let rev = 0;
      if (a.status === "vendido" || a.status === "morto") {
        rev = (vOm && vOm.value > 0) ? vOm.value : 0;
      } else {
        rev = (pSaiAdj / 15) * prBase;
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
    const arrobasTotal = ganhoTotalKg / 15;
    const mediaArroba = enriched.length > 0 ? (arrobasTotal / enriched.length) : 0;

    let custoTotal = 0;
    allFinancials.forEach(f => {
      if (f.type === "despesa" && f.animal_id && loteAnimalIds.includes(f.animal_id)) {
        custoTotal += f.value;
      }
    });

    loteAnimals.forEach(a => {
      const hasFinComp = allFinancials.some(f => f.animal_id === a.id && f.description.includes("Compra"));
      if (!hasFinComp && a.origem === "Compra" && a.valor_compra) {
        custoTotal += a.valor_compra;
      }
    });

    const custoArroba = arrobasTotal > 0 ? custoTotal / arrobasTotal : 0;
    const cycleDaysAvg = enriched.reduce((acc, ea) => acc + ea.diasPermanencia, 0) / (enriched.length || 1);
    const totalFeeding = feedingLogs.reduce((acc, l) => acc + (l.total_cost || 0), 0);
    
    let sumMaint = 0;
    allFinancials.forEach(f => {
      if (f.type === "despesa" && f.animal_id && loteAnimalIds.includes(f.animal_id) && !f.description.includes("Compra")) {
        sumMaint += f.value;
      }
    });

    const totalOp = totalFeeding + sumMaint;
    const costPerDayPC = (enriched.length > 0 && cycleDaysAvg > 0) ? (totalOp / enriched.length) / cycleDaysAvg : 0;
    const totalLuc = enriched.reduce((acc, ea) => acc + ea.lucro, 0);
    const gmdLote = cycleDaysAvg > 0 ? ganhoTotalKg / cycleDaysAvg : 0;

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
      custoAlimentacao: totalFeeding
    });
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [nome]);

  if (loading) return <div className="p-4 text-center py-20 italic">Calculando performance do lote...</div>;

  if (!nome) return null;
  const decodedNome = decodeURIComponent(nome);

  return (
    <div className="p-4 pb-20 animate-fade-in space-y-6">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold">Relatório do Lote</h1>
        <p className="text-muted-foreground">{decodedNome} — {animals.length} cabeças</p>
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
            <p className="text-[9px] text-muted-foreground mt-1 uppercase font-bold">Ração: R$ {metrics.custoAlimentacao.toLocaleString("pt-BR")}</p>
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
      </div>

      <Card className="border-primary bg-primary/5 ring-1 ring-primary/20 shadow-lg overflow-hidden rounded-2xl">
        <CardHeader className="pb-3 flex flex-row items-center justify-between bg-white/50 backdrop-blur-sm">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" /> Pesagem Rápida
            </CardTitle>
            <p className="text-xs text-muted-foreground">Registre o peso em sequência</p>
          </div>
          <div className="flex items-center gap-2">
            <Input 
              type="date" 
              className="w-[125px] h-8 text-[11px] bg-white border-primary/20" 
              value={quickWeight.date} 
              onChange={e => setQuickWeight({ ...quickWeight, date: e.target.value })} 
            />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <form 
            onSubmit={handleQuickWeight}
            className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end"
          >
            <div className="space-y-1.5 text-left">
              <Label className="text-xs font-black uppercase text-muted-foreground ml-1">Brinco</Label>
              <Input 
                ref={tagInputRef}
                placeholder="Ex: 123" 
                value={quickWeight.tag}
                onChange={e => setQuickWeight({ ...quickWeight, tag: e.target.value })}
                className="h-12 text-xl font-black italic bg-white border-primary/30 focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-1.5 text-left">
              <Label className="text-xs font-black uppercase text-muted-foreground ml-1">Peso (kg)</Label>
              <Input 
                type="number" 
                step="0.1"
                placeholder="0.0" 
                value={quickWeight.weight || ""}
                onChange={e => setQuickWeight({ ...quickWeight, weight: Number(e.target.value) })}
                className="h-12 text-xl font-black italic bg-white border-primary/30 focus-visible:ring-primary"
              />
            </div>
            <Button type="submit" className="h-12 font-black italic uppercase tracking-widest col-span-2 md:col-span-1 shadow-xl bg-primary hover:bg-primary/90">
              <Save className="mr-2 h-5 w-5" /> SALVAR
            </Button>
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
        <TabsList className="grid w-full grid-cols-2 mb-4 h-11 bg-muted/40 p-1 rounded-xl border">
          <TabsTrigger 
            value="ativo" 
            className="text-xs sm:text-sm font-bold uppercase transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            Ativos no Lote
          </TabsTrigger>
          <TabsTrigger 
            value="outros" 
            className="text-xs sm:text-sm font-bold uppercase transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            Histórico (Vendidos)
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="ativo">
          <div className="space-y-3">
            {animals.filter(a => a.status === "ativo").map(animal => {
              const PRECO_MERCADO_ARROBA = 280;
              let pesoEnt = animal.peso_entrada && animal.peso_entrada > 0 ? animal.peso_entrada : 0;
              if (pesoEnt === 0) {
                const evs = allEvents.filter(e => e.animal_id === animal.id && e.type === "pesagem").sort((ev1, ev2) => ev1.date.localeCompare(ev2.date));
                pesoEnt = evs.length > 0 ? evs[0].weight : (animal.origem === "Nascimento" ? 30 : animal.weight);
              }
              const ganhoKg = animal.weight - pesoEnt;
              const arrobasGanhas = ganhoKg / 15;
              const dataEntrada = animal.data_compra || animal.birth_date;
              const msDiff = new Date().getTime() - new Date(dataEntrada).getTime();
              const days = Math.max(1, msDiff / (1000 * 3600 * 24));
              const gmd = ganhoKg / days;
              const custoAnimal = animal.valor_compra || 0;
              const precoBase = animal.preco_arroba > 0 ? animal.preco_arroba : PRECO_MERCADO_ARROBA;
              const valorAtual = (animal.weight / 15) * precoBase;
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

        <TabsContent value="outros">
          <div className="space-y-3">
             {animals.filter(a => a.status === "vendido" || a.status === "morto").map(animal => {
               const pesoBase = animal.peso_saida || animal.weight;
               const displayWeight = animal.status === "vendido" ? pesoBase * 2 : pesoBase;
               const vendaOrMorte = allEvents.find(e => e.animal_id === animal.id && (e.type === "venda" || e.type === "morte"));
               const vendaValue = (vendaOrMorte && vendaOrMorte.value > 0) ? vendaOrMorte.value : 0;
               const custoAnimal = animal.valor_compra || 0;
               const lucro = vendaValue - custoAnimal;

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
        loteId={nome || ""} 
        weightedAnimalIds={reportAnimalIds} 
      />
    </div>
  );
}
