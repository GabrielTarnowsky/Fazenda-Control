import { useState, useEffect, useMemo } from "react";
import { store, Ingredient, RationProduct } from "@/lib/store";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, Calculator } from "lucide-react";
import { toast } from "sonner";

export default function AddRation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [name, setName] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<RationProduct[]>([]);

  useEffect(() => {
    const load = async () => {
      const ings = await store.getIngredients();
      setIngredients(ings);
      if (id) {
        const allRats = await store.getRations();
        const ration = allRats.find(r => r.id === id);
        if (ration) {
          setName(ration.name);
          setSelectedProducts(ration.products);
        }
      }
    };
    load();
  }, [id]);

  const totalPercentage = useMemo(() => {
    return selectedProducts.reduce((acc, p) => acc + p.percentage, 0);
  }, [selectedProducts]);

  const costPerKg = useMemo(() => {
    return selectedProducts.reduce((acc, p) => {
      const ing = ingredients.find(i => i.id === p.ingredient_id);
      if (!ing) return acc;
      return acc + (ing.cost_per_kg * (p.percentage / 100));
    }, 0);
  }, [selectedProducts, ingredients]);

  const handleAddIngredient = () => {
    if (ingredients.length === 0) {
      toast.error("Cadastre ingredientes primeiro!");
      return;
    }
    setSelectedProducts([...selectedProducts, { ingredient_id: ingredients[0].id, percentage: 0 }]);
  };

  const handleUpdateProduct = (index: number, field: keyof RationProduct, value: string | number) => {
    const newList = [...selectedProducts];
    newList[index] = { ...newList[index], [field]: field === 'percentage' ? Number(value) : value };
    setSelectedProducts(newList);
  };

  const handleRemoveProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { toast.error("Informe o nome da ração"); return; }
    if (selectedProducts.length === 0) { toast.error("Adicione ao menos um ingrediente"); return; }
    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast.error(`A soma deve ser 100% (Atual: ${totalPercentage}%)`);
      return;
    }

    const rationData = {
      name,
      products: selectedProducts,
      cost_per_kg: costPerKg
    };

    if (id) {
      await store.updateRation(id, rationData);
      toast.success("Ração atualizada!");
    } else {
      await store.addRation(rationData);
      toast.success("Ração criada com sucesso!");
    }
    navigate("/rations");
  };

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
            <Button type="button" size="sm" onClick={handleAddIngredient} className="gap-2">
              <Plus className="h-4 w-4" /> Add Ingrediente
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedProducts.map((p, idx) => (
              <div key={idx} className="flex gap-3 items-end border-b pb-4 last:border-0 last:pb-0">
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Produto</Label>
                  <select 
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={p.ingredient_id}
                    onChange={(e) => handleUpdateProduct(idx, "ingredient_id", e.target.value)}
                  >
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>{ing.name} (R$ {ing.cost_per_kg.toFixed(2)}/kg)</option>
                    ))}
                  </select>
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Porcentagem %</Label>
                  <Input 
                    type="number" 
                    value={p.percentage || ""} 
                    onChange={(e) => handleUpdateProduct(idx, "percentage", e.target.value)}
                    placeholder="0"
                    className="text-center font-bold"
                  />
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive h-10 w-10" 
                  onClick={() => handleRemoveProduct(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {selectedProducts.length === 0 && (
              <p className="text-center text-muted-foreground py-4 text-sm italic">Clique em adicionar para começar a misturar.</p>
            )}
          </CardContent>
        </Card>

        {/* Resumo de Custo */}
        <Card className={`border-l-4 ${Math.abs(totalPercentage - 100) < 0.1 ? 'border-l-primary bg-primary/5' : 'border-l-warning bg-warning/5'}`}>
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${Math.abs(totalPercentage - 100) < 0.1 ? 'bg-primary text-primary-foreground' : 'bg-warning text-warning-foreground'}`}>
                <Calculator className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium opacity-80">Custo calculado da Mistura</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black">R$ {costPerKg.toFixed(2)}</span>
                  <span className="text-sm font-bold text-muted-foreground">por kg</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-1">Total da Mistura</p>
              <div className={`text-2xl font-black ${Math.abs(totalPercentage - 100) < 0.1 ? 'text-primary' : 'text-warning'}`}>
                {totalPercentage}%
              </div>
              <p className="text-[10px] text-muted-foreground">Deve somar 100%</p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full py-8 text-xl font-bold shadow-xl shadow-primary/20" size="lg">
          {id ? "Salvar Alterações" : "Finalizar Ração"}
        </Button>
      </form>
    </div>
  );
}
