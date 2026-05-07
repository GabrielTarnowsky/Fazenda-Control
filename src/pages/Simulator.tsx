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
  ChevronRight,
  Activity,
  ArrowRight,
  Download,
  Loader2
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { store } from "@/lib/store";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';

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
  const [showSaved, setShowSaved] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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
      } catch (e) { }
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
    const yieldPct = Number(form.yieldPct) || 54;
    const targetMargin = Number(form.targetMargin) || 0;

    const yieldDecimal = yieldPct / 100;
    
    // 1. Ganho de Peso Total
    const totalGainKg = expectedGMD * days;
    
    // 2. Peso Final (Kg Vivo)
    const finalWeight = initialWeight + totalGainKg;
    
    // 3. Conversão para Arroba (@)
    const finalCarcassKg = finalWeight * yieldDecimal;
    const finalArroba = finalCarcassKg / 15;

    // 4. Custos
    const totalPurchase = quantity * purchasePricePerHead;
    const totalMaintenance = (quantity * days * dailyCost) + extraCost;
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
      totalGainKg,
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
      unitsPerHead,
      // Dados para o Gráfico
      chartData: [
        { name: 'Compra', value: totalPurchase, color: '#f59e0b' },
        { name: 'Engorda (Diárias)', value: totalMaintenance, color: '#3b82f6' }
      ],
      // Análise de Sensibilidade
      sensitivity: {
        priceVariations: [-10, -5, 0, 5, 10],
        gmdVariations: [-10, 0, 10],
        matrix: [-10, -5, 0, 5, 10].map(priceVar => {
          return {
            priceVar,
            results: [-10, 0, 10].map(gmdVar => {
              const varGMD = expectedGMD * (1 + gmdVar / 100);
              const varPrice = expectedSalePrice * (1 + priceVar / 100);
              
              const vGain = varGMD * days;
              const vFinalWeight = initialWeight + vGain;
              const vCarcassKg = vFinalWeight * yieldDecimal;
              const vArroba = vCarcassKg / 15;
              
              let vUnits = 0;
              switch (form.saleMethod) {
                case "kg_vivo": vUnits = vFinalWeight; break;
                case "kg_carcaca": vUnits = vCarcassKg; break;
                default: vUnits = vArroba;
              }
              
              const vRevenue = quantity * vUnits * varPrice;
              const vProfit = vRevenue - totalInvestment;
              return { gmdVar, profit: vProfit };
            })
          };
        })
      }
    };
  }, [form]);

  const isProfitable = results.netProfit >= 0;

  const exportReport = async () => {
    setIsExporting(true);
    const toastId = toast.loading("Gerando PDF profissional...");

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 18;
      const contentWidth = pageWidth - margin * 2;
      let y = 20;

      // === HEADER ===
      doc.setFillColor(6, 78, 59); // emerald-900
      doc.rect(0, 0, pageWidth, 38, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(form.name || "Simulação de Engorda", margin, 18);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Relatório de Projeção de Engorda — Fazenda Control", margin, 26);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, margin, 32);
      y = 48;

      // === PARÂMETROS DO LOTE ===
      doc.setTextColor(6, 78, 59);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("PARÂMETROS DO LOTE", margin, y);
      y += 2;
      doc.setDrawColor(6, 78, 59);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + contentWidth, y);
      y += 7;

      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const params = [
        ["Quantidade de Animais", `${form.quantity || 0} cabeças`],
        ["Peso Inicial Médio", `${form.initialWeight || 0} kg`],
        ["GMD Esperado", `${form.expectedGMD || 0} kg/dia`],
        ["Ciclo de Engorda", `${form.days || 0} dias`],
        ["Rendimento de Carcaça", `${form.yieldPct || 50}%`],
        ["Peso Final Projetado", `${results.finalWeight.toFixed(0)} kg`],
      ];
      params.forEach(([label, value]) => {
        doc.setFont("helvetica", "normal");
        doc.text(label, margin, y);
        doc.setFont("helvetica", "bold");
        doc.text(value, margin + contentWidth, y, { align: "right" });
        y += 5.5;
      });
      y += 5;

      // === INVESTIMENTO E CUSTOS ===
      doc.setTextColor(6, 78, 59);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("INVESTIMENTO E CUSTOS", margin, y);
      y += 2;
      doc.line(margin, y, margin + contentWidth, y);
      y += 7;

      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      const costs = [
        ["Valor por Cabeça", `R$ ${Number(form.purchasePricePerHead || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
        ["Aquisição do Lote", `R$ ${results.totalPurchase.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
        ["Custo Diária (R$/cab/dia)", `R$ ${Number(form.dailyCost || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
        ["Custo de Manutenção Total", `R$ ${results.totalMaintenance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
        ["Custos Extras", `R$ ${Number(form.extraCost || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ];
      costs.forEach(([label, value]) => {
        doc.setFont("helvetica", "normal");
        doc.text(label, margin, y);
        doc.setFont("helvetica", "bold");
        doc.text(value, margin + contentWidth, y, { align: "right" });
        y += 5.5;
      });
      y += 2;
      // Total Investment line
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 4, contentWidth, 8, "F");
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("INVESTIMENTO TOTAL", margin + 2, y);
      doc.text(`R$ ${results.totalInvestment.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, margin + contentWidth - 2, y, { align: "right" });
      y += 12;

      // === RESULTADO PROJETADO ===
      const isProfit = results.netProfit >= 0;
      doc.setFillColor(isProfit ? 6 : 185, isProfit ? 78 : 28, isProfit ? 59 : 28);
      doc.rect(margin, y - 5, contentWidth, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("RESULTADO PROJETADO", margin + 4, y);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(`R$ ${results.netProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, margin + 4, y + 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Lucro por Cabeça: R$ ${results.profitPerHead.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, margin + 4, y + 18);
      // ROI on the right
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`ROI: ${results.roi.toFixed(1)}%`, margin + contentWidth - 4, y + 10, { align: "right" });
      y += 35;

      // === ANÁLISE DE PREÇO ===
      doc.setTextColor(6, 78, 59);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("ANÁLISE DE PREÇO", margin, y);
      y += 2;
      doc.line(margin, y, margin + contentWidth, y);
      y += 7;

      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      const priceData = [
        ["Método de Venda", results.unitLabel],
        ["Preço de Venda", `R$ ${Number(form.expectedSalePrice || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / ${results.unitLabel}`],
        ["Faturamento Bruto", `R$ ${results.grossRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
        ["Ponto de Equilíbrio", `R$ ${results.breakevenPrice.toFixed(2)} / ${results.unitLabel}`],
      ];
      if (results.suggestedPrice > 0) {
        priceData.push([`Preço p/ Margem ${form.targetMargin}%`, `R$ ${results.suggestedPrice.toFixed(2)} / ${results.unitLabel}`]);
      }
      priceData.forEach(([label, value]) => {
        doc.setFont("helvetica", "normal");
        doc.text(label, margin, y);
        doc.setFont("helvetica", "bold");
        doc.text(value, margin + contentWidth, y, { align: "right" });
        y += 5.5;
      });
      y += 8;

      // === MATRIZ DE SENSIBILIDADE ===
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setTextColor(6, 78, 59);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("MATRIZ DE SENSIBILIDADE (LUCRO LÍQUIDO)", margin, y);
      y += 2;
      doc.line(margin, y, margin + contentWidth, y);
      y += 7;

      // Table header
      const colW = contentWidth / 4;
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 4, contentWidth, 7, "F");
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Var. Preço", margin + 2, y);
      doc.text("-10% GMD", margin + colW + colW / 2, y, { align: "center" });
      doc.text("Base", margin + colW * 2 + colW / 2, y, { align: "center" });
      doc.text("+10% GMD", margin + colW * 3 + colW / 2, y, { align: "center" });
      y += 6;

      doc.setFontSize(8);
      results.sensitivity.matrix.forEach((row) => {
        const isBase = row.priceVar === 0;
        if (isBase) {
          doc.setFillColor(245, 245, 245);
          doc.rect(margin, y - 3.5, contentWidth, 5.5, "F");
        }
        doc.setFont("helvetica", isBase ? "bold" : "normal");
        doc.setTextColor(80, 80, 80);
        doc.text(`${row.priceVar > 0 ? "+" : ""}${row.priceVar}%`, margin + 2, y);
        row.results.forEach((res, j) => {
          doc.setTextColor(res.profit >= 0 ? 16 : 185, res.profit >= 0 ? 120 : 28, res.profit >= 0 ? 80 : 28);
          const val = Math.abs(res.profit) >= 1000 ? `R$ ${(res.profit / 1000).toFixed(1)}k` : `R$ ${res.profit.toFixed(0)}`;
          doc.text(val, margin + colW * (j + 1) + colW / 2, y, { align: "center" });
        });
        y += 5.5;
      });
      y += 5;

      // === FOOTER ===
      const footerY = doc.internal.pageSize.getHeight() - 12;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 3, margin + contentWidth, footerY - 3);
      doc.setTextColor(160, 160, 160);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("Fazenda Control — Gestão Pecuária Inteligente", margin, footerY);
      doc.text(`GMD: ${form.expectedGMD}kg | Rend.: ${form.yieldPct || 50}% | Simulação meramente projetiva`, margin + contentWidth, footerY, { align: "right" });

      // === SAVE ===
      doc.save(`Relatorio-${form.name || "Simulacao"}-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`);
      toast.success("PDF gerado com sucesso!", { id: toastId });
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Erro ao gerar PDF. Tente novamente.", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([]);

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
    toast.success("Simulação salva!");
  };

  const deleteSimulation = (id: string) => {
    const updated = savedSimulations.filter(s => s.id !== id);
    setSavedSimulations(updated);
    localStorage.setItem("bovi_simulations", JSON.stringify(updated));
    toast.success("Simulação excluída");
  };

  const loadSimulation = (sim: SavedSimulation) => {
    setForm({
      ...form,
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
  };

  return (
    <div className="p-4 pb-24 animate-fade-in space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> Simulador de Engorda
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Projete lucros e custos antes de investir</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={exportReport} 
            disabled={isExporting}
            className="font-bold border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          >
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Baixar PDF
          </Button>
          <Button variant="outline" onClick={() => setShowSaved(!showSaved)} className="font-bold border-primary/20 bg-primary/5">
            <History className="h-4 w-4 mr-2" /> {showSaved ? "Voltar" : "Histórico"}
          </Button>
        </div>
      </div>

      {showSaved ? (
        <Card className="border shadow-sm rounded-xl animate-in slide-in-from-right-4">
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
          
          {/* LADO ESQUERDO: INPUTS */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border shadow-sm rounded-xl overflow-hidden">
              <div className="bg-muted/30 p-3 border-b flex items-center justify-between">
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-9 font-bold bg-transparent border-none focus-visible:ring-0 w-[60%]" />
                <Button onClick={saveSimulation} size="sm" className="font-bold"><Save className="h-4 w-4 mr-2" /> Salvar</Button>
              </div>
              <CardContent className="p-5 space-y-6">
                
                {/* 1. COMPRA */}
                <div className="space-y-4 border-b pb-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Scale className="h-4 w-4" /> 1. Compra</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Animais</Label>
                      <Input type="number" placeholder="100" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="h-10 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Preço/Cabeça (R$)</Label>
                      <Input type="number" placeholder="2800" value={form.purchasePricePerHead} onChange={e => setForm({...form, purchasePricePerHead: e.target.value})} className="h-10 font-bold" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Peso Médio na Compra (kg)</Label>
                      <Input type="number" placeholder="350" value={form.initialWeight} onChange={e => setForm({...form, initialWeight: e.target.value})} className="h-10 font-bold" />
                    </div>
                  </div>
                </div>

                {/* 2. ENGORDA */}
                <div className="space-y-4 border-b pb-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Activity className="h-4 w-4" /> 2. Engorda</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">GMD (Ganho Médio Diário)</Label>
                      <Input type="number" step="0.1" value={form.expectedGMD} onChange={e => setForm({...form, expectedGMD: e.target.value})} className="h-10 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Tempo (Dias)</Label>
                      <Input type="number" value={form.days} onChange={e => setForm({...form, days: e.target.value})} className="h-10 font-bold" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Custo da Diária por Animal (R$)</Label>
                      <Input type="number" step="0.1" value={form.dailyCost} onChange={e => setForm({...form, dailyCost: e.target.value})} className="h-10 font-bold" />
                    </div>
                  </div>
                </div>

                {/* 3. VENDA */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><DollarSign className="h-4 w-4" /> 3. Venda</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Rendimento de Carcaça (%)</Label>
                      <Input type="number" value={form.yieldPct} onChange={e => setForm({...form, yieldPct: e.target.value})} className="h-10 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">Método</Label>
                      <Select value={form.saleMethod} onValueChange={v => setForm({...form, saleMethod: v})}>
                        <SelectTrigger className="h-10 font-bold text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="arroba">Por Arroba (@)</SelectItem>
                          <SelectItem value="kg_vivo">Kg Vivo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Label className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">Preço de Venda Projetado (Por {results.unitLabel})</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">R$</span>
                      <Input type="number" value={form.expectedSalePrice} onChange={e => setForm({...form, expectedSalePrice: e.target.value})} className="h-12 text-2xl font-black pl-9 border-emerald-500/30 bg-emerald-500/5" />
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* LADO DIREITO: RESULTADOS */}
          <div className="lg:col-span-7 space-y-4">
            
            <Card className={`border shadow-sm rounded-xl overflow-hidden transition-colors ${isProfitable ? 'bg-emerald-600' : 'bg-destructive'}`}>
              <CardContent className="p-6 text-white relative">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  {isProfitable ? <TrendingUp className="h-32 w-32" /> : <TrendingDown className="h-32 w-32" />}
                </div>
                <div className="relative z-10">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Lucro Líquido Estimado</p>
                  <h2 className="text-5xl font-black italic tracking-tighter mb-4">
                    R$ {results.netProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mt-6 border-t border-white/20 pt-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-0.5">Retorno (ROI)</p>
                      <p className="text-xl font-black">{results.roi.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-0.5">Lucro/Cabeça</p>
                      <p className="text-xl font-black">R$ {results.profitPerHead.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Memória de Cálculo - AJUDA O USUÁRIO A CONFERIR */}
              <Card className="border shadow-sm rounded-xl bg-primary/5">
                <CardContent className="p-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 border-b border-primary/10 pb-2 flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Memória de Cálculo
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground">Peso Inicial</span>
                      <span className="text-sm font-black">{form.initialWeight || 0} kg</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground">Ganho no Ciclo</span>
                      <span className="text-sm font-black text-emerald-600">+{results.totalGainKg.toFixed(0)} kg</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-dashed pt-2">
                      <span className="text-[10px] font-black text-muted-foreground uppercase">Peso Final Vivo</span>
                      <span className="text-sm font-black">{results.finalWeight.toFixed(0)} kg</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground">Peso Carcaça ({form.yieldPct}%)</span>
                      <span className="text-sm font-black">{results.finalCarcassKg.toFixed(1)} kg</span>
                    </div>
                    <div className="flex justify-between items-center bg-primary/10 p-2 rounded-lg mt-2">
                      <span className="text-[11px] font-black text-primary uppercase">Arrobas Final</span>
                      <span className="text-lg font-black text-primary">{results.finalArroba.toFixed(2)} @</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Equilíbrio */}
              <Card className="border shadow-sm rounded-xl bg-slate-900 text-white">
                <CardContent className="p-5 flex flex-col justify-center h-full">
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ponto de Equilíbrio</p>
                      <p className="text-2xl font-black italic text-blue-400">R$ {results.breakevenPrice.toFixed(2)} <span className="text-[10px] not-italic text-slate-500">/ {results.unitLabel}</span></p>
                      <p className="text-[9px] text-slate-500 mt-1">Preço mínimo de venda para não ter prejuízo.</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Investimento Total</p>
                      <p className="text-2xl font-black italic text-slate-100">R$ {results.totalInvestment.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
                      <p className="text-[9px] text-slate-500 mt-1">Compra + Diárias.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

          <div ref={reportRef} className="hidden print:block bg-white p-10 space-y-8 w-[800px] mx-auto">
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

            {/* NOVA SEÇÃO: ANALISE AVANÇADA NO RELATÓRIO */}
            <div className="grid grid-cols-2 gap-8 pt-4">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-widest border-b pb-2">Composição de Custos</h3>
                <div className="flex items-center gap-6">
                  <div className="w-32 h-32 border-8 border-amber-500 rounded-full flex-shrink-0 flex items-center justify-center">
                    <div className="w-24 h-24 border-8 border-blue-500 rounded-full flex items-center justify-center text-[10px] font-black text-center leading-tight">
                      CUSTO<br />TOTAL
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-amber-500 rounded-sm"></div>
                      <p className="text-[10px] font-bold">Compra: {(results.totalPurchase / results.totalInvestment * 100).toFixed(0)}%</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                      <p className="text-[10px] font-bold">Manutenção: {(results.totalMaintenance / results.totalInvestment * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-widest border-b pb-2">Matriz de Sensibilidade (Lucro)</h3>
                <table className="w-full text-[9px] text-center border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="p-1 text-left text-slate-400">Var. Preço</th>
                      <th className="p-1 text-slate-900">-10% GMD</th>
                      <th className="p-1 text-slate-900">Base</th>
                      <th className="p-1 text-slate-900">+10% GMD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.sensitivity.matrix.filter((_, idx) => idx % 2 === 0).map((row, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="p-1 text-left font-bold text-slate-600">{row.priceVar > 0 ? '+' : ''}{row.priceVar}%</td>
                        {row.results.map((res, j) => (
                          <td key={j} className={`p-1 font-bold ${res.profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                            R$ {Math.abs(res.profit) >= 1000 ? `${(res.profit / 1000).toFixed(1)}k` : res.profit.toFixed(0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
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
