import { useState, useEffect, useMemo } from "react";
import { store, Ingredient, RationProduct } from "@/lib/store";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, Calculator } from "lucide-react";
import { toast } from "sonner";

// Cada linha do formulário — percentage como STRING para controle de input
interface FormRow {
  id: string; // chave estável para React
  ingredient_id: string;
  percentage: string; // STRING para evitar problemas com input controlado
}

let _counter = 0;
function makeId() {
  return `r_${Date.now()}_${++_counter}`;
}

export default function AddRation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [name, setName] = useState("");
  const [rows, setRows] = useState<FormRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const ings = await store.getIngredients();
      setIngredients(ings);
      if (id) {
        const allRats = await store.getRations();
        const ration = allRats.find(r => r.id === id);
        if (ration) {
          setName(ration.name);
          setRows((ration.products || []).map(p => ({
            id: makeId(),
            ingredient_id: p.ingredient_id,
            percentage: String(p.percentage || "")
          })));
        }
      }
    };
    load();
  }, [id]);

  // IDs dos ingredientes já usados
  const usedIngredientIds = useMemo(() => {
    return new Set(rows.map(r => r.ingredient_id));
  }, [rows]);

  // Ingredientes ainda disponíveis
  const availableIngredients = useMemo(() => {
    return ingredients.filter(ing => !usedIngredientIds.has(ing.id));
  }, [ingredients, usedIngredientIds]);

  const totalPercentage = useMemo(() => {
    return rows.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0);
  }, [rows]);

  const nutriTotals = useMemo(() => {
    return rows.reduce((acc, r) => {
      const ing = ingredients.find(i => i.id === r.ingredient_id);
      if (!ing) return acc;
      const pct = (Number(r.percentage) || 0) / 100;
      return {
        pb: acc.pb + ((ing.pb || 0) * pct),
        ndt: acc.ndt + ((ing.ndt || 0) * pct),
        fdn: acc.fdn + ((ing.fdn || 0) * pct),
        ca: acc.ca + (((ing as any).ca || 0) * pct),
        p: acc.p + (((ing as any).p || 0) * pct),
      };
    }, { pb: 0, ndt: 0, fdn: 0, ca: 0, p: 0 });
  }, [rows, ingredients]);

  const costPerKg = useMemo(() => {
    return rows.reduce((acc, r) => {
      const ing = ingredients.find(i => i.id === r.ingredient_id);
      if (!ing) return acc;
      return acc + (ing.cost_per_kg * ((Number(r.percentage) || 0) / 100));
    }, 0);
  }, [rows, ingredients]);

  function addRow() {
    if (ingredients.length === 0) {
      toast.error("Cadastre ingredientes primeiro!");
      return;
    }
    if (availableIngredients.length === 0) {
      toast.error("Todos os ingredientes já foram adicionados!");
      return;
    }
    // Cria nova linha sem alterar as existentes
    const newRow: FormRow = {
      id: makeId(),
      ingredient_id: availableIngredients[0].id,
      percentage: ""
    };
    setRows(prev => [...prev, newRow]);
  }

  function updateRow(rowId: string, field: "ingredient_id" | "percentage", value: string) {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return { ...r, [field]: value };
    }));
  }

  function removeRow(rowId: string) {
    setRows(prev => prev.filter(r => r.id !== rowId));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { toast.error("Informe o nome da ração"); return; }
    if (rows.length === 0) { toast.error("Adicione ao menos um ingrediente"); return; }
    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast.error(`A soma deve ser 100% (Atual: ${totalPercentage.toFixed(1)}%)`);
      return;
    }

    // Converte para o formato do banco (percentage como number)
    const products: RationProduct[] = rows.map(r => ({
      ingredient_id: r.ingredient_id,
      percentage: Number(r.percentage) || 0
    }));

    const rationData = {
      name,
      products,
      cost_per_kg: costPerKg
    };

    try {
      if (id) {
        await store.updateRation(id, rationData);
        toast.success("Ração atualizada!");
      } else {
        await store.addRation(rationData);
        toast.success("Ração criada com sucesso!");
      }
      navigate("/rations");
    } catch (err) {
      toast.error("Erro ao salvar ração");
      console.error(err);
    }
  };

  // Para cada linha, calcular quais ingredientes mostrar no dropdown:
  // o ingrediente atualmente selecionado + os que não foram usados por outras linhas
  function getOptionsForRow(currentRowId: string, currentIngredientId: string) {
    return ingredients.filter(ing => 
      ing.id === currentIngredientId || 
      !rows.some(r => r.id !== currentRowId && r.ingredient_id === ing.id)
    );
  }

  return (
    <div className="p-4 pb-20 animate-fade-in space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground mb-2">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{id ? "Editar Ração" : "Nova Formulação"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label>Nome da Ração</Label>
              <Input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Ex: Engorda Rápida, Manutenção Inverno..." 
                className="text-lg font-medium"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Composição da Mistura</CardTitle>
            <Button 
              type="button" 
              size="sm" 
              onClick={addRow} 
              className="gap-2" 
              disabled={availableIngredients.length === 0}
            >
              <Plus className="h-4 w-4" /> Add Ingrediente {availableIngredients.length > 0 && `(${availableIngredients.length})`}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.map((row) => {
              const options = getOptionsForRow(row.id, row.ingredient_id);
              return (
                <div key={row.id} className="flex gap-3 items-end border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Produto</Label>
                    <select 
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-medium"
                      value={row.ingredient_id}
                      onChange={(e) => updateRow(row.id, "ingredient_id", e.target.value)}
                    >
                      {options.map(ing => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} (R$ {ing.cost_per_kg.toFixed(2)}/kg)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">%</Label>
                    <input
                      type="number"
                      value={row.percentage}
                      onChange={(e) => updateRow(row.id, "percentage", e.target.value)}
                      placeholder="0"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center font-bold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive h-10 w-10" 
                    onClick={() => removeRow(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            {rows.length === 0 && (
              <p className="text-center text-muted-foreground py-4 text-sm italic">Clique em adicionar para começar a misturar.</p>
            )}
          </CardContent>
        </Card>

        {/* Resumo de Custo e Nutrição */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className={`border-l-4 ${Math.abs(totalPercentage - 100) < 0.1 ? 'border-l-primary bg-primary/5' : 'border-l-warning bg-warning/5'}`}>
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div className="flex items-center gap-4 mb-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${Math.abs(totalPercentage - 100) < 0.1 ? 'bg-primary text-primary-foreground' : 'bg-warning text-warning-foreground'}`}>
                  <Calculator className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium opacity-80">Custo da Mistura</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black">R$ {costPerKg.toFixed(2)}</span>
                    <span className="text-sm font-bold text-muted-foreground">por kg</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-end border-t pt-4">
                <div>
                   <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Total Mistura</p>
                   <div className={`text-2xl font-black ${Math.abs(totalPercentage - 100) < 0.1 ? 'text-primary' : 'text-warning'}`}>
                    {totalPercentage.toFixed(1)}%
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">Deve somar 100%</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 bg-blue-50/30">
            <CardContent className="p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-3">Análise Nutricional Projetada</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Proteína (PB)</p>
                  <p className="text-lg font-black text-blue-700">{nutriTotals.pb.toFixed(1)}%</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Energia (NDT)</p>
                  <p className="text-lg font-black text-amber-600">{nutriTotals.ndt.toFixed(1)}%</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Fibra (FDN)</p>
                  <p className="text-lg font-black text-emerald-600">{nutriTotals.fdn.toFixed(1)}%</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Cálcio (Ca)</p>
                  <p className="text-lg font-black text-slate-700">{nutriTotals.ca.toFixed(2)}%</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Fósforo (P)</p>
                  <p className="text-lg font-black text-slate-700">{nutriTotals.p.toFixed(2)}%</p>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Relação Ca:P</p>
                  <p className="text-lg font-black text-slate-700">
                    {nutriTotals.p > 0 ? (nutriTotals.ca / nutriTotals.p).toFixed(1) : '—'}:1
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Button type="submit" className="w-full py-8 text-xl font-bold shadow-xl shadow-primary/20" size="lg">
          {id ? "Salvar Alterações" : "Finalizar Ração"}
        </Button>
      </form>
    </div>
  );
}
