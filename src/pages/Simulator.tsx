import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Calculator, 
  Save, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Scale, 
  Calendar, 
  History,
  Trash2,
  ChevronRight,
  Activity,
  ArrowRight
} from "lucide-react";
import { store } from "@/lib/store";

interface SavedSimulation {
  id: string;
  date: string;
  name: string;
  quantity: number;
  initialWeight: number;
  purchasePricePerHead: number;
  expectedGMD: number;
  days: number;
  dailyCost: number;
  extraCost: number;
  expectedSalePrice: number;
  yieldPct: number;
  netProfit: number;
  roi: number;
}

export default function Simulator() {
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  const [form, setForm] = useState({
    name: "Nova Simulação",
    quantity: "",
    initialWeight: "",
    purchasePricePerHead: "",
    expectedGMD: "",
    days: "",
    dailyCost: "",
    extraCost: "",
    expectedSalePrice: "",
    yieldPct: ""
  });

  // Carregar cotação do mercado atual se possível
  useEffect(() => {
    store.getSettings().then(settings => {
      const price = settings.find(s => s.key === 'preco_arroba_pi')?.value;
      if (price) {
        setForm(prev => ({ ...prev, expectedSalePrice: price }));
      }
    });

    const saved = localStorage.getItem("bovi_simulations");
    if (saved) {
      try {
        setSavedSimulations(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveSimulation = () => {
    const newSim: SavedSimulation = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      name: form.name,
      quantity: Number(form.quantity) || 0,
      initialWeight: Number(form.initialWeight) || 0,
      purchasePricePerHead: Number(form.purchasePricePerHead) || 0,
      expectedGMD: Number(form.expectedGMD) || 0,
      days: Number(form.days) || 0,
      dailyCost: Number(form.dailyCost) || 0,
      extraCost: Number(form.extraCost) || 0,
      expectedSalePrice: Number(form.expectedSalePrice) || 0,
      yieldPct: Number(form.yieldPct) || 0,
      netProfit: results.netProfit,
      roi: results.roi
    };
    const updated = [newSim, ...savedSimulations].slice(0, 20); // Keep last 20
    setSavedSimulations(updated);
    localStorage.setItem("bovi_simulations", JSON.stringify(updated));
    toast.success("Simulação salva com sucesso!");
    setForm(prev => ({ ...prev, name: `Simulação ${updated.length + 1}` }));
  };

  const deleteSimulation = (id: string) => {
    const updated = savedSimulations.filter(s => s.id !== id);
    setSavedSimulations(updated);
    localStorage.setItem("bovi_simulations", JSON.stringify(updated));
    toast.success("Simulação excluída");
  };

  const loadSimulation = (sim: SavedSimulation) => {
    setForm({
      name: sim.name,
      quantity: sim.quantity.toString(),
      initialWeight: sim.initialWeight.toString(),
      purchasePricePerHead: sim.purchasePricePerHead.toString(),
      expectedGMD: sim.expectedGMD.toString(),
      days: sim.days.toString(),
      dailyCost: sim.dailyCost.toString(),
      extraCost: sim.extraCost.toString(),
      expectedSalePrice: sim.expectedSalePrice.toString(),
      yieldPct: sim.yieldPct.toString()
    });
    setShowSaved(false);
    toast.success("Simulação carregada");
  };

  const results = useMemo(() => {
    const quantity = Number(form.quantity) || 0;
    const initialWeight = Number(form.initialWeight) || 0;
    const purchasePricePerHead = Number(form.purchasePricePerHead) || 0;
    const expectedGMD = Number(form.expectedGMD) || 0;
    const days = Number(form.days) || 0;
    const dailyCost = Number(form.dailyCost) || 0;
    const extraCost = Number(form.extraCost) || 0;
    const expectedSalePrice = Number(form.expectedSalePrice) || 0;
    const yieldPct = Number(form.yieldPct) || 0;

    const yieldDecimal = yieldPct / 100;
    
    // Peso inicial em @
    const initialArroba = (initialWeight * yieldDecimal) / 15;
    
    // Peso Final
    const totalGainKg = expectedGMD * days;
    const finalWeight = initialWeight + totalGainKg;
    const finalArroba = (finalWeight * yieldDecimal) / 15;

    // Valor pago por @ inicial
    const paidPerArroba = initialArroba > 0 ? purchasePricePerHead / initialArroba : 0;

    // Investimentos e Custos
    const totalPurchase = quantity * purchasePricePerHead;
    const totalMaintenance = (quantity * days * dailyCost) + extraCost;
    const totalInvestment = totalPurchase + totalMaintenance;

    // Receita e Lucro
    const grossRevenue = quantity * finalArroba * expectedSalePrice;
    const netProfit = grossRevenue - totalInvestment;
    const profitPerHead = quantity > 0 ? netProfit / quantity : 0;
    
    // Indicadores
    const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;
    const totalProducedArrobas = quantity * ((totalGainKg * yieldDecimal) / 15);
    const breakevenPrice = quantity > 0 && finalArroba > 0 ? (totalInvestment / quantity) / finalArroba : 0;

    return {
      initialArroba,
      finalWeight,
      finalArroba,
      paidPerArroba,
      totalPurchase,
      totalMaintenance,
      totalInvestment,
      grossRevenue,
      netProfit,
      profitPerHead,
      roi,
      totalProducedArrobas,
      breakevenPrice
    };
  }, [form]);

  const isProfitable = results.netProfit >= 0;

  return (
    <div className="p-4 pb-24 animate-fade-in space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> Simulador de Engorda
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Projete lucros e custos antes de comprar</p>
        </div>
        <Button variant="outline" onClick={() => setShowSaved(!showSaved)} className="font-bold border-primary/20 bg-primary/5">
          <History className="h-4 w-4 mr-2" /> {showSaved ? "Voltar ao Simulador" : "Histórico"}
        </Button>
      </div>

      {showSaved ? (
        <Card className="border-none shadow-xl bg-card rounded-2xl animate-in slide-in-from-right-4">
          <CardHeader>
            <CardTitle>Simulações Salvas</CardTitle>
          </CardHeader>
          <CardContent>
            {savedSimulations.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground italic">Nenhuma simulação salva ainda.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {savedSimulations.map(sim => (
                  <div key={sim.id} className="bg-muted/30 border border-muted/60 p-4 rounded-xl relative group">
                    <button 
                      onClick={() => deleteSimulation(sim.id)}
                      className="absolute top-2 right-2 p-1.5 text-destructive bg-destructive/10 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <p className="font-bold text-sm mb-1">{sim.name}</p>
                    <p className="text-[10px] text-muted-foreground font-black uppercase mb-3">{new Date(sim.date).toLocaleDateString()}</p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Lucro Líquido</p>
                        <p className={`font-black text-lg ${sim.netProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                          R$ {sim.netProfit.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" className="h-8 text-[10px] font-bold" onClick={() => loadSimulation(sim)}>
                        Carregar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          
          {/* LADO ESQUERDO: CONTROLES */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-none shadow-xl bg-card rounded-2xl overflow-hidden">
              <div className="bg-primary/5 p-4 border-b border-primary/10 flex items-center justify-between">
                <Input 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})} 
                  className="h-10 text-lg font-black bg-white/50 border-primary/20 w-[60%]"
                />
                <Button onClick={saveSimulation} className="font-bold shadow-md bg-primary hover:bg-primary/90">
                  <Save className="h-4 w-4 mr-2" /> Salvar
                </Button>
              </div>
              <CardContent className="p-5 space-y-5">
                
                <div className="space-y-4 border-b pb-5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Scale className="h-4 w-4" /> 1. Parâmetros do Lote
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Qtd. Animais</Label>
                      <Input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="h-11 font-black" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Peso Inicial (kg)</Label>
                      <Input type="number" value={form.initialWeight} onChange={e => setForm({...form, initialWeight: e.target.value})} className="h-11 font-black" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Valor por Cabeça</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>
                        <Input type="number" value={form.purchasePricePerHead} onChange={e => setForm({...form, purchasePricePerHead: e.target.value})} className="h-11 font-black pl-8" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Rendimento (%)</Label>
                      <Input type="number" value={form.yieldPct} onChange={e => setForm({...form, yieldPct: e.target.value})} className="h-11 font-black" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-b pb-5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" /> 2. Desempenho
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">GMD Esperado (kg)</Label>
                      <Input type="number" step="0.1" value={form.expectedGMD} onChange={e => setForm({...form, expectedGMD: e.target.value})} className="h-11 font-black" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Ciclo (Dias)</Label>
                      <Input type="number" value={form.days} onChange={e => setForm({...form, days: e.target.value})} className="h-11 font-black" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> 3. Custos e Venda
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Custo Diária (R$/cab)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>
                        <Input type="number" step="0.5" value={form.dailyCost} onChange={e => setForm({...form, dailyCost: e.target.value})} className="h-11 font-black pl-8" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Custos Extras (Total)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>
                        <Input type="number" value={form.extraCost} onChange={e => setForm({...form, extraCost: e.target.value})} className="h-11 font-black pl-8" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Preço da @ de Venda (Futuro)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-sm">R$</span>
                      <Input type="number" value={form.expectedSalePrice} onChange={e => setForm({...form, expectedSalePrice: e.target.value})} className="h-14 text-2xl font-black pl-9 border-emerald-500/30 bg-emerald-500/5 focus-visible:ring-emerald-500" />
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* LADO DIREITO: RESULTADOS */}
          <div className="lg:col-span-7 space-y-4">
            
            <Card className={`border-none shadow-xl rounded-2xl overflow-hidden transition-colors duration-500 ${isProfitable ? 'bg-emerald-500' : 'bg-destructive'}`}>
              <CardContent className="p-6 text-white relative">
                <div className="absolute top-0 right-0 p-6 opacity-20">
                  {isProfitable ? <TrendingUp className="h-32 w-32" /> : <TrendingDown className="h-32 w-32" />}
                </div>
                <div className="relative z-10">
                  <Badge className="bg-white/20 text-white hover:bg-white/30 border-none font-black uppercase tracking-widest mb-4">
                    Resultado Projetado
                  </Badge>
                  <p className="text-sm font-bold uppercase tracking-wider opacity-90 mb-1">Lucro Líquido Estimado</p>
                  <h2 className="text-5xl font-black italic tracking-tighter mb-4 drop-shadow-sm">
                    R$ {results.netProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mt-6 border-t border-white/20 pt-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-0.5">Rentabilidade (ROI)</p>
                      <p className="text-2xl font-black">{results.roi.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-0.5">Lucro por Cabeça</p>
                      <p className="text-2xl font-black">R$ {results.profitPerHead.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="border-none shadow-lg bg-card rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3 border-b pb-2">
                    <Scale className="h-4 w-4 text-primary" />
                    <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground">Projeção de Peso</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground">Peso Inicial</span>
                      <span className="font-black">{results.initialArroba.toFixed(1)} @ <span className="text-muted-foreground/50 text-[10px]">({form.initialWeight}kg)</span></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground">Ganho no Ciclo</span>
                      <span className="font-black text-emerald-600">+{((form.expectedGMD * form.days * (form.yieldPct/100)) / 15).toFixed(1)} @ <span className="text-muted-foreground/50 text-[10px]">+{(form.expectedGMD * form.days).toFixed(0)}kg</span></span>
                    </div>
                    <div className="flex justify-between items-center bg-primary/5 p-2 rounded-lg">
                      <span className="text-xs font-black uppercase">Peso Final/Cab</span>
                      <span className="font-black text-primary text-lg">{results.finalArroba.toFixed(1)} @ <span className="text-muted-foreground/50 text-[10px] font-bold">({results.finalWeight.toFixed(0)}kg)</span></span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg bg-card rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3 border-b pb-2">
                    <DollarSign className="h-4 w-4 text-orange-500" />
                    <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground">Estrutura de Custos</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground">Aquisição Gado</span>
                      <span className="font-black">R$ {results.totalPurchase.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/30 px-2 py-1 -mx-2 rounded border border-muted/50">
                      <span className="text-[10px] font-black uppercase text-muted-foreground">Valor pago por @</span>
                      <span className="font-black text-xs">R$ {results.paidPerArroba.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground">Alimentação/Trato</span>
                      <span className="font-black text-orange-600">R$ {(form.quantity * form.days * form.dailyCost).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground">Custos Extras</span>
                      <span className="font-black">R$ {form.extraCost.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between items-center bg-orange-500/5 p-2 rounded-lg">
                      <span className="text-xs font-black uppercase text-orange-700">Total Investido</span>
                      <span className="font-black text-orange-700 text-lg">R$ {results.totalInvestment.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg bg-slate-900 text-white rounded-xl sm:col-span-2">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-blue-400" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ponto de Equilíbrio (Break-even)</p>
                    </div>
                    <p className="text-xs text-slate-300 font-medium max-w-xs">Preço mínimo que a Arroba precisa ser vendida no final do ciclo para não dar prejuízo (pagar todos os custos).</p>
                  </div>
                  <div className="text-right bg-white/10 px-6 py-3 rounded-xl border border-white/10">
                    <p className="text-2xl font-black italic text-blue-400">
                      R$ {results.breakevenPrice.toFixed(2)}
                    </p>
                    <p className="text-[9px] uppercase font-bold text-slate-400">Por Arroba</p>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
