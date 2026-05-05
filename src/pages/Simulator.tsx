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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  saleMethod: string;
  targetMargin: number;
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
    yieldPct: "",
    saleMethod: "arroba",
    targetMargin: ""
  });

  // Carregar cotação do mercado atual se possível
  useEffect(() => {
    store.getSettings().then(settings => {
      if (Array.isArray(settings)) {
        const price = settings.find(s => s.key === 'preco_arroba_pi')?.value;
        if (price && !form.expectedSalePrice) {
          setForm(prev => ({ ...prev, expectedSalePrice: price }));
        }
      }
    }).catch(err => console.error("Error loading settings:", err));

    const saved = localStorage.getItem("bovi_simulations");
    if (saved) {
      try {
        setSavedSimulations(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveSimulation = () => {
    const newSim: SavedSimulation = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
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
      saleMethod: form.saleMethod,
      targetMargin: Number(form.targetMargin) || 0,
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
      yieldPct: sim.yieldPct.toString(),
      saleMethod: sim.saleMethod || "arroba",
      targetMargin: (sim.targetMargin || "").toString()
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
    const yieldPct = Number(form.yieldPct) || 50;
    const targetMargin = Number(form.targetMargin) || 0;

    const yieldDecimal = yieldPct / 100;
    
    // Pesos
    const totalGainKg = expectedGMD * days;
    const finalWeight = initialWeight + totalGainKg;
    const finalArroba = (finalWeight * yieldDecimal) / 15;
    const finalCarcassKg = finalWeight * yieldDecimal;

    // Investimentos e Custos
    const totalPurchase = quantity * purchasePricePerHead;
    const totalMaintenance = (quantity * days * dailyCost) + extraCost;
    const totalInvestment = totalPurchase + totalMaintenance;

    // Receita e Lucro baseados no método
    let grossRevenue = 0;
    let unitsPerHead = 0;
    let unitLabel = "";

    switch (form.saleMethod) {
      case "kg_vivo":
        unitsPerHead = finalWeight;
        grossRevenue = quantity * finalWeight * expectedSalePrice;
        unitLabel = "Kg Vivo";
        break;
      case "kg_carcaca":
        unitsPerHead = finalCarcassKg;
        grossRevenue = quantity * finalCarcassKg * expectedSalePrice;
        unitLabel = "Kg Carcaça";
        break;
      default: // arroba
        unitsPerHead = finalArroba;
        grossRevenue = quantity * finalArroba * expectedSalePrice;
        unitLabel = "Arroba (@)";
    }

    const netProfit = grossRevenue - totalInvestment;
    const profitPerHead = quantity > 0 ? netProfit / quantity : 0;
    
    // Indicadores
    const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;
    const breakevenPrice = (quantity > 0 && unitsPerHead > 0) ? (totalInvestment / quantity) / unitsPerHead : 0;

    // Preço Sugerido para Margem Alvo
    const suggestedPrice = (targetMargin > 0 && quantity > 0 && unitsPerHead > 0) 
      ? (totalInvestment * (1 + targetMargin / 100) / quantity) / unitsPerHead 
      : 0;

    return {
      finalWeight,
      finalArroba,
      finalCarcassKg,
      totalPurchase,
      totalMaintenance,
      totalInvestment,
      grossRevenue,
      netProfit,
      profitPerHead,
      roi,
      breakevenPrice,
      suggestedPrice,
      unitLabel,
      unitsPerHead
    };
  }, [form]);

  const isProfitable = results.netProfit >= 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 pb-24 animate-fade-in space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> Simulador de Engorda
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Projete lucros e custos antes de comprar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} className="font-bold border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
            <Save className="h-4 w-4 mr-2" /> Baixar Relatório
          </Button>
          <Button variant="outline" onClick={() => setShowSaved(!showSaved)} className="font-bold border-primary/20 bg-primary/5">
            <History className="h-4 w-4 mr-2" /> {showSaved ? "Voltar ao Simulador" : "Histórico"}
          </Button>
        </div>
      </div>

      {showSaved ? (
        <Card className="border-none shadow-xl bg-card rounded-2xl animate-in slide-in-from-right-4 print:hidden">
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
        <>
          <div className="grid lg:grid-cols-12 gap-6 items-start print:hidden">
            
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
                        <Input type="number" placeholder="100" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="h-11 font-black" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground">Peso Inicial (kg)</Label>
                        <Input type="number" placeholder="350" value={form.initialWeight} onChange={e => setForm({...form, initialWeight: e.target.value})} className="h-11 font-black" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground">Valor por Cabeça</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>
                          <Input type="number" placeholder="2800" value={form.purchasePricePerHead} onChange={e => setForm({...form, purchasePricePerHead: e.target.value})} className="h-11 font-black pl-8" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground">Rendimento (%)</Label>
                        <Input type="number" placeholder="50" value={form.yieldPct} onChange={e => setForm({...form, yieldPct: e.target.value})} className="h-11 font-black" />
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
                        <Input type="number" step="0.1" placeholder="0.8" value={form.expectedGMD} onChange={e => setForm({...form, expectedGMD: e.target.value})} className="h-11 font-black" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground">Ciclo (Dias)</Label>
                        <Input type="number" placeholder="120" value={form.days} onChange={e => setForm({...form, days: e.target.value})} className="h-11 font-black" />
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
                          <Input type="number" step="0.5" placeholder="15" value={form.dailyCost} onChange={e => setForm({...form, dailyCost: e.target.value})} className="h-11 font-black pl-8" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground">Custos Extras (Total)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>
                          <Input type="number" placeholder="0" value={form.extraCost} onChange={e => setForm({...form, extraCost: e.target.value})} className="h-11 font-black pl-8" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Método de Venda</Label>
                          <Select value={form.saleMethod} onValueChange={v => setForm({...form, saleMethod: v})}>
                            <SelectTrigger className="h-11 font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="arroba">Por Arroba (@)</SelectItem>
                              <SelectItem value="kg_vivo">Por Kg Vivo</SelectItem>
                              <SelectItem value="kg_carcaca">Por Kg Carcaça</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground">Margem Alvo (%)</Label>
                          <Input type="number" placeholder="Ex: 20" value={form.targetMargin} onChange={e => setForm({...form, targetMargin: e.target.value})} className="h-11 font-black" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
                          Preço de Venda Esperado (Por {results.unitLabel})
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-sm">R$</span>
                          <Input type="number" value={form.expectedSalePrice} onChange={e => setForm({...form, expectedSalePrice: e.target.value})} className="h-14 text-2xl font-black pl-9 border-emerald-500/30 bg-emerald-500/5 focus-visible:ring-emerald-500" />
                        </div>
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
                      <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground">Projeção de Saída</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-muted-foreground">Peso Final (Vivo)</span>
                        <span className="font-black">{results.finalWeight.toFixed(1)} kg</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-muted-foreground">Rendimento Carcaça</span>
                        <span className="font-black">{results.finalCarcassKg.toFixed(1)} kg</span>
                      </div>
                      <div className="flex justify-between items-center bg-primary/5 p-2 rounded-lg">
                        <span className="text-xs font-black uppercase">Peso em @</span>
                        <span className="font-black text-primary text-lg">{results.finalArroba.toFixed(2)} @</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-card rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3 border-b pb-2">
                      <DollarSign className="h-4 w-4 text-orange-500" />
                      <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground">Resumo Financeiro</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-muted-foreground">Investimento Total</span>
                        <span className="font-black text-orange-700">R$ {results.totalInvestment.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-muted-foreground">Receita Bruta</span>
                        <span className="font-black text-emerald-600">R$ {results.grossRevenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-100 p-2 rounded-lg">
                        <span className="text-[10px] font-black uppercase text-slate-500">Custo Total / Cab</span>
                        <span className="font-black text-slate-700">R$ {(results.totalInvestment / (Number(form.quantity) || 1)).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ANALISE DE PREÇO */}
                <Card className="border-none shadow-lg bg-slate-900 text-white rounded-xl sm:col-span-2">
                  <CardContent className="p-5">
                    <div className="grid sm:grid-cols-2 gap-8 items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Activity className="h-4 w-4 text-blue-400" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ponto de Equilíbrio</p>
                        </div>
                        <p className="text-2xl font-black italic text-blue-400">
                          R$ {results.breakevenPrice.toFixed(2)} <span className="text-xs not-italic text-slate-500">/ {results.unitLabel}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">Preço necessário para cobrir todos os custos.</p>
                      </div>

                      {results.suggestedPrice > 0 && (
                        <div className="border-l border-white/10 pl-8 animate-in slide-in-from-right-4">
                          <div className="flex items-center gap-2 mb-1">
                            <ArrowRight className="h-4 w-4 text-emerald-400" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preço p/ Margem Alvo ({form.targetMargin}%)</p>
                          </div>
                          <p className="text-2xl font-black italic text-emerald-400">
                            R$ {results.suggestedPrice.toFixed(2)} <span className="text-xs not-italic text-slate-500">/ {results.unitLabel}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">Valor ideal de venda para atingir seu objetivo.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>
          </div>

          {/* SEÇÃO DE RELATÓRIO (APENAS PARA IMPRESSÃO) */}
          <div className="hidden print:block bg-white p-10 space-y-8">
            <div className="flex justify-between items-start border-b-2 border-primary pb-6">
              <div>
                <h1 className="text-4xl font-black tracking-tighter text-primary">{form.name}</h1>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mt-1">Relatório de Projeção de Engorda</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-slate-400 uppercase">Data do Relatório</p>
                <p className="text-lg font-black">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qtd. Animais</p>
                <p className="text-xl font-black">{form.quantity || 0} cabeças</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso Inicial Médio</p>
                <p className="text-xl font-black">{form.initialWeight || 0} kg</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ciclo Estimado</p>
                <p className="text-xl font-black">{form.days || 0} dias</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
              <div className="grid grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase text-primary tracking-widest border-b pb-2">Investimento e Custos</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-bold">Aquisição do Lote</span>
                      <span className="font-black">R$ {results.totalPurchase.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-bold">Custo de Manutenção</span>
                      <span className="font-black">R$ {results.totalMaintenance.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex justify-between text-lg border-t pt-2 mt-2">
                      <span className="font-black text-slate-900">INVESTIMENTO TOTAL</span>
                      <span className="font-black text-slate-900">R$ {results.totalInvestment.toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase text-emerald-600 tracking-widest border-b pb-2">Resultado Projetado</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-bold">Faturamento Estimado</span>
                      <span className="font-black">R$ {results.grossRevenue.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-bold">Lucro por Cabeça</span>
                      <span className="font-black">R$ {results.profitPerHead.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex justify-between text-2xl border-t pt-2 mt-2">
                      <span className="font-black text-emerald-600">LUCRO LÍQUIDO</span>
                      <span className="font-black text-emerald-600">R$ {results.netProfit.toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="border-2 border-blue-100 rounded-2xl p-6">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Ponto de Equilíbrio</p>
                <p className="text-3xl font-black text-blue-600">R$ {results.breakevenPrice.toFixed(2)} <span className="text-sm font-bold text-blue-300">/ {results.unitLabel}</span></p>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">Este é o valor mínimo de venda para cobrir todos os custos da operação.</p>
              </div>
              <div className="border-2 border-emerald-100 rounded-2xl p-6">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Rentabilidade (ROI)</p>
                <p className="text-3xl font-black text-emerald-600">{results.roi.toFixed(1)}%</p>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">Retorno sobre o capital total investido no ciclo.</p>
              </div>
            </div>

            <div className="pt-12 border-t border-slate-100 flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Plataforma</p>
                <p className="text-sm font-black text-slate-400">Fazenda Control - Gestão Pecuária Inteligente</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-300 italic font-medium">Simulação baseada em GMD de {form.expectedGMD}kg e rendimento de {Number(form.yieldPct) || 50}%</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
