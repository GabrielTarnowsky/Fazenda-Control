import { useEffect, useState, useMemo } from "react";
import { store, Animal, Financial, AnimalEvent, Pasture, FeedingLog, parseDateSafe } from "@/lib/store";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, DollarSign, Activity, Target, Weight, ChevronRight, Award, AlertCircle, BarChart3, LandPlot, Beef, Utensils, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function Reports() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [financials, setFinancials] = useState<Financial[]>([]);
  const [events, setEvents] = useState<AnimalEvent[]>([]);
  const [pastures, setPastures] = useState<Pasture[]>([]);
  const [feedingLogs, setFeedingLogs] = useState<FeedingLog[]>([]);
  const [marketPrice, setMarketPrice] = useState(327);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [a, f, evs, pasts, feeds, settings] = await Promise.all([
          store.getAnimals(),
          store.getFinancials(),
          store.getEvents(),
          store.getPastures(),
          store.getFeedingLogs(),
          store.getSettings()
        ]);
        setAnimals(a || []);
        setFinancials(f || []);
        setEvents(evs || []);
        setPastures(pasts || []);
        setFeedingLogs(feeds || []);
        
        const price = settings.find(s => s.key === 'preco_arroba_pi')?.value;
        if (price) setMarketPrice(Number(price));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activeAnimals = useMemo(() => (animals || []).filter(a => a.status === "ativo"), [animals]);

  // 1. Custo da @ Produzida e Custo por Hectare (Zootécnico Real - 52% Carcaça)
  const costAnalysis = useMemo(() => {
    const relevantAnimals = (animals || []).filter(a => a && (a.status === "ativo" || a.status === "vendido"));
    let totalGainKg = 0;
    
    relevantAnimals.forEach(a => {
      const animalEvents = events.filter(e => e.animal_id === a.id);
      let pEnt = a.peso_entrada && a.peso_entrada > 0 ? a.peso_entrada : 0;
      if (pEnt === 0) {
        const evsP = animalEvents
          .filter(e => e.type === "pesagem")
          .sort((ev1, ev2) => ev1.date.localeCompare(ev2.date));
        pEnt = evsP.length > 0 ? evsP[0].weight : (a.origem === "Nascimento" ? 30 : a.weight);
      }

      let pFinal = Number(a.weight) || 0;
      if (a.status === "vendido") {
        const vEv = animalEvents.find(e => e.type === "venda");
        pFinal = (vEv && vEv.weight > 0) ? vEv.weight : (Number(a.peso_saida) || pFinal);
      }
      totalGainKg += Math.max(0, pFinal - pEnt);
    });
    
    // Arrobas produzidas de carcaça (52% de rendimento)
    const totalArrobas = (totalGainKg * 0.52) / 15;

    // Despesas de alimentação (rações e suplementos)
    let sumFinFeeding = 0;
    let totalMaintenance = 0;

    (financials || []).forEach(f => {
      if (f && f.type === "despesa") {
        const descLower = (f.description || "").toLowerCase();
        if (descLower.includes("compra")) {
          // Aquisição de gado não entra no custo operacional da @ ganha
        } else if (
          descLower.includes("trato") || 
          descLower.includes("ração") || 
          descLower.includes("suplemento") ||
          f.category === "Nutrição" ||
          f.category === "Alimentação"
        ) {
          sumFinFeeding += Number(f.value) || 0;
        } else {
          totalMaintenance += Number(f.value) || 0;
        }
      }
    });

    const feedingLogsSum = (feedingLogs || []).reduce((acc, l) => acc + (Number(l.total_cost) || 0), 0);
    const totalFeeding = Math.max(feedingLogsSum, sumFinFeeding);
    const totalOpCost = totalMaintenance + totalFeeding;

    const costPerArroba = totalArrobas > 0 ? (totalOpCost / totalArrobas) : 0;

    // Área total de pastagens
    const totalAreaHa = (pastures || []).reduce((sum, p) => sum + (Number(p.area_ha) || 0), 0);
    const costPerHa = totalAreaHa > 0 ? (totalOpCost / totalAreaHa) : 0;
    
    return {
      totalArrobas,
      totalGainKg,
      totalFeeding,
      totalMaintenance,
      totalOpCost,
      costPerArroba,
      totalAreaHa,
      costPerHa
    };
  }, [animals, financials, events, feedingLogs, pastures]);

  // 2. Projeção de Abate (Prontos p/ Gancho com 52% de Carcaça)
  const slaughterProjection = useMemo(() => {
    const PE_ABATE = 540; // 540kg vivo (aprox 18.7 @ no gancho)
    const readyAnimals = (activeAnimals || []).filter(a => (Number(a.weight) || 0) >= PE_ABATE);
    const readyCount = readyAnimals.length;
    
    const nearCount = (activeAnimals || []).filter(a => {
      const w = Number(a.weight) || 0;
      return w >= (PE_ABATE - 50) && w < PE_ABATE;
    }).length;

    const totalWeightReady = readyAnimals.reduce((s, a) => s + (Number(a.weight) || 0), 0);
    // Valor estimado real de venda: Peso Vivo * 52% / 15 * Cotação
    const totalValueReady = ((totalWeightReady * 0.52) / 15) * marketPrice;
    
    return { 
      ready: readyCount, 
      near: nearCount, 
      totalWeightReady,
      totalValueReady
    };
  }, [activeAnimals, marketPrice]);

  // 3. Gráfico de Ganho por Lote (Performance real com histórico de pesagens)
  const lotPerformance = useMemo(() => {
    const lotesMap: Record<string, { totalGain: number, totalDays: number, count: number }> = {};
    const relevantAnimals = (animals || []).filter(a => a && (a.status === "ativo" || a.status === "vendido"));
    const todayStr = new Date().toISOString().split("T")[0];
    
    relevantAnimals.forEach(a => {
      const lote = a.lote_id || a.lot || "Sem Lote";
      const animalEvents = events.filter(e => e.animal_id === a.id);
      
      let pEnt = a.peso_entrada && a.peso_entrada > 0 ? a.peso_entrada : 0;
      if (pEnt === 0) {
        const evsP = animalEvents
          .filter(e => e.type === "pesagem")
          .sort((ev1, ev2) => ev1.date.localeCompare(ev2.date));
        pEnt = evsP.length > 0 ? evsP[0].weight : (a.origem === "Nascimento" ? 30 : a.weight);
      }

      let pFinal = Number(a.weight) || 0;
      let dFim = todayStr;
      if (a.status === "vendido" || a.status === "morto") {
        const vEv = animalEvents.find(e => e.type === "venda" || e.type === "morte");
        if (vEv) {
          if (vEv.weight > 0) pFinal = vEv.weight;
          if (vEv.date) dFim = vEv.date;
        }
      }

      const gain = Math.max(0, pFinal - pEnt);
      const dataEnt = a.data_compra || a.birth_date;
      if (!dataEnt) return;
      const entryTime = parseDateSafe(dataEnt).getTime();
      const endTime = parseDateSafe(dFim).getTime();
      if (isNaN(entryTime)) return;
      
      const days = Math.max(1, (endTime - entryTime) / (1000 * 3600 * 24));

      if (!lotesMap[lote]) lotesMap[lote] = { totalGain: 0, totalDays: 0, count: 0 };
      lotesMap[lote].totalGain += gain;
      lotesMap[lote].totalDays += days;
      lotesMap[lote].count++;
    });

    return Object.entries(lotesMap).map(([name, data]) => {
      // GMD médio por cabeça por dia do lote
      const avgDays = data.totalDays / (data.count || 1);
      const gmd = avgDays > 0 && data.count > 0 ? (data.totalGain / data.count) / avgDays : 0;
      
      // Ração estritamente deste lote:
      const targetName = name.trim().toLowerCase();
      const lotFeedingLogs = (feedingLogs || []).filter(l => {
        const lNome = (l.lote_id || "Sem Lote").trim().toLowerCase();
        return lNome === targetName || lNome.replace(/[^a-z0-9]/g, "") === targetName.replace(/[^a-z0-9]/g, "");
      });
      const feedingCost = lotFeedingLogs.reduce((s, l) => s + (Number(l.total_cost) || 0), 0);
      const arrobasGanhas = (data.totalGain * 0.52) / 15;
      const custoArrobaRacao = (feedingCost > 0 && arrobasGanhas > 0) ? (feedingCost / arrobasGanhas) : 0;

      return {
        name,
        gmd: Number(gmd.toFixed(2)) || 0,
        count: data.count,
        totalGain: data.totalGain,
        arrobasGanhas,
        feedingCost,
        custoArrobaRacao
      };
    }).sort((a,b) => b.gmd - a.gmd);
  }, [animals, events, feedingLogs]);

  // Potencial de Faturamento realista (Carcaça 52%)
  const arrobasCarcacaTotal = useMemo(() => {
    return activeAnimals.reduce((s, a) => s + (((Number(a.weight) || 0) * 0.52) / 15), 0);
  }, [activeAnimals]);

  const arrobasVivasTotal = useMemo(() => {
    return activeAnimals.reduce((s, a) => s + ((Number(a.weight) || 0) / 15), 0);
  }, [activeAnimals]);

  const faturamentoPotencial = arrobasCarcacaTotal * marketPrice;

  const gmdMedioGeral = useMemo(() => {
    if (lotPerformance.length === 0) return 0;
    const totalAnim = lotPerformance.reduce((s, l) => s + l.count, 0);
    if (totalAnim === 0) return 0;
    const sumGmdWeighted = lotPerformance.reduce((s, l) => s + (l.gmd * l.count), 0);
    return sumGmdWeighted / totalAnim;
  }, [lotPerformance]);

  if (loading) {
    return <div className="p-4 text-center mt-20 font-bold animate-pulse text-muted-foreground">Carregando inteligência zootécnica...</div>;
  }

  return (
    <div className="p-4 pb-20 animate-fade-in space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors font-medium">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </button>
        <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 px-3 py-1 font-bold">
          FAZENDA CONTROL INTELLIGENCE
        </Badge>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-display font-black tracking-tighter italic text-foreground flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" /> RELATÓRIO ESTRATÉGICO
        </h1>
        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
          Análise de Performance e Rentabilidade Biológica com Padrão Zootécnico (52% RC)
        </p>
      </div>

      {/* Top Intelligence Cards - 5 Cards estratégicos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Custo da @ Produzida */}
        <Card className="bg-primary/5 border-primary/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><DollarSign className="h-12 w-12" /></div>
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Custo da @ Produzida</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl lg:text-3xl font-black italic text-primary">
              R$ {costAnalysis.costPerArroba.toFixed(2)}
            </div>
            <p className="text-[10px] text-muted-foreground font-semibold mt-1">
              Operacional por @ ganha no gancho
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              Ração: R$ {costAnalysis.totalFeeding.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>

        {/* Custo por Hectare */}
        <Card className="bg-amber-500/5 border-amber-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><LandPlot className="h-12 w-12" /></div>
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Custo por Hectare</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl lg:text-3xl font-black italic text-amber-700 dark:text-amber-400">
              R$ {costAnalysis.costPerHa.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/ha</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-semibold mt-1">
              Desembolso operacional por ha
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              Área total: {costAnalysis.totalAreaHa.toFixed(1)} ha
            </p>
          </CardContent>
        </Card>

        {/* Potencial de Faturamento */}
        <Card className="bg-emerald-500/5 border-emerald-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><TrendingUp className="h-12 w-12" /></div>
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Potencial Faturamento</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl lg:text-3xl font-black italic text-emerald-700 dark:text-emerald-400">
              R$ {faturamentoPotencial.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[10px] text-emerald-600/80 font-semibold mt-1">
              Valor líquido a R$ {marketPrice}/@
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              Base carcaça frigorífico (52%)
            </p>
          </CardContent>
        </Card>

        {/* Estoque de @ */}
        <Card className="bg-blue-500/5 border-blue-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><Weight className="h-12 w-12" /></div>
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Estoque de @</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl lg:text-3xl font-black italic text-blue-800 dark:text-blue-300">
              {arrobasCarcacaTotal.toFixed(0)} @ <span className="text-xs font-bold text-muted-foreground">carcaça</span>
            </div>
            <p className="text-[10px] text-blue-600/80 font-semibold mt-1">
              {arrobasVivasTotal.toFixed(0)} @ de peso vivo total
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              {activeAnimals.length} cabeças no pasto
            </p>
          </CardContent>
        </Card>

        {/* GMD Médio da Fazenda */}
        <Card className="bg-purple-500/5 border-purple-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><Activity className="h-12 w-12" /></div>
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">GMD Médio Global</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl lg:text-3xl font-black italic text-purple-800 dark:text-purple-300">
              {gmdMedioGeral.toFixed(2)} kg
            </div>
            <p className="text-[10px] text-purple-600/80 font-semibold mt-1">
              Média por cabeça / dia
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              Ganho total: {costAnalysis.totalGainKg.toFixed(0)} kg vivos
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Performance por Lote */}
        <Card className="lg:col-span-2 border-border/50 shadow-lg rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm">
          <CardHeader className="bg-muted/30 pb-3">
            <CardTitle className="text-base flex items-center justify-between italic font-black text-foreground">
              <span>EFICIÊNCIA POR LOTE (GMD REAL)</span>
              <BarChart3 className="h-5 w-5 text-primary" />
            </CardTitle>
            <p className="text-xs text-muted-foreground">Ganho Médio Diário (kg/dia) ponderado por pesagens</p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lotPerformance} margin={{ right: 30, left: 10, top: 20 }}>
                   <defs>
                      <linearGradient id="colorGmd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="name" fontSize={12} fontWeight="bold" axisLine={false} tickLine={false} />
                  <YAxis fontSize={11} fontWeight="bold" axisLine={false} tickLine={false} tickFormatter={(v) => `${v}kg`} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                    formatter={(value: any) => [`${value} kg/dia`, 'GMD Médio']}
                  />
                  <Bar 
                    dataKey="gmd" 
                    fill="url(#colorGmd)" 
                    radius={[8, 8, 0, 0]} 
                    label={{ position: 'top', fontSize: 11, fontWeight: 'bold', formatter: (v: any) => `${v} kg` }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Projeção de Abate */}
        <Card className="border-border/50 shadow-lg rounded-2xl bg-slate-900 text-white overflow-hidden flex flex-col justify-between">
          <CardHeader className="bg-slate-800 border-b border-white/5 pb-3">
            <CardTitle className="text-base font-black italic uppercase tracking-tighter flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-400" /> Projeção de Abate
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex flex-col items-center">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Prontos p/ Gancho (&ge; 540kg)</p>
              <div className="relative">
                 <div className="h-28 w-28 rounded-full border-4 border-emerald-500/30 flex items-center justify-center bg-emerald-500/10">
                    <span className="text-4xl font-black italic text-emerald-400">{slaughterProjection.ready}</span>
                 </div>
                 <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-1.5 rounded-full ring-2 ring-slate-900">
                    <Award className="h-4 w-4 text-slate-950" />
                 </div>
              </div>
              <p className="mt-3 text-xs font-bold text-emerald-300">
                Total Estimado: R$ {slaughterProjection.totalValueReady.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-400">Rendimento de carcaça 52% @ R$ {marketPrice}</p>
            </div>

            <div className="space-y-4">
               <div>
                  <div className="flex justify-between text-[11px] font-black uppercase mb-1.5">
                    <span>Quase lá (Prox 30 dias - 490 a 540kg)</span>
                    <span className="text-amber-400">{slaughterProjection.near} {slaughterProjection.near === 1 ? 'Cabeça' : 'Cabeças'}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                     <div 
                      className="h-full bg-amber-500 rounded-full" 
                      style={{ width: `${Math.min(100, (slaughterProjection.near / (activeAnimals.length || 1)) * 100)}%` }}
                     />
                  </div>
               </div>
               
               <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex gap-2.5 items-start">
                    <AlertCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      <span className="font-bold text-white">Insight:</span> Sua fazenda tem <span className="text-emerald-400 font-bold">{slaughterProjection.ready} {slaughterProjection.ready === 1 ? 'animal' : 'animais'}</span> prontos para abate com peso de frigorífico.
                    </p>
                  </div>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controle Nutricional e Custos por Lote */}
      <Card className="border-border/50 shadow-md rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm mt-6">
        <CardHeader className="bg-muted/20 border-b border-border/50 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-black italic flex items-center gap-2">
              <Utensils className="h-5 w-5 text-primary" /> CONTROLE DE RAÇÃO E CUSTOS POR LOTE
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              O custo de ração só é calculado para o lote que você efetivamente adicionar o trato. Lotes a pasto ficam com R$ 0,00 de ração.
            </p>
          </div>
          <Button 
            size="sm"
            onClick={() => navigate("/rations/log/new")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-8 gap-1.5 shadow-sm self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" /> Lançar Novo Trato
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b">
                <tr>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3 text-center">Cabeças</th>
                  <th className="px-4 py-3 text-center">GMD Médio</th>
                  <th className="px-4 py-3 text-right">Ração Lançada</th>
                  <th className="px-4 py-3 text-right">Custo Ração / @ Ganha</th>
                  <th className="px-4 py-3 text-center">Status Nutricional</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-medium">
                {lotPerformance.map(l => (
                  <tr key={l.name} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        <span>{l.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-muted-foreground">
                      {l.count} {l.count === 1 ? 'cab' : 'cabs'}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-primary">
                      {l.gmd > 0 ? `${l.gmd.toFixed(2)} kg/dia` : '--'}
                    </td>
                    <td className="px-4 py-3 text-right font-black">
                      {l.feedingCost > 0 ? (
                        <span className="text-orange-600 dark:text-orange-400">
                          R$ {l.feedingCost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-semibold">
                          R$ 0,00
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {l.feedingCost > 0 && l.custoArrobaRacao > 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          R$ {l.custoArrobaRacao.toFixed(2)} / @
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal text-xs">
                          R$ 0,00 (Sem ração)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {l.feedingCost > 0 ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                          Com Trato Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-border text-[10px]">
                          Apenas Pasto (Sem Ração)
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/rations/log/new?lote=${encodeURIComponent(l.name)}`)}
                        className="text-xs font-bold text-primary hover:text-primary hover:bg-primary/10 h-7 px-2"
                      >
                        + Trato
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Indicadores de Mercado Modernos */}
      <div className="mt-6">
        <h2 className="font-display font-black text-muted-foreground uppercase tracking-widest text-lg mb-3">Cotação do Preço da @</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-border/50 shadow-lg rounded-2xl bg-slate-900 text-white overflow-hidden lg:col-span-1 border-pink-500/20">
            <CardHeader className="bg-slate-800 border-b border-white/5 pb-2">
              <CardTitle className="text-base font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Target className="h-5 w-5 text-pink-500" /> Cotação Região Piaui
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-col items-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Base MATOPIBA (PI)</p>
                <div className="relative">
                   <div className="h-32 w-32 rounded-full border-4 border-pink-500/30 flex items-center justify-center bg-pink-500/10 ring-4 ring-pink-500/5">
                      <div className="flex flex-col items-center">
                         <span className="text-xs text-pink-300 font-bold">R$</span>
                         <span className="text-4xl font-black italic text-pink-400 leading-none">{marketPrice}</span>
                         <span className="text-[10px] text-pink-500/80 font-bold">/@ boi</span>
                      </div>
                   </div>
                   <div className="absolute -bottom-1 -right-1 bg-pink-500 p-2 rounded-full ring-4 ring-slate-900 shadow-xl">
                      <TrendingUp className="h-5 w-5 text-white" />
                   </div>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-xl border border-white/10 mt-2">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-pink-400 shrink-0" />
                  <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                    <span className="font-bold text-white">Projeção Regional:</span> O boi no PI acompanha o mercado do MATOPIBA (MA, TO, PI e BA), referência para frigoríficos da região norte/nordeste.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg rounded-2xl bg-slate-950 text-white overflow-hidden lg:col-span-2">
            <CardHeader className="bg-slate-900 border-b border-white/5 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-black italic uppercase tracking-tighter flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-400" /> Referências Nacionais
              </CardTitle>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/20">Hoje</Badge>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                 
                 <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex flex-col justify-center items-center text-center">
                    <p className="text-[10px] text-emerald-400/80 font-black uppercase mb-1 tracking-wider">São Paulo (SP)</p>
                    <p className="text-3xl font-black text-emerald-400">352<span className="text-sm">,00</span></p>
                    <p className="text-[9px] font-bold text-emerald-500 mt-2 bg-emerald-500/20 px-2 py-0.5 rounded-full">Referência B3</p>
                 </div>

                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-center items-center text-center">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-wider">Mato Grosso (MT)</p>
                    <p className="text-2xl font-black text-white">315<span className="text-sm text-slate-400">,00</span></p>
                    <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase">Base Cuiabá</p>
                 </div>

                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-center items-center text-center">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-wider">Goiás (GO)</p>
                    <p className="text-2xl font-black text-amber-500">335<span className="text-sm opacity-50">,00</span></p>
                    <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase">Base Goiânia</p>
                 </div>

                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-center items-center text-center">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-wider">Mato G. Sul (MS)</p>
                    <p className="text-2xl font-black text-purple-400">330<span className="text-sm opacity-50">,00</span></p>
                    <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase">Base C. Grande</p>
                 </div>

                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-center items-center text-center">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-wider">Minas Gerais (MG)</p>
                    <p className="text-2xl font-black text-sky-400">342<span className="text-sm opacity-50">,00</span></p>
                    <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase">Triângulo Min.</p>
                 </div>

                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-center items-center text-center">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-wider">Pará (PA)</p>
                    <p className="text-2xl font-black text-white">310<span className="text-sm text-slate-400">,00</span></p>
                    <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase">Sul do PA</p>
                 </div>

                 <div className="col-span-2 p-4 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col justify-center">
                    <div className="flex gap-2 items-start">
                      <AlertCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Atenção à Eficiência Operacional</p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                          O controle rígido do custo por @ ganha e do custo por hectare permite identificar se a nutrição (pasto + ração) está gerando margem positiva frente à arroba do frigorífico.
                        </p>
                      </div>
                    </div>
                 </div>

              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
