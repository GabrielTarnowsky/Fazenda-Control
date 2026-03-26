import { useState, useEffect, useMemo } from "react";
import { store, Ration, FeedingLog } from "@/lib/store";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calculator, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function AddFeedingLog() {
  const navigate = useNavigate();
  const [rations, setRations] = useState<Ration[]>([]);
  const [form, setForm] = useState({
    ration_id: "",
    qty_per_day_kg: 2.5,
    num_animals: 1,
    days: 30,
    date: new Date().toISOString().split("T")[0],
    lote_id: ""
  });

  useEffect(() => {
    const load = async () => {
      const list = await store.getRations();
      setRations(list);
      if (list.length > 0) {
        setForm(f => ({ ...f, ration_id: list[0].id }));
      }
    };
    load();
  }, []);

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

    toast.success("Consumo registrado e lançado no financeiro!");
    navigate("/rations");
  };

  return (
    <div className="p-4 pb-20 animate-fade-in space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <h1 className="font-display text-2xl font-bold">Registrar Consumo</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Selecione a Ração</Label>
              <select 
                className="w-full h-11 px-3 rounded-md border border-input bg-background"
                value={form.ration_id}
                onChange={e => setForm({ ...form, ration_id: e.target.value })}
              >
                {rations.length === 0 && <option value="">Nenhuma ração cadastrada</option>}
                {rations.map(r => (
                  <option key={r.id} value={r.id}>{r.name} (R$ {r.cost_per_kg.toFixed(2)}/kg)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Qtd/Animal/Dia (kg)</Label>
                <Input type="number" step="0.1" value={form.qty_per_day_kg} onChange={e => setForm({ ...form, qty_per_day_kg: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Nº de Animais / Lote</Label>
                <Input type="number" value={form.num_animals} onChange={e => setForm({ ...form, num_animals: Number(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Período (Dias)</Label>
                <Input type="number" value={form.days} onChange={e => setForm({ ...form, days: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Data do Registro</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Identificação do Lote (Opcional)</Label>
              <Input value={form.lote_id} onChange={e => setForm({ ...form, lote_id: e.target.value })} placeholder="Ex: Lote 01" />
            </div>
          </CardContent>
        </Card>

        {/* Projection Card */}
        <Card className="bg-primary/5 border-dashed border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Projeção de Custo e Consumo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Consumo Total</p>
                <p className="text-xl font-black">{calculations.totalConsumption.toFixed(1)} kg</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Custo p/ Cabeça</p>
                <p className="text-xl font-black">R$ {calculations.costPerAnimal.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="pt-2 border-t border-primary/10">
              <p className="text-xs font-bold text-muted-foreground mb-1">CUSTO TOTAL NO PERÍODO</p>
              <p className="text-4xl font-black text-primary">R$ {calculations.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Calculator className="h-3 w-3" /> Este valor será lançado como despesa no financeiro.
              </p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full py-8 text-xl font-bold shadow-xl shadow-primary/20" size="lg">
          Lançar Trato e Gasto
        </Button>
      </form>
    </div>
  );
}
