import { useEffect, useState, useMemo } from "react";
import { store, Animal, Financial, parseDateSafe } from "@/lib/store";
import { useNavigate } from "react-router-dom";
import { Plus, BarChart3, TrendingUp, Users, Scale, DollarSign, ArrowUpRight, ArrowDownRight, Wheat, Package, PackagePlus, Activity, Calendar, Weight, Cloud, Database, RefreshCw, Upload, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import PurchaseForm from "@/components/PurchaseForm";

export default function Dashboard() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [financials, setFinancials] = useState<Financial[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [showPurchase, setShowPurchase] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    setAnimals(store.getAnimals());
    setFinancials(store.getFinancials());
    setIngredients(store.getIngredients());
  }, []);

  const user = store.auth.getCurrentUser();
  const lastSync = localStorage.getItem("bovi_last_sync");

  const activeAnimals = useMemo(() => animals.filter(a => a.status === "ativo"), [animals]);
  const totalAnimals = activeAnimals.length;
  
  const projectedProfit = useMemo(() => {
    const PRECO_MERCADO_ARROBA = 280;
    return activeAnimals.reduce((sum, a) => {
      const revenue = (a.weight / 15) * (a.preco_arroba || PRECO_MERCADO_ARROBA);
      const profit = revenue - (a.valor_compra || 0);
      return sum + profit;
    }, 0);
  }, [activeAnimals]);

  // Consider current month for "Gasto Mensal"
  const currentMonth = new Date().toISOString().substring(0, 7);
  const monthlyExpenses = financials
    .filter(f => f.type === "despesa" && f.date.startsWith(currentMonth))
    .reduce((sum, f) => sum + f.value, 0);

  const totalRevenue = financials.filter(f => f.type === "receita").reduce((sum, f) => sum + f.value, 0);
  const totalExpense = financials.filter(f => f.type === "despesa").reduce((sum, f) => sum + f.value, 0);
  const profit = totalRevenue - totalExpense;

  // Transformation for Monthly Production (@ Produzidas) - Nova Solicitação
  const productionData = useMemo(() => {
    // 1. Get all months in range (last 6)
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().substring(0, 7));
    }

    const result = months.map(m => ({ name: m, value: 0 }));

    activeAnimals.forEach(a => {
      const events = store.getEventsByAnimal(a.id)
        .filter(e => e.type === "pesagem")
        .sort((e1, e2) => e1.date.localeCompare(e2.date));
      
      const entryWeight = a.peso_entrada || a.weight;
      const entryDate = a.data_compra || a.birth_date || "2000-01-01";

      months.forEach((m, idx) => {
        // Find last weight in or before month M
        // Find last weight before month M
        const lastInM = events.filter(e => e.date.startsWith(m)).reverse()[0];
        const lastBeforeM = events.filter(e => e.date < m).reverse()[0];

        let weightEnd = 0;
        let weightStart = 0;

        if (lastInM) {
          weightEnd = lastInM.weight;
        } else if (lastBeforeM) {
          weightEnd = lastBeforeM.weight;
        } else if (entryDate.startsWith(m) || entryDate < m) {
          weightEnd = entryWeight;
        }

        if (lastBeforeM) {
          weightStart = lastBeforeM.weight;
        } else if (entryDate < m) {
          // If entry was before this month, start weight is entry weight if no weights yet
          weightStart = entryWeight;
        }

        if (weightEnd > weightStart && weightStart > 0) {
          result[idx].value += (weightEnd - weightStart) / 15;
        }
      });
    });

    return result.map(r => ({ ...r, value: Number(r.value.toFixed(1)) }));
  }, [activeAnimals]);

  // Transformation for Herd Composition (Donut Chart)
  const herdComposition = useMemo(() => {
    const counts: Record<string, number> = {};
    activeAnimals.forEach(a => {
      const cat = a.categoria || "Outros";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [activeAnimals]);

  // Transformation for Lot Performance (GMD)
  const lotPerformance = useMemo(() => {
    const lotesMap: Record<string, { totalGmd: number, count: number }> = {};
    
    // Incluir animais vendidos nos cálculos de performance do lote
    const allRelevantAnimals = animals.filter(a => a.status === "ativo" || a.status === "vendido");
    
    allRelevantAnimals.forEach(a => {
      const lote = a.lote_id || "Sem Lote";
      const dataEnt = a.data_compra || a.birth_date;
      if (!dataEnt) return;
      
      const pEnt = a.peso_entrada || 30;
      // Se vendido, usa Peso Morto * 2. Se ativo, usa o peso atual.
      const pSaida = a.status === "vendido" ? (a.peso_saida || a.weight) * 2 : a.weight;
      
      const gain = pSaida - pEnt;
      const dataFim = a.status === "vendido" ? (new Date().toISOString().split("T")[0]) : new Date().toISOString().split("T")[0]; 
      // Idealmente pegaríamos a data exata da venda, mas por enquanto usamos a data atual como fim do período de ganho se não houver data de saída salva
      
      const days = Math.max(1, (new Date().getTime() - parseDateSafe(dataEnt).getTime()) / (1000 * 3600 * 24));
      const gmd = gain / days;

      if (!lotesMap[lote]) lotesMap[lote] = { totalGmd: 0, count: 0 };
      lotesMap[lote].totalGmd += gmd;
      lotesMap[lote].count++;
    });

    return Object.entries(lotesMap)
      .map(([name, data]) => ({ 
        name, 
        gmd: Number((data.totalGmd / data.count).toFixed(2)) 
      }))
      .filter(l => l.gmd > 0)
      .sort((a,b) => b.gmd - a.gmd);
  }, [animals]);

  // Colors for Pie Chart
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#6366f1'];

  // Consolidação Mensal de Gastos (Nova Solicitação)
  const monthlyConsolidated = useMemo(() => {
    const map = new Map<string, { total: number, count: number }>();
    financials.filter(f => f.type === "despesa").forEach(f => {
      const month = f.date.substring(0, 7); // YYYY-MM
      const current = map.get(month) || { total: 0, count: 0 };
      map.set(month, { 
        total: current.total + f.value, 
        count: current.count + 1 
      });
    });
    
    return Array.from(map.entries())
      .sort((a,b) => b[0].localeCompare(a[0])) // Descendente
      .map(([month, data]) => ({
        month,
        ...data
      }));
  }, [financials]);

  const formatMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const name = date.toLocaleDateString("pt-BR", { month: "long" });
    return name.charAt(0).toUpperCase() + name.slice(1) + "/" + year.slice(2);
  };

  return (
    <div className="space-y-6 animate-fade-in sm:px-2 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter text-slate-900 leading-none uppercase">FAZENDA CONTROL</h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
            Bem-vindo, <span className="text-primary font-bold">{user?.name || "Produtor"}</span>
            {lastSync && (
              <Badge variant="outline" className="text-[10px] font-bold text-slate-400 bg-slate-100/50 border-none ml-2">
                <Activity className="h-3 w-3 mr-1 text-emerald-500" /> 
                Sincronizado {new Date(lastSync).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
              </Badge>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setShowPurchase(!showPurchase)} className="font-bold shadow-lg">
            <PackagePlus className="mr-2 h-4 w-4" /> Comprar Insumo
          </Button>
          <Button onClick={() => navigate("/animals/new")}>
            <Plus className="mr-2 h-4 w-4" /> Novo Animal
          </Button>
        </div>
      </div>

      {showPurchase && (
        <PurchaseForm 
          onSuccess={() => {
            setFinancials(store.getFinancials());
            setIngredients(store.getIngredients());
            setShowPurchase(false);
          }}
          onCancel={() => setShowPurchase(false)}
        />
      )}

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Animais Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{totalAnimals}</div>
            <p className="text-xs text-muted-foreground mt-1 text-success flex items-center font-bold">
               {totalAnimals} cabeças na propriedade
            </p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-emerald-700">Lucro Projetado</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-display text-emerald-700">R$ {projectedProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
            <p className="text-[10px] text-emerald-600/70 mt-1 uppercase font-black">Ganho estimado (Ativos)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto Mensal</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">R$ {monthlyExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1 text-destructive flex items-center">
              <ArrowDownRight className="h-3 w-3 mr-1" /> Despesas deste mês
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro/Prejuízo Geral</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-display ${profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              R$ {profit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center font-medium">
              Balanço histórico geral
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Expenses Chart -> Agora @ Produzidas */}
        <Card className="lg:col-span-4 rounded-xl shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>@ Produzidas por Mês</span>
              <Weight className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            {productionData.length === 0 ? (
              <div className="min-h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                Aguardando pesagens para gerar gráfico.
              </div>
            ) : (
              <div className="h-[250px] w-full pr-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productionData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.2}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
                    <XAxis 
                      dataKey="name" 
                      fontSize={11} 
                      fontWeight="bold"
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => {
                        const [year, month] = value.split("-");
                        return `${month}/${year.slice(2)}`;
                      }}
                    />
                    <YAxis 
                      fontSize={11}
                      fontWeight="bold"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}@`}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(16, 185, 129, 0.05)', radius: 4 }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      formatter={(value: number) => [`${value} @`, "Produzido"]}
                    />
                    <Bar dataKey="value" fill="url(#colorProd)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ingredients Summary */}
        <Card className="lg:col-span-3 rounded-xl shadow-sm border-border/50 bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Insumos e Preços</span>
              <Package className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ingredients.length === 0 ? (
                <p className="text-xs text-center py-4 text-muted-foreground">Nemhum insumo cadastrado.</p>
              ) : (
                ingredients.slice(0, 5).map(ing => (
                  <div key={ing.id} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/50">
                    <div className="flex items-center gap-2">
                      <Wheat className="h-4 w-4 text-primary opacity-70" />
                      <span className="font-bold text-sm">{ing.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-primary text-sm">R$ {ing.cost_per_kg.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">por kg</p>
                    </div>
                  </div>
                ))
              )}
              {ingredients.length > 5 && (
                <Button variant="ghost" size="sm" className="w-full text-[10px] uppercase font-bold text-muted-foreground" onClick={() => navigate("/rations")}>
                  Ver todos os insumos
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PERFORMANCE POR LOTE - SURPRESA */}
        <Card className="lg:col-span-4 rounded-xl shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
               <span>Performance por Lote (GMD Médio)</span>
               <TrendingUp className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lotPerformance} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.2} />
                  <XAxis type="number" fontSize={10} hide />
                  <YAxis dataKey="name" type="category" fontSize={10} width={80} fontWeight="bold" axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="gmd" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fontWeight: 'bold', formatter: (val: any) => `${val}kg/d` }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* COMPOSIÇÃO DO REBANHO - SURPRESA */}
        <Card className="lg:col-span-3 rounded-xl shadow-sm border-border/50">
           <CardHeader>
              <CardTitle className="text-lg">Composição do Rebanho</CardTitle>
           </CardHeader>
           <CardContent className="flex flex-col items-center justify-center pt-0">
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={herdComposition}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {herdComposition.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-center">
                 <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Ativo</p>
                 <p className="text-xl font-black italic">{totalAnimals} Cabeças</p>
              </div>
           </CardContent>
        </Card>
      </div>

      {/* Second Table: Gastos Recentes */}
      <Card className="rounded-xl shadow-sm border-border/50">
        <CardHeader>
          <CardTitle>Resumo de Gastos por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {monthlyConsolidated.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Nenhum gasto consolidado encontrado.</div>
            ) : (
              monthlyConsolidated.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-background border flex items-center justify-center shadow-sm group-hover:bg-primary/5 group-hover:border-primary/20 transition-all">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                         <span className="text-sm font-black italic text-foreground tracking-tight">{formatMonthName(item.month)}</span>
                         <Badge variant="outline" className="text-[9px] h-4 py-0 px-1 border-primary/20 bg-primary/5 text-primary font-bold">{item.count} despes{item.count === 1 ? 'a' : 'as'}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Total consolidado do período</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-rose-600 tracking-tighter text-lg">
                      -R$ {item.total.toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
