import { useState, useEffect, useMemo } from "react";
import { store, Ration, Animal } from "@/lib/store";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calculator, Sparkles, Layers, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function AddFeedingLog() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryLote = searchParams.get("lote") || "";

  const [rations, setRations] = useState<Ration[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [isCustomLote, setIsCustomLote] = useState(false);

  const [form, setForm] = useState({
    ration_id: "",
    qty_per_day_kg: 2.5,
    num_animals: 1,
    days: 30,
    date: new Date().toISOString().split("T")[0],
    lote_id: queryLote
  });

  useEffect(() => {
    const load = async () => {
      const [listRations, listAnimals] = await Promise.all([
        store.getRations(),
        store.getAnimals()
      ]);
      setRations(listRations);
      setAnimals(listAnimals);

      if (listRations.length > 0) {
        setForm(f => ({ ...f, ration_id: listRations[0].id }));
      }

      // Se passou o lote via URL (ex: ?lote=LOTE%201), preenche automaticamente
      if (queryLote) {
        const lotAnimalsCount = listAnimals.filter(
          a => a.status === 'ativo' && ((a.lote_id || a.lot || "").trim().toLowerCase() === queryLote.trim().toLowerCase())
        ).length;

        setForm(f => ({
          ...f,
          lote_id: queryLote,
          num_animals: lotAnimalsCount > 0 ? lotAnimalsCount : f.num_animals
        }));
      }
    };
    load();
  }, [queryLote]);

  // Agrupa os lotes existentes na fazenda e a quantidade de cabeças em cada um
  const lotesDisponiveis = useMemo(() => {
    const map = new Map<string, number>();
    animals.filter(a => a.status === "ativo").forEach(a => {
      const l = (a.lote_id || a.lot || "").trim();
      if (l) {
        map.set(l, (map.get(l) || 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [animals]);

  const handleSelectLote = (val: string) => {
    if (val === "__custom__") {
      setIsCustomLote(true);
      setForm(f => ({ ...f, lote_id: "" }));
      return;
    }

    setIsCustomLote(false);
    const targetLote = lotesDisponiveis.find(l => l.name.toLowerCase() === val.toLowerCase());
    
    setForm(f => ({
      ...f,
      lote_id: val,
      num_animals: targetLote ? targetLote.count : f.num_animals
    }));
  };

  const calculations = useMemo(() => {
    const ration = rations.find(r => r.id === form.ration_id);
    const totalConsumption = form.qty_per_day_kg * form.num_animals * form.days;
    const totalCost = totalConsumption * (ration?.cost_per_kg || 0);
    const costPerAnimal = form.num_animals > 0 ? totalCost / form.num_animals : 0;

    return { totalConsumption, totalCost, costPerAnimal };
  }, [form, rations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ration_id) { toast.error("Selecione uma ração"); return; }
    
    await store.addFeedingLog({
      ...form,
      total_consumption_kg: calculations.totalConsumption,
      total_cost: calculations.totalCost
    });

    toast.success("Trato registrado com sucesso! O custo foi lançado no lote e no financeiro.");
    
    // Se veio de um lote específico, volta para ele, senão vai para rações
    if (queryLote) {
      navigate(`/lotes/${encodeURIComponent(queryLote)}`);
    } else {
      navigate("/rations");
    }
  };

  return (
    <div className="p-4 pb-20 animate-fade-in space-y-6 max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div>
        <h1 className="font-display text-2xl font-bold">Lançar Trato / Ração</h1>
        <p className="text-sm text-muted-foreground">O custo de alimentação entrará diretamente no cálculo do lote e do financeiro</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border shadow-sm">
          <CardContent className="pt-6 space-y-5">
            {/* Seletor de Lote com vínculo direto */}
            <div className="space-y-2 bg-primary/5 p-4 rounded-xl border border-primary/20">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold flex items-center gap-1.5 text-primary">
                  <Layers className="h-4 w-4" /> Selecione o Lote Destino *
                </Label>
                {form.lote_id && (
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" /> Vinculado a {form.lote_id}
                  </span>
                )}
              </div>

              {!isCustomLote ? (
                <div className="space-y-2">
                  <select 
                    className="w-full h-11 px-3 rounded-lg border border-input bg-background font-bold text-sm shadow-sm focus:ring-2 focus:ring-primary"
                    value={form.lote_id}
                    onChange={e => handleSelectLote(e.target.value)}
                  >
                    <option value="">-- Selecione o Lote de destino --</option>
                    {lotesDisponiveis.map(l => (
                      <option key={l.name} value={l.name}>
                        {l.name} ({l.count} {l.count === 1 ? 'animal' : 'cabeças'})
                      </option>
                    ))}
                    <option value="__custom__">➕ Digitar outro lote manualmente...</option>
                    <option value="Geral">Fazenda Geral (Sem lote específico)</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Ao escolher o lote, o número de cabeças é preenchido automaticamente e o custo vai direto para o relatório zootécnico.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input 
                      value={form.lote_id} 
                      onChange={e => setForm({ ...form, lote_id: e.target.value })} 
                      placeholder="Ex: LOTE 1"
                      className="font-bold h-11"
                      autoFocus
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="h-11 text-xs whitespace-nowrap"
                      onClick={() => setIsCustomLote(false)}
                    >
                      Voltar à lista
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Ração Utilizada */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Selecione a Ração / Suplemento</Label>
              <select 
                className="w-full h-11 px-3 rounded-lg border border-input bg-background font-medium"
                value={form.ration_id}
                onChange={e => setForm({ ...form, ration_id: e.target.value })}
              >
                {rations.length === 0 && <option value="">Nenhuma ração cadastrada em Nutrição</option>}
                {rations.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} — (R$ {r.cost_per_kg.toFixed(2)} / kg)
                  </option>
                ))}
              </select>
            </div>

            {/* Quantidade e Cabeças */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Consumo por Animal por Dia (kg)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={form.qty_per_day_kg} 
                  onChange={e => setForm({ ...form, qty_per_day_kg: Number(e.target.value) })} 
                  className="h-11 font-bold"
                />
                <p className="text-[10px] text-muted-foreground">Ex: 2.5 kg para semiconfinamento ou 0.3 kg para proteinado</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Nº de Animais do Lote</Label>
                <Input 
                  type="number" 
                  value={form.num_animals} 
                  onChange={e => setForm({ ...form, num_animals: Number(e.target.value) })} 
                  className="h-11 font-bold"
                />
                <p className="text-[10px] text-muted-foreground">Preenchido com o total de cabeças ativas</p>
              </div>
            </div>

            {/* Dias e Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Período de Trato (Dias)</Label>
                <Input 
                  type="number" 
                  value={form.days} 
                  onChange={e => setForm({ ...form, days: Number(e.target.value) })} 
                  className="h-11 font-bold"
                />
                <p className="text-[10px] text-muted-foreground">Quantos dias dura esse fornecimento (ex: 30 dias)</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Data do Fornecimento / Início</Label>
                <Input 
                  type="date" 
                  value={form.date} 
                  onChange={e => setForm({ ...form, date: e.target.value })} 
                  className="h-11 font-medium"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projection Card */}
        <Card className="bg-primary/5 border-dashed border-primary/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Projeção de Custo e Consumo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background/80 p-3 rounded-lg border border-border/50">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Consumo Total</p>
                <p className="text-xl font-black">{calculations.totalConsumption.toFixed(1)} kg</p>
                <p className="text-[10px] text-muted-foreground">~{(calculations.totalConsumption / 40).toFixed(1)} sacos (40kg)</p>
              </div>
              <div className="bg-background/80 p-3 rounded-lg border border-border/50">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Custo p/ Cabeça</p>
                <p className="text-xl font-black text-emerald-600">R$ {calculations.costPerAnimal.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">no período de {form.days} dias</p>
              </div>
            </div>
            
            <div className="pt-2 border-t border-primary/10">
              <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">Custo Total que irá para o Lote</p>
              <p className="text-3xl font-black text-primary">R$ {calculations.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-medium">
                <Calculator className="h-3.5 w-3.5 text-primary" /> 
                Este valor entrará no card "Custo do Lote (Ração)", na diária por cabeça e no custo por arroba do lote {form.lote_id ? `"${form.lote_id}"` : ""}.
              </p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full py-7 text-lg font-bold shadow-xl shadow-primary/20 bg-emerald-600 hover:bg-emerald-700 text-white" size="lg">
          Confirmar e Lançar Trato no Lote
        </Button>
      </form>
    </div>
  );
}
