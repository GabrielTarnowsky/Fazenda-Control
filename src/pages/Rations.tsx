import { useState, useEffect, useMemo } from "react";
import { store, Ration, FeedingLog, IngredientPurchase, Ingredient, formatDateDisplay } from "@/lib/store";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Wheat, ListFilter, TrendingUp, DollarSign, History, Utensils, Package, PackagePlus, Calendar, Pencil, Trash2, Check, X, ChevronDown, Zap, Droplets, Leaf, Gem, FlaskConical, Activity } from "lucide-react";
import { getEffectiveNutri } from "@/lib/nutriReference";
import PurchaseForm from "@/components/PurchaseForm";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Rations() {
  const [rations, setRations] = useState<Ration[]>([]);
  const [logs, setLogs] = useState<FeedingLog[]>([]);
  const [purchases, setPurchases] = useState<IngredientPurchase[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [showPurchase, setShowPurchase] = useState(false);
  const [selectedYearMonth, setSelectedYearMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<IngredientPurchase>>({});
  const [selectedRationId, setSelectedRationId] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadData = async () => {
    const [r, l, p, i] = await Promise.all([
      store.getRations(),
      store.getFeedingLogs(),
      store.getIngredientPurchases(),
      store.getIngredients()
    ]);
    setRations(r);
    setLogs(l);
    setPurchases(p);
    setIngredients(i);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => l && l.date && l.date.substring(0, 7) === selectedYearMonth);
  }, [logs, selectedYearMonth]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => p && p.date && p.date.substring(0, 7) === selectedYearMonth);
  }, [purchases, selectedYearMonth]);

  const stats = useMemo(() => {
    const totalCost = filteredLogs.reduce((acc, log) => acc + (Number(log.total_cost) || 0), 0);
    const totalConsumption = filteredLogs.reduce((acc, log) => acc + (Number(log.total_consumption_kg) || 0), 0);
    const totalAnimals = filteredLogs.reduce((acc, log) => acc + (Number(log.num_animals) || 0), 0);
    const totalPurchases = filteredPurchases.reduce((acc, p) => acc + (Number(p.total_value) || 0), 0);
    const avgCostPerAnimal = totalAnimals > 0 ? totalCost / totalAnimals : 0;

    return { totalCost, totalConsumption, avgCostPerAnimal, totalPurchases };
  }, [filteredLogs, filteredPurchases]);

  const ingredientTotals = useMemo(() => {
    const totals: Record<string, { qty: number, value: number }> = {};
    filteredPurchases.forEach(p => {
      const ing = ingredients.find(i => i.id === p.ingredient_id);
      const name = ing?.name || "Desconhecido";
      if (!totals[name]) totals[name] = { qty: 0, value: 0 };
      totals[name].qty += Number(p.total_qty_kg) || 0;
      totals[name].value += Number(p.total_value) || 0;
    });
    return Object.entries(totals).sort((a, b) => b[1].value - a[1].value);
  }, [filteredPurchases, ingredients]);

  const handleDeletePurchase = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta compra?")) {
      await store.deleteIngredientPurchase(id);
      loadData();
      toast.success("Compra excluída");
    }
  };

  const startEditing = (p: IngredientPurchase) => {
    setEditingId(p.id);
    setEditForm(p);
  };

  const saveEditing = async () => {
    if (!editingId) return;
    await store.updateIngredientPurchase(editingId, editForm);
    setEditingId(null);
    loadData();
    toast.success("Compra atualizada");
  };

  return (
    <div className="p-4 pb-20 animate-fade-in space-y-8">
      {/* ... previous content until Metrics Section ... */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Gestão de Nutrição</h1>
          <p className="text-sm text-muted-foreground">Controle de alimentação e estoque</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowPurchase(!showPurchase)} className="font-bold shadow-md">
            <PackagePlus className="mr-2 h-4 w-4" /> Comprar Insumo
          </Button>
          <Button variant="outline" onClick={() => navigate("/ingredients")} className="bg-card">
            <ListFilter className="mr-2 h-4 w-4" /> Configurar Insumos
          </Button>
          <Button onClick={() => navigate("/rations/new")}>
            <Plus className="mr-2 h-4 w-4" /> Criar Ração
          </Button>
        </div>
      </div>

      {showPurchase && (
        <PurchaseForm 
          onSuccess={() => {
            loadData();
            setShowPurchase(false);
          }} 
          onCancel={() => setShowPurchase(false)}
        />
      )}

      {/* Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-dashed">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Filtro por Período</h3>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Métricas e históricos mensais</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-bold whitespace-nowrap">Mês de Referência:</Label>
          <Input 
            type="month" 
            value={selectedYearMonth} 
            onChange={(e) => setSelectedYearMonth(e.target.value)}
            className="w-[180px] h-9 bg-card font-bold"
          />
        </div>
      </div>

      {/* Metrics Section */}
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-1">
        <Card className="bg-emerald-500/5 border-emerald-500/20 shadow-sm overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Package className="h-24 w-24" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" /> Investimento Total em Insumos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-emerald-700">R$ {stats.totalPurchases.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Investimento no mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 max-w-sm">Este valor representa todas as compras de insumos registradas no período selecionado. Ideal para fechamento de caixa e projeção de estoque.</p>
          </CardContent>
        </Card>
      </div>

      {/* Ingredient Totals Cards (INVENTORY SUMMARY) */}
      <div className="space-y-4">
        <h2 className="font-bold flex items-center gap-2 text-lg"><Package className="h-5 w-5 text-primary" /> Estoque Acumulado (Total por Insumo)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {ingredientTotals.length === 0 ? (
            <p className="col-span-full text-xs text-muted-foreground font-bold uppercase italic py-4">Nenhum insumo registrado no histórico.</p>
          ) : (
            ingredientTotals.map(([name, data]) => (
              <div key={name} className="bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-white/10 relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 opacity-5 group-hover:scale-110 transition-transform">
                  <Wheat className="h-16 w-16" />
                </div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{name}</p>
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black italic">{data.qty.toLocaleString("pt-BR")}</span>
                    <span className="text-[10px] font-bold text-slate-400">kg</span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xs font-black text-emerald-400 italic">R$ {data.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* My Rations Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold flex items-center gap-2 text-lg"><Wheat className="h-5 w-5 text-primary" /> Fórmulas de Ração</h2>
        </div>
        <div className="space-y-4">
          {rations.length === 0 ? (
            <p className="text-sm text-center py-10 text-muted-foreground bg-muted/20 rounded-xl border border-dashed font-semibold italic">Sem formulações salvas.</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {rations.map(r => {
                  const isSelected = selectedRationId === r.id;
                  return (
                    <Card 
                      key={r.id} 
                      className={`transition-all cursor-pointer group ${
                        isSelected ? 'border-primary ring-2 ring-primary/20 shadow-lg' : 'hover:border-primary/40'
                      }`} 
                      onClick={() => setSelectedRationId(isSelected ? null : r.id)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold">{r.name || "Inominada"}</h3>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold">{(r.products || []).length} Insumos</p>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <p className="text-lg font-black text-primary">R$ {(Number(r.cost_per_kg) || 0).toFixed(2)}</p>
                            <p className="text-[9px] uppercase font-bold text-muted-foreground">p/ kg</p>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? 'rotate-180' : ''}`} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* DETALHE DA RAÇÃO SELECIONADA */}
              {selectedRationId && (() => {
                const ration = rations.find(r => r.id === selectedRationId);
                if (!ration) return null;

                // Agrupar ingredientes por tipo
                const typeConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
                  'Proteína': { label: 'Proteína', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20', icon: <Droplets className="h-5 w-5 text-blue-500" /> },
                  'Energia':  { label: 'Energia', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20', icon: <Zap className="h-5 w-5 text-amber-500" /> },
                  'Volumoso': { label: 'Volumoso / Fibra', color: 'text-green-600', bg: 'bg-green-500/10 border-green-500/20', icon: <Leaf className="h-5 w-5 text-green-500" /> },
                  'Mineral':  { label: 'Mineral', color: 'text-slate-600', bg: 'bg-slate-500/10 border-slate-500/20', icon: <Gem className="h-5 w-5 text-slate-500" /> },
                  'Núcleo':   { label: 'Núcleo / Premix', color: 'text-purple-600', bg: 'bg-purple-500/10 border-purple-500/20', icon: <FlaskConical className="h-5 w-5 text-purple-500" /> },
                };

                // Calcular totais por tipo
                const typeBreakdown: Record<string, { pct: number; cost: number; items: { name: string; pct: number; cost: number }[] }> = {};
                (ration.products || []).forEach(p => {
                  const ing = ingredients.find(i => i.id === p.ingredient_id);
                  if (!ing) return;
                  const type = ing.type || 'Outros';
                  if (!typeBreakdown[type]) typeBreakdown[type] = { pct: 0, cost: 0, items: [] };
                  const pct = Number(p.percentage) || 0;
                  const cost = ing.cost_per_kg * (pct / 100);
                  typeBreakdown[type].pct += pct;
                  typeBreakdown[type].cost += cost;
                  typeBreakdown[type].items.push({ name: ing.name, pct, cost });
                });

                // Calcular totais nutricionais (com fallback pela tabela de referência)
                const nutriTotals = (ration.products || []).reduce((acc, p) => {
                  const ing = ingredients.find(i => i.id === p.ingredient_id);
                  if (!ing) return acc;
                  const nutri = getEffectiveNutri(ing);
                  const pct = (Number(p.percentage) || 0) / 100;
                  return {
                    pb: acc.pb + (nutri.pb * pct),
                    ndt: acc.ndt + (nutri.ndt * pct),
                    fdn: acc.fdn + (nutri.fdn * pct),
                    ca: acc.ca + (nutri.ca * pct),
                    p: acc.p + (nutri.p * pct),
                  };
                }, { pb: 0, ndt: 0, fdn: 0, ca: 0, p: 0 });

                const sortedTypes = Object.entries(typeBreakdown).sort((a, b) => b[1].pct - a[1].pct);

                return (
                  <div className="animate-in slide-in-from-top-2 duration-300 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between bg-card rounded-xl border p-4 shadow-sm">
                      <div>
                        <h3 className="text-lg font-black">{ration.name}</h3>
                        <p className="text-xs text-muted-foreground">Composição nutricional da mistura</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="font-bold text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/rations/${ration.id}/edit`); }}>
                          <Pencil className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="font-bold text-xs text-destructive border-destructive/30 hover:bg-destructive/10" 
                          onClick={async (e) => { 
                            e.stopPropagation(); 
                            if (confirm(`Deseja excluir a ração "${ration.name}"?`)) {
                              await store.deleteRation(ration.id);
                              setSelectedRationId(null);
                              loadData();
                              toast.success("Ração excluída");
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Excluir
                        </Button>
                      </div>
                    </div>

                    {/* Cards de Composição por Tipo */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {sortedTypes.map(([type, data]) => {
                        const config = typeConfig[type] || { label: type, color: 'text-gray-600', bg: 'bg-gray-500/10 border-gray-500/20', icon: <Wheat className="h-5 w-5 text-gray-500" /> };
                        return (
                          <div key={type} className={`rounded-2xl p-4 border ${config.bg} relative overflow-hidden`}>
                            <div className="flex items-center gap-2 mb-3">
                              {config.icon}
                              <p className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>{config.label}</p>
                            </div>
                            <p className={`text-3xl font-black italic ${config.color}`}>{data.pct.toFixed(0)}%</p>
                            <p className="text-[10px] text-muted-foreground font-bold mt-1">R$ {data.cost.toFixed(2)} /kg</p>
                            <div className="mt-3 pt-2 border-t border-current/10 space-y-1">
                              {data.items.map((item, i) => (
                                <div key={i} className="flex justify-between text-[10px]">
                                  <span className="text-muted-foreground truncate mr-2">{item.name}</span>
                                  <span className="font-black whitespace-nowrap">{item.pct}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Análise Nutricional Consolidada */}
                    <div className="bg-slate-900 text-white rounded-xl p-4 shadow-lg">
                      <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
                        <Activity className="h-4 w-4 text-emerald-400" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">Análise Nutricional Total (Mistura)</h3>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                        <div className="text-center">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Proteína</p>
                          <p className="text-xl font-black text-blue-400">{nutriTotals.pb.toFixed(1)}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Energia</p>
                          <p className="text-xl font-black text-amber-400">{nutriTotals.ndt.toFixed(1)}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Fibra</p>
                          <p className="text-xl font-black text-emerald-400">{nutriTotals.fdn.toFixed(1)}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Cálcio</p>
                          <p className="text-xl font-black">{nutriTotals.ca.toFixed(2)}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Fósforo</p>
                          <p className="text-xl font-black">{nutriTotals.p.toFixed(2)}%</p>
                        </div>
                        <div className="text-center border-l border-white/10 pl-2">
                          <p className="text-[9px] font-bold text-slate-400 uppercase text-center">Ca:P</p>
                          <p className="text-xl font-black text-amber-200">
                            {nutriTotals.p > 0 ? (nutriTotals.ca / nutriTotals.p).toFixed(1) : '—'}:1
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Barra visual de composição */}
                    <div className="bg-card rounded-xl border p-4 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Distribuição Visual</p>
                      <div className="flex rounded-full overflow-hidden h-6">
                        {sortedTypes.map(([type, data]) => {
                          const colors: Record<string, string> = {
                            'Proteína': 'bg-blue-500',
                            'Energia': 'bg-amber-500',
                            'Volumoso': 'bg-green-500',
                            'Mineral': 'bg-slate-400',
                            'Núcleo': 'bg-purple-500',
                          };
                          const bgColor = colors[type] || 'bg-gray-400';
                          return (
                            <div 
                              key={type} 
                              className={`${bgColor} flex items-center justify-center text-white text-[9px] font-black transition-all`} 
                              style={{ width: `${data.pct}%` }}
                              title={`${type}: ${data.pct.toFixed(0)}%`}
                            >
                              {data.pct >= 10 && `${data.pct.toFixed(0)}%`}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-3">
                        {sortedTypes.map(([type, data]) => {
                          const dotColors: Record<string, string> = {
                            'Proteína': 'bg-blue-500',
                            'Energia': 'bg-amber-500',
                            'Volumoso': 'bg-green-500',
                            'Mineral': 'bg-slate-400',
                            'Núcleo': 'bg-purple-500',
                          };
                          return (
                            <div key={type} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <div className={`h-2.5 w-2.5 rounded-full ${dotColors[type] || 'bg-gray-400'}`} />
                              <span className="font-bold">{type} ({data.pct.toFixed(0)}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Botão Excluir Ração */}
                    <div className="flex justify-end pt-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="font-bold text-xs text-destructive border-destructive/30 hover:bg-destructive/10" 
                        onClick={async (e) => { 
                          e.stopPropagation(); 
                          if (confirm(`Deseja excluir a ração "${ration.name}"?`)) {
                            await store.deleteRation(ration.id);
                            setSelectedRationId(null);
                            loadData();
                            toast.success("Ração excluída");
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Excluir Ração
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </section>

      <div className="grid gap-8">
        {/* Feeding History - Table View */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-bold flex items-center gap-2 text-lg"><History className="h-5 w-5 text-primary" /> Histórico de Consumo (Planilha)</h2>
            <Button size="sm" variant="outline" className="h-8 text-xs font-bold" onClick={() => navigate("/rations/log/new")}>
              Lançar Novo Trato
            </Button>
          </div>
          
          <Card className="rounded-xl overflow-hidden shadow-sm border-border/50">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3 border-b">Data</th>
                    <th className="px-4 py-3 border-b">Ração</th>
                    <th className="px-4 py-3 border-b">Identificação / Lote</th>
                    <th className="px-4 py-3 border-b text-center">Animais</th>
                    <th className="px-4 py-3 border-b text-center">Período</th>
                    <th className="px-4 py-3 border-b text-right">Consumo (kg)</th>
                    <th className="px-4 py-3 border-b text-right">Custo Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground italic bg-muted/5">Nenhum registro de trato para este período.</td>
                    </tr>
                  ) : (
                    filteredLogs.sort((a,b) => (b.date || "").localeCompare(a.date || "")).map(l => {
                      const rat = rations.find(r => r.id === l.ration_id);
                      return (
                        <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-muted-foreground">{formatDateDisplay(l.date)}</td>
                          <td className="px-4 py-3 font-bold text-primary">{rat?.name || "Ração"}</td>
                          <td className="px-4 py-3">{l.lote_id || "—"}</td>
                          <td className="px-4 py-3 text-center font-bold">{l.num_animals || 0}</td>
                          <td className="px-4 py-3 text-center">{l.days || 0} dias</td>
                          <td className="px-4 py-3 text-right font-medium text-primary-foreground font-bold">{(Number(l.total_consumption_kg) || 0).toLocaleString("pt-BR")} kg</td>
                          <td className="px-4 py-3 text-right font-black text-destructive">
                            R$ {(Number(l.total_cost) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* Purchase History - Table View */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-bold flex items-center gap-2 text-lg"><Package className="h-5 w-5 text-primary" /> Histórico de Compras de Insumos</h2>
          </div>
          
          <Card className="rounded-xl overflow-hidden shadow-sm border-border/50">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-primary/5 text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3 border-b">Data</th>
                    <th className="px-4 py-3 border-b">Insumo</th>
                    <th className="px-4 py-3 border-b text-right">Quantidade (kg)</th>
                    <th className="px-4 py-3 border-b text-right">Valor Pago</th>
                    <th className="px-4 py-3 border-b text-right">Custo p/ kg</th>
                    <th className="px-4 py-3 border-b text-center w-[100px]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-muted-foreground italic bg-muted/5">Nenhuma compra para este período.</td>
                    </tr>
                  ) : (
                    filteredPurchases.sort((a,b) => b.date.localeCompare(a.date)).map(p => {
                      const ing = ingredients.find(i => i.id === p.ingredient_id);
                      if (editingId === p.id) {
                        return (
                          <tr key={p.id} className="bg-primary/5 border-b border-primary/20">
                            <td className="px-4 py-3">
                              <Input type="date" className="h-8 text-xs w-[120px]" value={editForm.date || ""} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                            </td>
                            <td className="px-4 py-3">
                              <select className="h-8 text-xs w-full rounded-md border border-input bg-background font-medium" value={editForm.ingredient_id} onChange={e => setEditForm({ ...editForm, ingredient_id: e.target.value })}>
                                {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Input type="number" step="0.1" className="h-8 text-xs text-right w-[80px]" value={editForm.total_qty_kg || ""} onChange={e => setEditForm({ ...editForm, total_qty_kg: Number(e.target.value) })} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Input type="number" step="0.01" className="h-8 text-xs text-right w-[100px]" value={editForm.total_value || ""} onChange={e => setEditForm({ ...editForm, total_value: Number(e.target.value) })} />
                            </td>
                            <td className="px-4 py-3 text-right">-</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/20" onClick={saveEditing}><Check className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:bg-slate-50" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={p.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-muted-foreground">{formatDateDisplay(p.date)}</td>
                          <td className="px-4 py-3 font-bold uppercase">{ing?.name || "Insumo"}</td>
                          <td className="px-4 py-3 text-right font-medium">{p.total_qty_kg.toLocaleString("pt-BR")} kg</td>
                          <td className="px-4 py-3 text-right font-black text-destructive">
                            R$ {p.total_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right">
                             <Badge variant="outline" className="font-black text-primary">R$ {(p.cost_per_kg || (p.total_value / p.total_qty_kg) || 0).toFixed(2)}/kg</Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-primary hover:bg-primary/10" onClick={() => startEditing(p)}><Pencil className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeletePurchase(p.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

