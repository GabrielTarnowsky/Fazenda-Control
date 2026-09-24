import { useEffect, useState, useMemo } from "react";
import { store, Animal, Financial, AnimalEvent, parseDateSafe, Rainfall, Insemination } from "@/lib/store";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  TrendingUp, 
  Users, 
  BarChart3, 
  ArrowDownRight, 
  PackagePlus, 
  Activity, 
  Calendar, 
  Weight, 
  CloudRain, 
  Droplets, 
  ChevronRight, 
  Target, 
  AlertTriangle, 
  Scale, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Coins, 
  Beef,
  MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import PurchaseForm from "@/components/PurchaseForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Dashboard() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [financials, setFinancials] = useState<Financial[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [events, setEvents] = useState<AnimalEvent[]>([]);
  const [inseminations, setInseminations] = useState<Insemination[]>([]);
  const [rainfall, setRainfall] = useState<Rainfall[]>([]);
  const [autoRainfall, setAutoRainfall] = useState<any[]>([]);
  const [isAutoEnabled, setIsAutoEnabled] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showRainfallDialog, setShowRainfallDialog] = useState(false);
  const [newRainfall, setNewRainfall] = useState({ mm: "", date: new Date().toISOString().split("T")[0] });
  const [marketPrice, setMarketPrice] = useState(280);
  const [curralTab, setCurralTab] = useState<'abate' | 'alertas'>('abate');
  
  const navigate = useNavigate();

  const loadData = () => {
    store.getAnimals().then(setAnimals);
    store.getFinancials().then(setFinancials);
    store.getIngredients().then(setIngredients);
    store.getEvents().then(setEvents);
    store.getInseminations().then(setInseminations);
    store.getRainfall().then(setRainfall);
    store.fetchMarketPrice().then(preco => { if (preco) setMarketPrice(preco); });

    store.getSettings().then(async settings => {
      const savedPrice = settings.find(s => s.key === 'preco_arroba_pi')?.value;
      if (savedPrice && !isNaN(parseFloat(savedPrice))) {
        setMarketPrice(parseFloat(savedPrice));
      }

      const useAuto = settings.find(s => s.key === 'use_auto_rainfall')?.value === 'true';
      const lat = settings.find(s => s.key === 'farm_lat')?.value;
      const lng = settings.find(s => s.key === 'farm_lng')?.value;

      if (useAuto && lat && lng) {
        setIsAutoEnabled(true);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        const today = now.toISOString().split("T")[0];
        
        const autoData = await store.fetchRainfallAuto(parseFloat(lat), parseFloat(lng), startOfMonth, today);
        setAutoRainfall(autoData);
      } else {
        setIsAutoEnabled(false);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddRainfall = async () => {
    if (!newRainfall.mm || parseFloat(newRainfall.mm) <= 0) {
      toast.error("Informe a quantidade de chuva em mm");
      return;
    }
    try {
      await store.addRainfall(parseFloat(newRainfall.mm), newRainfall.date);
      toast.success("Pluviometria registrada!");
      setShowRainfallDialog(false);
      setNewRainfall({ mm: "", date: new Date().toISOString().split("T")[0] });
      loadData();
    } catch (e) {
      toast.error("Erro ao registrar chuva");
    }
  };

  const user = store.auth.getCurrentUser();
  const lastSync = localStorage.getItem("bovi_last_sync");

  const activeAnimals = useMemo(() => animals.filter(a => a.status === "ativo"), [animals]);
  const totalAnimals = activeAnimals.length;

  const projectedProfit = activeAnimals.reduce((sum, a) => {
    const arrobasLiquidas = (a.weight * 0.50) / 15; // 50% rendimento de carcaça padrão
    const revenue = arrobasLiquidas * (a.preco_arroba || marketPrice);
    const profit = revenue - (a.valor_compra || 0);
    return sum + profit;
  }, 0);

  const rainfallStats = useMemo(() => {
    const now = new Date();
    const currentMonthStr = now.toISOString().substring(0, 7);
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfWeekStr = startOfWeek.toISOString().split("T")[0];

    let monthly = 0;
    let weekly = 0;

    if (isAutoEnabled && autoRainfall.length > 0) {
      monthly = autoRainfall.reduce((sum, r) => sum + r.mm, 0);
      weekly = autoRainfall.filter(r => r.date >= startOfWeekStr).reduce((sum, r) => sum + r.mm, 0);
    } else {
      monthly = rainfall.filter(r => r.date.startsWith(currentMonthStr)).reduce((sum, r) => sum + r.mm, 0);
      weekly = rainfall.filter(r => r.date >= startOfWeekStr).reduce((sum, r) => sum + r.mm, 0);
    }

    return { monthly: monthly.toFixed(1), weekly: weekly.toFixed(1) };
  }, [rainfall, autoRainfall, isAutoEnabled]);

  const currentMonth = new Date().toISOString().substring(0, 7);
  const monthlyExpenses = financials
    .filter(f => f.type === "despesa" && f.date.startsWith(currentMonth))
    .reduce((sum, f) => sum + f.value, 0);

  const totalRevenue = financials.filter(f => f.type === "receita").reduce((sum, f) => sum + f.value, 0);
  const totalExpense = financials.filter(f => f.type === "despesa").reduce((sum, f) => sum + f.value, 0);
  const profit = totalRevenue - totalExpense;

  // Curral & Terminação (Ponto de Abate & Alertas)
  const slaughterFunnel = useMemo(() => {
    const ready = activeAnimals.filter(a => a.weight >= 480);
    const near = activeAnimals.filter(a => a.weight >= 400 && a.weight < 480);
    const growing = activeAnimals.filter(a => a.weight < 400);

    const readyWeight = ready.reduce((sum, a) => sum + (a.weight || 0), 0);
    // Rendimento de carcaça padrão de 50% (30 kg de peso vivo = 1 arroba líquida de carcaça)
    const readyArrobas = (readyWeight * 0.50) / 15;
    const readyValue = readyArrobas * marketPrice;

    // Ordena os animais mais pesados para exibição
    const topAnimals = [...activeAnimals].sort((a, b) => b.weight - a.weight).slice(0, 5);

    return {
      ready,
      near,
      growing,
      readyCount: ready.length,
      readyWeight,
      readyArrobas,
      readyValue,
      topAnimals,
      totalCount: activeAnimals.length
    };
  }, [activeAnimals, marketPrice]);

  // Alertas do Curral (pesagens pendentes > 35 dias ou matrizes aguardando toque)
  const curralAlerts = useMemo(() => {
    const now = new Date().getTime();
    
    // Animais ativos sem pesagem há mais de 35 dias
    const pendingWeighing = activeAnimals.filter(a => {
      const animalWeighings = events.filter(e => e.animal_id === a.id && e.type === "pesagem");
      if (animalWeighings.length === 0) return true; // Nunca pesado no curral
      const lastWeighing = animalWeighings.sort((e1, e2) => e2.date.localeCompare(e1.date))[0];
      const days = (now - parseDateSafe(lastWeighing.date).getTime()) / (1000 * 3600 * 24);
      return days > 35;
    });

    // Inseminações aguardando diagnóstico
    const pendingTouch = inseminations.filter(i => i.status === "aguardando");

    return {
      pendingWeighing,
      pendingTouch,
      totalCount: pendingWeighing.length + pendingTouch.length
    };
  }, [activeAnimals, events, inseminations]);

  const herdComposition = useMemo(() => {
    const counts: Record<string, number> = {};
    activeAnimals.forEach(a => {
      const cat = a.categoria || "Outros";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [activeAnimals]);

  const lotPerformance = useMemo(() => {
    const lotesMap: Record<string, { totalGmd: number, count: number }> = {};
    const allRelevantAnimals = animals.filter(a => a.status === "ativo" || a.status === "vendido");
    
    allRelevantAnimals.forEach(a => {
      const lote = a.lote_id || "Sem Lote";
      const dataEnt = a.data_compra || a.birth_date;
      if (!dataEnt) return;
      
      const pEnt = a.peso_entrada || 30;
      const pSaida = a.status === "vendido" ? (a.peso_saida || a.weight) * 2 : a.weight;
      const gain = pSaida - pEnt;
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

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#6366f1'];

  const monthlyConsolidated = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return `${currentYear}-${m.toString().padStart(2, '0')}`;
    });

    const map = new Map<string, { total: number, count: number }>();
    months.forEach(m => map.set(m, { total: 0, count: 0 }));

    financials
      .filter(f => f.type === "despesa" && f.date.startsWith(currentYear.toString()))
      .forEach(f => {
        const month = f.date.substring(0, 7);
        const current = map.get(month) || { total: 0, count: 0 };
        map.set(month, { 
          total: current.total + f.value, 
          count: current.count + 1 
        });
      });
    
    return Array.from(map.entries())
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        ...data
      }));
  }, [financials]);

  const formatMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("pt-BR", { month: "long" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter text-foreground leading-none uppercase">
            {user?.farm_name || "FAZENDA CONTROL"}
          </h1>
          <div className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
            Bem-vindo, <span className="text-primary font-bold">{user?.name || "Produtor"}</span>
            {lastSync && (
              <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground bg-muted/50 border-none ml-2">
                <Activity className="h-3 w-3 mr-1 text-emerald-500" /> 
                Sincronizado {new Date(lastSync).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => navigate("/pastos")} className="font-semibold border-border/80 shadow-sm">
            <MapPin className="mr-2 h-4 w-4 text-emerald-600" /> Pastos & Mapa
          </Button>
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
          onSuccess={async () => {
            setFinancials(await store.getFinancials());
            setIngredients(await store.getIngredients());
            setShowPurchase(false);
          }}
          onCancel={() => setShowPurchase(false)}
        />
      )}

      {/* 4 Metric Cards Originais */}
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

      {/* Pluviometria Section */}
      <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <Card 
          onClick={() => navigate('/rainfall')}
          className="border-none shadow-xl shadow-blue-500/5 bg-gradient-to-br from-slate-50/80 via-blue-50/20 to-blue-100/10 overflow-hidden group cursor-pointer hover:scale-[1.01] transition-all duration-300 active:scale-[0.99]"
        >
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Left Side: Header & Status */}
              <div className="flex items-center gap-4 flex-1">
                <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/10 group-hover:scale-110 transition-transform">
                  <CloudRain className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black italic text-blue-900 tracking-tight">Pluviometria</h3>
                    {isAutoEnabled && (
                      <Badge className="bg-blue-600 text-white border-none text-[7px] font-black uppercase px-1.5 h-3.5 animate-pulse">
                        Auto
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-blue-600/40 uppercase tracking-widest mt-0.5">Clima da Fazenda</p>
                </div>
              </div>

              {/* Middle: Quick Stats */}
              <div className="flex items-center gap-6 px-6 border-x border-blue-100/50 hidden md:flex">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-blue-500/40">Semana</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black italic text-blue-600 leading-none">{rainfallStats.weekly}</span>
                    <span className="text-[10px] font-bold text-blue-400 uppercase">mm</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-blue-500/40">Mês</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black italic text-blue-700 leading-none">{rainfallStats.monthly}</span>
                    <span className="text-[10px] font-bold text-blue-400 uppercase">mm</span>
                  </div>
                </div>
              </div>

              {/* Right Side: Actions */}
              <div className="flex items-center gap-2">
                <Dialog open={showRainfallDialog} onOpenChange={setShowRainfallDialog}>
                  <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-9 px-3 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-wider">
                      <Droplets className="h-3.5 w-3.5 mr-1.5" /> Registrar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[2rem]">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black italic">Registrar Chuva</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantidade (mm)</Label>
                        <Input 
                          type="number" 
                          value={newRainfall.mm} 
                          onChange={(e) => setNewRainfall({...newRainfall, mm: e.target.value})}
                          placeholder="Ex: 25" 
                          className="h-12 rounded-xl border-none bg-muted/50 text-xl font-black italic"
                        />
                      </div>
                      <Button onClick={handleAddRainfall} className="w-full h-12 rounded-xl bg-blue-600 text-white font-black italic uppercase">
                        Salvar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <ChevronRight className="h-4 w-4 text-blue-300 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NOVO: Ponto de Abate & Alertas do Curral (Substitui o gráfico duplicado de @ produzidas) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 rounded-xl shadow-sm border-border/50 overflow-hidden flex flex-col justify-between">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Target className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <span>Manejo & Ponto de Venda</span>
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">
                    Engorda para abate e ações pendentes no curral
                  </p>
                </div>
              </div>

              {/* Seletor de visualização */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
                <button
                  onClick={() => setCurralTab('abate')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                    curralTab === 'abate'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Coins className="h-3.5 w-3.5 text-emerald-600" />
                  Ponto de Venda
                </button>
                <button
                  onClick={() => setCurralTab('alertas')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                    curralTab === 'alertas'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <AlertTriangle className={`h-3.5 w-3.5 ${curralAlerts.totalCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  Alertas
                  {curralAlerts.totalCount > 0 && (
                    <span className="h-4 px-1.5 rounded-full bg-amber-500/20 text-amber-700 text-[10px] font-black">
                      {curralAlerts.totalCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4 flex-1 flex flex-col justify-between">
            {curralTab === 'abate' ? (
              <div className="space-y-4">
                {/* 3 Caixas do Funil de Engorda */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider block">
                      Prontos p/ Venda
                    </span>
                    <p className="text-2xl font-black text-emerald-700 mt-0.5 tabular-nums">
                      {slaughterFunnel.readyCount} <span className="text-xs font-normal">cab.</span>
                    </p>
                    <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                      ≥ 480 kg (16+ @)
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider block">
                      Terminação
                    </span>
                    <p className="text-2xl font-black text-amber-700 mt-0.5 tabular-nums">
                      {slaughterFunnel.near.length} <span className="text-xs font-normal">cab.</span>
                    </p>
                    <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
                      400 a 479 kg
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider block">
                      Em Recria
                    </span>
                    <p className="text-2xl font-black text-blue-700 mt-0.5 tabular-nums">
                      {slaughterFunnel.growing.length} <span className="text-xs font-normal">cab.</span>
                    </p>
                    <span className="text-[10px] text-blue-600 font-semibold block mt-0.5">
                      &lt; 400 kg
                    </span>
                  </div>
                </div>

                {/* Barra Proporcional de Engorda */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium text-muted-foreground">
                    <span>Distribuição de Peso do Rebanho</span>
                    <span>{slaughterFunnel.totalCount} cabeças ativas</span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
                    <div 
                      style={{ width: `${(slaughterFunnel.readyCount / (slaughterFunnel.totalCount || 1)) * 100}%` }} 
                      className="bg-emerald-500 transition-all" 
                      title="Prontos" 
                    />
                    <div 
                      style={{ width: `${(slaughterFunnel.near.length / (slaughterFunnel.totalCount || 1)) * 100}%` }} 
                      className="bg-amber-500 transition-all" 
                      title="Terminação" 
                    />
                    <div 
                      style={{ width: `${(slaughterFunnel.growing.length / (slaughterFunnel.totalCount || 1)) * 100}%` }} 
                      className="bg-blue-500 transition-all" 
                      title="Recria" 
                    />
                  </div>
                </div>

                {/* Destaque do Lote Pronto */}
                <div className="p-3 rounded-xl bg-muted/30 border border-muted/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">
                      <Beef className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {slaughterFunnel.readyCount > 0 
                          ? `Receita Estimada do Lote Pronto (${slaughterFunnel.readyCount} cab.)`
                          : "Animais Mais Pesados da Fazenda"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {slaughterFunnel.readyCount > 0 
                          ? `${slaughterFunnel.readyArrobas.toFixed(1)} @ líq. (50% RC) · R$ ${marketPrice.toFixed(2)}/@`
                          : "Acompanhe os bois mais próximos do ganho final"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-emerald-600">
                      R$ {slaughterFunnel.readyCount > 0 
                        ? slaughterFunnel.readyValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : ((((slaughterFunnel.topAnimals[0]?.weight || 0) * 0.50) / 15) * marketPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      {slaughterFunnel.readyCount > 0 ? "Venda Imediata" : "Top animal"}
                    </span>
                  </div>
                </div>

                {/* Lista Rápida dos Animais Prontos / Mais Pesados */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1 font-semibold">
                    <span>Animal (Brinco)</span>
                    <span className="text-right">Peso Atual · @ Líquida</span>
                  </div>
                  <div className="divide-y divide-border/50 border border-border/50 rounded-lg overflow-hidden">
                    {slaughterFunnel.topAnimals.map(a => {
                      const isReady = a.weight >= 480;
                      return (
                        <div 
                          key={a.id} 
                          onClick={() => navigate(`/animals/${a.id}`)}
                          className="flex items-center justify-between p-2.5 bg-card hover:bg-muted/40 cursor-pointer transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">Brinco #{a.tag}</span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {a.lote_id || "Sem Lote"} · {a.breed}
                            </span>
                            {isReady && (
                              <Badge className="bg-emerald-500/20 text-emerald-700 border-none text-[9px] font-black uppercase px-1.5 h-4">
                                Pronto
                              </Badge>
                            )}
                          </div>
                          <div className="text-right font-medium">
                            <span className="font-bold text-foreground">{a.weight} kg</span>
                            <span className="text-muted-foreground ml-1.5">({((a.weight * 0.50) / 15).toFixed(1)} @)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs font-bold text-primary hover:text-primary p-0 h-auto"
                    onClick={() => navigate("/simulator")}
                  >
                    Simular Venda no Simulador <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs font-semibold"
                    onClick={() => navigate("/animals")}
                  >
                    Ver Todos os Animais
                  </Button>
                </div>
              </div>
            ) : (
              /* Aba Alertas do Curral */
              <div className="space-y-4">
                {curralAlerts.totalCount === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-2">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <p className="font-bold text-sm text-foreground">Manejo em Dia!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Todos os animais foram pesados recentemente e não há toques pendentes.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Alerta de Pesagem */}
                    {curralAlerts.pendingWeighing.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Scale className="h-4 w-4 text-amber-600" />
                            <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                              {curralAlerts.pendingWeighing.length} animais sem pesagem há mais de 35 dias
                            </span>
                          </div>
                          <Button 
                            size="sm" 
                            className="h-7 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => navigate("/events/new?type=pesagem")}
                          >
                            Pesar Agora
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {curralAlerts.pendingWeighing.slice(0, 8).map(a => (
                            <span 
                              key={a.id}
                              onClick={() => navigate(`/animals/${a.id}`)}
                              className="px-2 py-0.5 rounded bg-background/80 text-[11px] font-bold text-foreground border border-amber-200 cursor-pointer hover:bg-background"
                            >
                              #{a.tag}
                            </span>
                          ))}
                          {curralAlerts.pendingWeighing.length > 8 && (
                            <span className="text-[11px] text-muted-foreground font-semibold self-center">
                              +{curralAlerts.pendingWeighing.length - 8} outros
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Alerta Reprodutivo */}
                    {curralAlerts.pendingTouch.length > 0 && (
                      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                            <div>
                              <p className="text-xs font-bold text-blue-900 dark:text-blue-300">
                                {curralAlerts.pendingTouch.length} fêmeas aguardando toque / diagnóstico
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Inseminações recentes sem confirmação de prenhez
                              </p>
                            </div>
                          </div>
                          <Button 
                            variant="outline"
                            size="sm" 
                            className="h-7 text-[11px] font-bold border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => navigate("/insemination")}
                          >
                            Ver Reprodução
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Mantenha o curral atualizado para cálculos precisos de GMD.</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs font-bold text-primary p-0 h-auto"
                    onClick={() => navigate("/events")}
                  >
                    Histórico de Manejo <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lotes Performance (Mantido no lado direito) */}
        <Card className="lg:col-span-3 rounded-xl shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>GMD Médio por Lote (kg/dia)</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lotPerformance.length === 0 ? (
              <div className="min-h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                Aguardando dados de ganho por lote.
              </div>
            ) : (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lotPerformance} layout="vertical" margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis type="number" fontSize={10} hide />
                    <YAxis dataKey="name" type="category" fontSize={11} width={80} tickLine={false} axisLine={false} />
                    <Tooltip 
                      formatter={(val: number) => [`${val} kg/dia`, 'GMD']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="gmd" fill="#3b82f6" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fill: '#666' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Estoque / Insumos */}
        <Card className="lg:col-span-4 rounded-xl shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Insumos & Nutrição Cadastrados</span>
              <Button variant="link" onClick={() => navigate("/ingredients")} className="text-xs p-0 h-auto">Ver Todos</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ingredients.length === 0 ? (
                <p className="text-xs text-center py-4 text-muted-foreground">Nenhum insumo cadastrado.</p>
              ) : (
                ingredients.slice(0, 5).map(ing => (
                  <div key={ing.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-muted/50">
                    <div>
                      <p className="font-bold text-sm leading-none">{ing.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Estoque/Uso Ativo</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-primary text-sm">R$ {ing.cost_per_kg.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">por kg</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Categoria Distribution */}
        <Card className="lg:col-span-3 rounded-xl shadow-sm border-border/50">
           <CardHeader>
              <CardTitle className="text-base font-bold">Composição do Rebanho</CardTitle>
           </CardHeader>
           <CardContent className="flex flex-col items-center justify-center">
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

      {/* Gastos Mensais */}
      <Card className="rounded-2xl shadow-xl border-none bg-slate-900 text-white overflow-hidden">
        <CardHeader className="bg-slate-800/50 border-b border-white/5 pb-4">
          <CardTitle className="text-lg font-black italic uppercase tracking-wider flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-rose-500" />
              Fluxo de Gastos Anual ({new Date().getFullYear()})
            </div>
            <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">Jan - Dez</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {monthlyConsolidated.map((item, i) => {
              const hasValue = item.total > 0;
              return (
                <div 
                  key={i} 
                  className={`p-5 border-b border-r border-white/5 transition-all hover:bg-white/5 group relative ${!hasValue ? 'opacity-40' : ''}`}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-rose-400 transition-colors">
                      {formatMonthName(item.month)}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-rose-500 font-bold">R$</span>
                      <span className="text-2xl font-black italic tracking-tighter">
                        {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      {item.count} {item.count === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
