import { useState, useEffect } from "react";
import { store, Ingredient } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wheat, Plus, Trash2, Pencil, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import PurchaseForm from "@/components/PurchaseForm";

export default function Ingredients() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "Energia", cost_per_kg: 0, unit: "kg" });
  const [showPurchase, setShowPurchase] = useState(false);
  const navigate = useNavigate();

  const loadData = async () => {
    setIngredients(await store.getIngredients());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;

    if (editingId) {
      await store.updateIngredient(editingId, form);
      toast.success("Produto atualizado!");
    } else {
      await store.addIngredient(form);
      toast.success("Produto cadastrado!");
    }

    setForm({ name: "", type: "Energia", cost_per_kg: 0, unit: "kg" });
    setEditingId(null);
    loadData();
  };

  const handleEdit = (i: Ingredient) => {
    setEditingId(i.id);
    setForm({ name: i.name, type: i.type, cost_per_kg: i.cost_per_kg, unit: i.unit });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Deseja excluir este produto?")) {
      await store.deleteIngredient(id);
      loadData();
      toast.info("Produto removido");
    }
  };

  return (
    <div className="p-4 pb-20 animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Insumos</h1>
          <p className="text-sm text-muted-foreground">Gestão de matérias-primas e custos</p>
        </div>
        <div className="flex gap-2">
           <Button className="font-bold shadow-md" onClick={() => setShowPurchase(!showPurchase)}>
            <PackagePlus className="mr-2 h-4 w-4" /> Registrar Compra
          </Button>
          <Button variant="ghost" className="text-muted-foreground" onClick={() => navigate("/rations")}>Voltar</Button>
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

      <Card className={editingId ? "border-primary ring-1 ring-primary/20 shadow-md" : ""}>
        <CardHeader>
          <CardTitle className="text-lg">{editingId ? "Editar Produto" : "Novo Produto"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Milho Grão" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={form.type} 
                onChange={e => setForm({ ...form, type: e.target.value })}
              >
                <option value="Energia">Energia</option>
                <option value="Proteína">Proteína</option>
                <option value="Mineral">Mineral</option>
                <option value="Núcleo">Núcleo</option>
                <option value="Volumoso">Volumoso</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Custo / kg (R$)</Label>
              <Input type="number" step="0.01" value={form.cost_per_kg || ""} onChange={e => setForm({ ...form, cost_per_kg: Number(e.target.value) })} placeholder="0.00" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 h-10 font-bold">
                {editingId ? "Atualizar" : "Cadastrar"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm({ name: "", type: "Energia", cost_per_kg: 0, unit: "kg" }); }}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {ingredients.length === 0 ? (
          <p className="text-center text-muted-foreground py-10 italic">Nenhum produto cadastrado.</p>
        ) : (
          ingredients.map(i => (
            <Card key={i.id} className="overflow-hidden group hover:border-primary/40 transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Wheat className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold">{i.name}</h3>
                    <p className="text-xs text-muted-foreground">{i.type} • R$ {i.cost_per_kg.toFixed(2)}/kg</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(i)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(i.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
