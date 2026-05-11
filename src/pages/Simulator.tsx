import { useState, useMemo, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
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
  Activity,
  Download,
  Loader2,
  Wheat
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { store, Ration } from "@/lib/store";

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
  netProfit: number;
  roi: number;
}

export default function Simulator() {
  const [showSaved, setShowSaved] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([]);
  const [rations, setRations] = useState<Ration[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    name: "Nova Simulação",
    quantity: "",
    initialWeight: "",
    purchasePricePerHead: "",
    expectedGMD: "",
    days: "",
    dailyCost: "",
    costMethod: "manual", // 'manual' ou 'ration'
    rationId: "none",
    consumptionKg: "2.0",
    extraCost: "",
    expectedSalePrice: "",
    yieldPct: "54",
    saleMethod: "arroba",
    targetMargin: ""
  });

  // Carregar dados iniciais
  useEffect(() => {
    // 1. Carregar preço do mercado das configurações
    store.getSettings().then(settings => {
      if (Array.isArray(settings)) {
        const price = settings.find(s => s.key === 'preco_arroba_pi')?.value;
        if (price && !form.expectedSalePrice) {
          setForm(prev => ({ ...prev, expectedSalePrice: price }));
        }
      }
    }).catch(err => console.error("Error loading settings:", err));

    // 2. Carregar histórico do localStorage
    const saved = localStorage.getItem("bovi_simulations");
    if (saved) {
      try {
        setSavedSimulations(JSON.parse(saved));
      } catch (e) { }
    }

    // 3. Carregar Rações
    store.getRations().then(data => setRations(data || []));
  }, []);

  const results = useMemo(() => {
    const quantity = Number(form.quantity) || 0;
    const initialWeight = Number(form.initialWeight) || 0;
    const purchasePricePerHead = Number(form.purchasePricePerHead) || 0;
    const expectedGMD = Number(form.expectedGMD) || 0;
    const days = Number(form.days) || 0;
    const manualDailyCost = Number(form.dailyCost) || 0;
    const consumptionKg = Number(form.consumptionKg) || 0;
    const extraCost = Number(form.extraCost) || 0;

    // Cálculo do custo diário efetivo
    let effectiveDailyCost = manualDailyCost;
    if (form.costMethod === 'ration' && form.rationId !== 'none') {
      const selectedRation = rations.find(r => r.id === form.rationId);
      if (selectedRation) {
        effectiveDailyCost = selectedRation.cost_per_kg * consumptionKg;
      }
    }

    const expectedSalePrice = Number(form.expectedSalePrice) || 0;
    const yieldPct = Number(form.yieldPct) || 54;
    const targetMargin = Number(form.targetMargin) || 0;

    const yieldDecimal = yieldPct / 100;

    // 1. Ganho de Peso Total
    const totalGainKg = expectedGMD * days;

    // 2. Peso Final (Kg Vivo)
    const finalWeight = initialWeight + totalGainKg;

    // 3. Conversão para Arroba (@) - Lógica de Pecuarista
    const arrobasIniciais = (initialWeight * 0.50) / 15; // Estimativa boi magro (50%)
    const finalCarcassKg = finalWeight * yieldDecimal;
    const arrobasFinais = finalCarcassKg / 15;
    const arrobasProduzidas = arrobasFinais - arrobasIniciais;

    // 4. Custos
    const totalPurchase = quantity * purchasePricePerHead;
    const totalFeeding = quantity * days * effectiveDailyCost; 
    const totalMaintenance = totalFeeding + extraCost;
    const totalInvestment = totalPurchase + totalMaintenance;

    // 5. Receita
    let grossRevenue = 0;
    let unitsPerHead = 0;
    let unitLabel = "";

    switch (form.saleMethod) {
      case "kg_vivo":
        unitsPerHead = finalWeight;
        grossRevenue = quantity * finalWeight * expectedSalePrice;
        unitLabel = "Kg Vivo";
        break;
      default: // arroba
        unitsPerHead = arrobasFinais;
        grossRevenue = quantity * arrobasFinais * expectedSalePrice;
        unitLabel = "Arroba (@)";
    }

    const netProfit = grossRevenue - totalInvestment;
    const profitPerHead = quantity > 0 ? netProfit / quantity : 0;
    const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;
    const breakevenPrice = (quantity > 0 && unitsPerHead > 0) ? (totalInvestment / quantity) / unitsPerHead : 0;

    return {
      totalGainKg,
      finalWeight,
      finalArroba: arrobasFinais,
      finalCarcassKg,
      totalPurchase,
      totalMaintenance,
      totalInvestment,
      grossRevenue,
      netProfit,
      profitPerHead,
      roi,
      breakevenPrice,
      unitLabel,
      unitsPerHead,
      totalFeeding,
      feedingPerHead: days * effectiveDailyCost,
      producedArrobasPerHead: arrobasProduzidas,
      costPerProducedArroba: (arrobasProduzidas > 0 && quantity > 0) 
        ? ((totalFeeding + extraCost) / quantity) / arrobasProduzidas 
        : 0
    };
  }, [form]);

  const saveSimulation = () => {
    const newSim: SavedSimulation = {
      id: Math.random().toString(36).substring(2),
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
      netProfit: results.netProfit,
      roi: results.roi
    };
    const updated = [newSim, ...savedSimulations].slice(0, 20);
    setSavedSimulations(updated);
    localStorage.setItem("bovi_simulations", JSON.stringify(updated));
    toast.success("Simulação salva com sucesso!");
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
      targetMargin: ""
    });
    setShowSaved(false);
    toast.success("Simulação carregada");
  };

  const isProfitable = results.netProfit >= 0;

  return (
    <div className="p-4 pb-24 animate-fade-in space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> Simulador de Engorda
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Projete lucros de forma simples e rápida</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSaved(!showSaved)} className="font-bold border-primary/20 bg-primary/5">
            <History className="h-4 w-4 mr-2" /> {showSaved ? "Voltar" : "Histórico"}
          </Button>
        </div>
      </div>

      {showSaved ? (
        <Card className="border shadow-sm rounded-xl">
          <CardContent className="p-6">
            {savedSimulations.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground italic">Nenhuma simulação salva.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {savedSimulations.map(sim => (
                  <div key={sim.id} className="bg-muted/30 border p-4 rounded-xl relative group">
                    <button onClick={() => deleteSimulation(sim.id)} className="absolute top-2 right-2 p-1 text-destructive opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
                    <p className="font-bold text-sm">{sim.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black mb-3">{new Date(sim.date).toLocaleDateString()}</p>
                    <div className="flex justify-between items-end">
                      <p className={`font-black text-lg ${sim.netProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>R$ {sim.netProfit.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
                      <Button size="sm" variant="secondary" className="h-8 text-[10px] font-bold" onClick={() => loadSimulation(sim)}>Carregar</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6 items-start">

          {/* LADO ESQUERDO: ENTRADAS */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border shadow-sm rounded-xl overflow-hidden">
              <div className="bg-muted/30 p-3 border-b flex items-center justify-between">
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9 font-bold bg-transparent border-none focus-visible:ring-0 w-[60%]" />
                <Button onClick={saveSimulation} size="sm" className="font-bold"><Save className="h-4 w-4 mr-2" /> Salvar</Button>
              </div>
              <CardContent className="p-5 space-y-6">

                <div className="space-y-4 border-b pb-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Scale className="h-4 w-4" /> 1. Compra</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Qtd. Animais</Label>
                      <Input type="number" placeholder="100" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="h-10 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Preço/Cabeça (R$)</Label>
                      <Input type="number" placeholder="2800" value={form.purchasePricePerHead} onChange={e => setForm({ ...form, purchasePricePerHead: e.target.value })} className="h-10 font-bold" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Peso Médio na Compra (kg)</Label>
                      <Input type="number" placeholder="350" value={form.initialWeight} onChange={e => setForm({ ...form, initialWeight: e.target.value })} className="h-10 font-bold" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-b pb-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Activity className="h-4 w-4" /> 2. Engorda e Alimentação</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Ganho Diário (GMD)</Label>
                      <Input type="number" step="0.1" value={form.expectedGMD} onChange={e => setForm({ ...form, expectedGMD: e.target.value })} className="h-10 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Tempo (Dias)</Label>
                      <Input type="number" value={form.days} onChange={e => setForm({ ...form, days: e.target.value })} className="h-10 font-bold" />
                    </div>

                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Método de Custo</Label>
                      <Select value={form.costMethod} onValueChange={v => setForm({ ...form, costMethod: v })}>
                        <SelectTrigger className="h-10 font-bold text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Custo Diário Manual (R$)</SelectItem>
                          <SelectItem value="ration">Usar Ração Cadastrada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {form.costMethod === 'manual' ? (
                      <div className="col-span-2 space-y-1.5 animate-in fade-in zoom-in duration-300">
                        <Label className="text-[11px] font-bold text-muted-foreground">Custo da Diária (R$/animal)</Label>
                        <Input type="number" step="0.1" value={form.dailyCost} onChange={e => setForm({ ...form, dailyCost: e.target.value })} className="h-10 font-bold" />
                      </div>
                    ) : (
                      <div className="col-span-2 grid grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-bold text-muted-foreground">Escolher Ração</Label>
                          <Select value={form.rationId} onValueChange={v => setForm({ ...form, rationId: v })}>
                            <SelectTrigger className="h-10 font-bold text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Selecione...</SelectItem>
                              {rations.map(r => (
                                <SelectItem key={r.id} value={r.id}>{r.name} (R$ {r.cost_per_kg.toFixed(2)}/kg)</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-bold text-muted-foreground">Consumo (kg/dia)</Label>
                          <Input type="number" step="0.5" value={form.consumptionKg} onChange={e => setForm({ ...form, consumptionKg: e.target.value })} className="h-10 font-bold" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><DollarSign className="h-4 w-4" /> 3. Venda</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Rendimento (%)</Label>
                      <Input type="number" value={form.yieldPct} onChange={e => setForm({ ...form, yieldPct: e.target.value })} className="h-10 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Método</Label>
                      <Select value={form.saleMethod} onValueChange={v => setForm({ ...form, saleMethod: v })}>
                        <SelectTrigger className="h-10 font-bold text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="arroba">Por Arroba (@)</SelectItem>
                          <SelectItem value="kg_vivo">Kg Vivo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Label className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">Preço de Venda Esperado (Por {results.unitLabel})</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">R$</span>
                      <Input type="number" value={form.expectedSalePrice} onChange={e => setForm({ ...form, expectedSalePrice: e.target.value })} className="h-12 text-2xl font-black pl-9 border-emerald-500/30 bg-emerald-500/5" />
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* LADO DIREITO: RESULTADOS */}
          <div className="lg:col-span-7 space-y-4">

            <Card className={`border shadow-sm rounded-xl overflow-hidden transition-all ${isProfitable ? 'bg-emerald-600' : 'bg-destructive'}`}>
              <CardContent className="p-8 text-white">
                <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Lucro Líquido Estimado</p>
                <h2 className="text-6xl font-black italic tracking-tighter mb-4">
                  R$ {results.netProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 border-t border-white/20 pt-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Retorno (ROI)</p>
                    <p className="text-xl font-black">{results.roi.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Lucro/Cabeça</p>
                    <p className="text-xl font-black text-white">R$ {results.profitPerHead.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Custo Comida</p>
                    <p className="text-xl font-black text-amber-300">R$ {results.totalFeeding.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Custo/@ Prod.</p>
                    <p className="text-xl font-black text-blue-200">R$ {results.costPerProducedArroba.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="border shadow-sm rounded-xl bg-primary/5">
                <CardContent className="p-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 border-b border-primary/10 pb-2 flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Memória de Cálculo
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Peso Inicial</span>
                      <span className="font-bold">{form.initialWeight || 0} kg</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Ganho no Ciclo</span>
                      <span className="font-bold text-emerald-600">+{results.totalGainKg.toFixed(0)} kg</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-dashed pt-2 text-sm">
                      <span className="font-bold text-muted-foreground uppercase text-[10px]">Peso Vivo Final</span>
                      <span className="font-bold">{results.finalWeight.toFixed(0)} kg</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Rendimento ({form.yieldPct}%)</span>
                      <span className="font-bold">{results.finalCarcassKg.toFixed(1)} kg</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Comida/animal</span>
                      <span className="font-bold text-amber-600">R$ {results.feedingPerHead.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-primary/10 p-3 rounded-xl mt-3">
                      <span className="text-[11px] font-black text-primary uppercase">Total em @</span>
                      <span className="text-xl font-black text-primary">{results.finalArroba.toFixed(2)} @</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm rounded-xl bg-slate-900 text-white">
                <CardContent className="p-5 flex flex-col justify-center h-full">
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ponto de Equilíbrio</p>
                      <p className="text-3xl font-black italic text-blue-400">R$ {results.breakevenPrice.toFixed(2)} <span className="text-xs not-italic text-slate-500">/{results.unitLabel}</span></p>
                      <p className="text-[9px] text-slate-500 mt-1">Preço mínimo de venda para cobrir os custos.</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Investimento Total</p>
                      <p className="text-3xl font-black italic text-slate-100">R$ {results.totalInvestment.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
                      <p className="text-[9px] text-slate-500 mt-1">Compra do lote + custo das diárias.</p>
                    </div>
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
