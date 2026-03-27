import { useEffect, useState, useMemo } from "react";
import { store, Animal, Financial, parseDateSafe } from "@/lib/store";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, DollarSign, Activity, Target, Calendar, Weight, Info, ChevronRight, Award, AlertCircle, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Line, LineChart, Area, AreaChart, Legend } from "recharts";

export default function Reports() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [financials, setFinancials] = useState<Financial[]>([]);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [a, f] = await Promise.all([
          store.getAnimals(),
          store.getFinancials()
        ]);
        setAnimals(a || []);
        setFinancials(f || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 1. Custo da @ Produzida (Estratégico)
  const activeAnimals = useMemo(() => (animals || []).filter(a => a.status === "ativo"), [animals]);

  const costAnalysis = useMemo(() => {
    // Incluir animais ativos e vendidos para análise de custo total de produção
    const relevantAnimals = (animals || []).filter(a => a && (a.status === "ativo" || a.status === "vendido"));
    let totalGainKg = 0;
    
    relevantAnimals.forEach(a => {
      const pEnt = Number(a.peso_entrada) || 30;
      const weight = Number(a.weight) || 0;
      const pFinal = a.status === "vendido" ? (Number(a.peso_saida) || weight) * 2 : weight;
      totalGainKg += Math.max(0, pFinal - pEnt);
    });
    
    const totalArrobas = totalGainKg / 15;

    // Total Expenses
    const totalMaintenance = (financials || [])
      .filter(f => f && f.type === "despesa" && !(f.description || "").includes("Compra"))
      .reduce((sum, f) => sum + (Number(f.value) || 0), 0);
    
    const costPerArroba = totalArrobas > 0 ? totalMaintenance / totalArrobas : 0;
    
    return {
      totalArrobas,
      totalMaintenance,
      costPerArroba
    };
  }, [animals, financials]);

  // 2. Projeção de Abate (Prontos p/ Gancho)
  const slaughterProjection = useMemo(() => {
    const PE_ABATE = 540; // 540kg (aprox 18@)
    const ready = (activeAnimals || []).filter(a => (Number(a.weight) || 0) >= PE_ABATE).length;
    const near = (activeAnimals || []).filter(a => {
      const w = Number(a.weight) || 0;
      return w >= (PE_ABATE - 50) && w < PE_ABATE;
    }).length;
    
    return { 
      ready, 
      near, 
      totalWeightReady: (activeAnimals || []).filter(a => (Number(a.weight) || 0) >= PE_ABATE).reduce((s,a) => s + (Number(a.weight) || 0), 0) 
    };
  }, [activeAnimals]);

  // 3. Gráfico de Ganho por Lote (Performance)
  const lotPerformance = useMemo(() => {
    const lotesMap: Record<string, { gmd: number, count: number }> = {};
    const relevantAnimals = (animals || []).filter(a => a && (a.status === "ativo" || a.status === "vendido"));
    
    relevantAnimals.forEach(a => {
      const lote = a.lote_id || "Sem Lote";
      const pEnt = Number(a.peso_entrada) || 30;
      const weight = Number(a.weight) || 0;
      const pFinal = a.status === "vendido" ? (Number(a.peso_saida) || weight) * 2 : weight;
      const gain = Math.max(0, pFinal - pEnt);
      
      const dataEnt = a.data_compra || a.birth_date;
      if (!dataEnt) return;
      const entryTime = parseDateSafe(dataEnt).getTime();
      if (isNaN(entryTime)) return;
      
      const days = Math.max(1, (new Date().getTime() - entryTime) / (1000 * 3600 * 24));
      const gmd = gain / days;

      if (!lotesMap[lote]) lotesMap[lote] = { gmd: 0, count: 0 };
      lotesMap[lote].gmd += gmd;
      lotesMap[lote].count++;
    });

    return Object.entries(lotesMap).map(([name, data]) => ({
      name,
      gmd: Number((data.gmd / data.count).toFixed(2)) || 0
    })).sort((a,b) => b.gmd - a.gmd);
  }, [animals]);

  // 4. Projeção de Dias para Abate (Estratégico p/ Giro de Estoque)
  const daysToSlaughter = useMemo(() => {
    const PE_ABATE = 540;
    return (activeAnimals || [])
      .map(a => {
        const pEnt = Number(a.peso_entrada) || 30;
        const weight = Number(a.weight) || 0;
        const gain = Math.max(0, weight - pEnt);
        const dataEnt = a.data_compra || a.birth_date;
        const entryDate = dataEnt ? parseDateSafe(dataEnt) : new Date();
        const entryTime = entryDate.getTime();
        const days = isNaN(entryTime) ? 1 : Math.max(1, (new Date().getTime() - entryTime) / (1000 * 3600 * 24));
        const gmd = Math.max(0.1, gain / days); // Avoid div by zero
        
        const remaining = Math.max(0, PE_ABATE - weight);
        const daysLeft = Math.ceil(remaining / gmd);
        const readiness = Math.min(100, (weight / PE_ABATE) * 100);
        
        return { ...a, daysLeft, readiness, gmd };
      })
      .filter(a => a.readiness < 100) // Only those not yet ready
      .sort((a,b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [activeAnimals]);

  const PRECO_MERCADO_ARROBA = 280;

  if (loading) {
    return <div className="p-4 text-center mt-20 font-bold animate-pulse text-muted-foreground">Carregando inteligência de dados...</div>;
  }

  const marketData = [
    { month: 'Out', SP: 235, MG: 230, GO: 225, MS: 228, MT: 215, PI: 210 },
    { month: 'Nov', SP: 238, MG: 235, GO: 230, MS: 232, MT: 220, PI: 215 },
    { month: 'Dez', SP: 245, MG: 240, GO: 238, MS: 235, MT: 225, PI: 220 },
    { month: 'Jan', SP: 248, MG: 242, GO: 240, MS: 238, MT: 228, PI: 222 },
    { month: 'Fev', SP: 240, MG: 235, GO: 230, MS: 232, MT: 220, PI: 215 },
    { month: 'Mar', SP: 232, MG: 228, GO: 225, MS: 220, MT: 210, PI: 205 },
  ];

  return (
    <div className="p-4 pb-20 animate-fade-in space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </button>
        <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 px-3 py-1 font-bold">FAZENDA CONTROL INTELLIGENCE</Badge>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-display font-black tracking-tighter italic text-foreground flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" /> RELATÓRIO ESTRATÉGICO
        </h1>
        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Análise de Performance e Rentabilidade Biológica</p>
      </div>

      {/* Top Intelligence Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><DollarSign className="h-12 w-12" /></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Custo da @ Produzida</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black italic text-primary">R$ {costAnalysis.costPerArroba.toFixed(2)}</div>
            <p className="text-[9px] text-muted-foreground font-bold mt-1">Custo operacional p/ cada arroba de ganho</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/5 border-emerald-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><TrendingUp className="h-12 w-12" /></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Potencial de Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black italic text-emerald-700">R$ {(activeAnimals.reduce((s,a) => s + (a.weight/15), 0) * PRECO_MERCADO_ARROBA).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</div>
            <p className="text-[9px] text-emerald-600/70 font-bold mt-1">Valor do rebanho ativo a R$ {PRECO_MERCADO_ARROBA}/@</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><Weight className="h-12 w-12" /></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Estoque de @ Vivas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black italic text-blue-800">{(activeAnimals.reduce((s,a) => s + (a.weight/15), 0)).toFixed(0)} @</div>
            <p className="text-[9px] text-blue-600/70 font-bold mt-1">Total de arrobas no pasto atualmente</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-500/5 border-purple-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><Activity className="h-12 w-12" /></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">GMD Médio da Fazenda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black italic text-purple-800">
              {(lotPerformance.reduce((s,l) => s + l.gmd, 0) / (lotPerformance.length || 1)).toFixed(2)} kg
            </div>
            <p className="text-[9px] text-purple-600/70 font-bold mt-1">Média de ganho diário global</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Performance por Lote */}
        <Card className="lg:col-span-2 border-border/50 shadow-lg rounded-2xl overflow-hidden bg-white/50 backdrop-blur-sm">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg flex items-center justify-between italic font-black text-muted-foreground">
              EFICIÊNCIA POR LOTE (GMD)
              <BarChart3 className="h-5 w-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lotPerformance} margin={{ right: 30, left: 10 }}>
                   <defs>
                      <linearGradient id="colorGmd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="name" fontSize={11} fontWeight="bold" axisLine={false} tickLine={false} />
                  <YAxis fontSize={11} fontWeight="bold" axisLine={false} tickLine={false} tickFormatter={(v) => `${v}kg`} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                  />
                  <Bar 
                    dataKey="gmd" 
                    fill="url(#colorGmd)" 
                    radius={[8, 8, 0, 0]} 
                    label={{ position: 'top', fontSize: 10, fontWeight: 'bold' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Projeção de Abate */}
        <Card className="border-border/50 shadow-lg rounded-2xl bg-slate-900 text-white overflow-hidden">
          <CardHeader className="bg-slate-800 border-b border-white/5 pb-2">
            <CardTitle className="text-base font-black italic uppercase tracking-tighter flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-400" /> Projeção de Abate
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex flex-col items-center">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Prontos p/ Gancho</p>
              <div className="relative">
                 <div className="h-28 w-28 rounded-full border-4 border-emerald-500/30 flex items-center justify-center">
                    <span className="text-4xl font-black italic text-emerald-400">{slaughterProjection.ready}</span>
                 </div>
                 <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-1.5 rounded-full ring-2 ring-slate-900">
                    <Award className="h-4 w-4" />
                 </div>
              </div>
              <p className="mt-3 text-[11px] font-bold text-slate-300">Total: R$ {(slaughterProjection.totalWeightReady / 15 * PRECO_MERCADO_ARROBA).toLocaleString("pt-BR")} estimados</p>
            </div>

            <div className="space-y-4">
               <div>
                  <div className="flex justify-between text-[11px] font-black uppercase mb-1.5">
                    <span>Quase lá (Prox 30 dias)</span>
                    <span className="text-amber-400">{slaughterProjection.near} Cabeças</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                     <div 
                      className="h-full bg-amber-500 rounded-full animate-pulse" 
                      style={{ width: `${(slaughterProjection.near / (activeAnimals.length || 1)) * 100}%` }}
                     />
                  </div>
               </div>
               
               <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                    <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                      <span className="font-bold text-white">Insight:</span> Sua fazenda tem <span className="text-emerald-400 font-black">{slaughterProjection.ready} animais</span> com mais de 540kg. Momento ideal para negociação.
                    </p>
                  </div>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Indicadores de Mercado */}
      <div className="mt-6">
        <Card className="border-border/50 shadow-lg rounded-2xl overflow-hidden bg-white/50 backdrop-blur-sm">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg flex items-center justify-between italic font-black text-muted-foreground">
               MERCADO AGROPECUÁRIO (Cotação Histórica da @)
               <TrendingUp className="h-5 w-5 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={marketData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                  <YAxis axisLine={false} tickLine={false} domain={['dataMin - 10', 'auto']} tickFormatter={(v) => `R$ ${v}`} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                    itemStyle={{ fontWeight: 'black' }}
                    formatter={(value: number) => [`R$ ${value}`, '']}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontWeight: 'bold', fontSize: 12, paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="SP" name="São Paulo" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="PI" name="Piauí (PI)" stroke="#ec4899" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="MG" name="Minas Gerais" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="GO" name="Goiás" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="MS" name="Mato Grosso Sul" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="MT" name="Mato Grosso" stroke="#ef4444" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-4 font-bold uppercase tracking-widest">
              Valores em R$ para a arroba do boi gordo (Prazos/livre de Funrural) - Referência (Dados Históricos)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
