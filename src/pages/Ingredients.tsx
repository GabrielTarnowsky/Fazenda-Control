import { useState, useEffect } from "react";
import { store, Ingredient } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wheat, Plus, Trash2, Pencil, PackagePlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import PurchaseForm from "@/components/PurchaseForm";

import { findNutriReference } from "@/lib/nutriReference";

export default function Ingredients() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "Energia", cost_per_kg: 0, unit: "kg", pb: 0, ndt: 0, fdn: 0, ca: 0, p: 0 });
  const [showPurchase, setShowPurchase] = useState(false);
  const navigate = useNavigate();

  const loadData = async () => {
    setIngredients(await store.getIngredients());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-preencher dados nutricionais quando o nome muda
  const handleNameChange = (newName: string) => {
    setForm(prev => {
      const ref = findNutriReference(newName);
      if (ref && !editingId) {
        // Só auto-preenche se estiver criando novo (não editando)
        return { ...prev, name: newName, pb: ref.pb, ndt: ref.ndt, fdn: ref.fdn, ca: ref.ca || 0, p: ref.p || 0, type: ref.type };
      }
      return { ...prev, name: newName };
    });
  };

  // Botão para forçar auto-preenchimento
  const autoFill = () => {
    const ref = findNutriReference(form.name);
    if (ref) {
      setForm(prev => ({ ...prev, pb: ref.pb, ndt: ref.ndt, fdn: ref.fdn, ca: ref.ca || 0, p: ref.p || 0, type: ref.type }));
      toast.success("Valores nutricionais preenchidos automaticamente!");
    } else {
      toast.error("Ingrediente não encontrado na tabela de referência");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;

    const data = {
      name: form.name,
      type: form.type,
      cost_per_kg: form.cost_per_kg,
      unit: form.unit,
      pb: form.pb,
      ndt: form.ndt,
      fdn: form.fdn,
      ca: form.ca,
      p: form.p,
    };

    if (editingId) {
      await store.updateIngredient(editingId, data);
      toast.success("Produto atualizado!");
    } else {
      await store.addIngredient(data);
      toast.success("Produto cadastrado!");
    }

    setForm({ name: "", type: "Energia", cost_per_kg: 0, unit: "kg", pb: 0, ndt: 0, fdn: 0, ca: 0, p: 0 });
    setEditingId(null);
    loadData();
  };

  const handleEdit = (i: Ingredient) => {
    setEditingId(i.id);
    setForm({ 
      name: i.name, 
      type: i.type, 
      cost_per_kg: i.cost_per_kg, 
      unit: i.unit,
      pb: i.pb || 0,
      ndt: i.ndt || 0,
      fdn: i.fdn || 0,
      ca: (i as any).ca || 0,
      p: (i as any).p || 0,
    });
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Linha 1: Nome + Tipo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2 md:col-span-2">
                <Label>Nome do Ingrediente</Label>
                <div className="flex gap-2">
                  <Input 
                    value={form.name} 
                    onChange={e => handleNameChange(e.target.value)} 
                    placeholder="Ex: Milho Grão, Farelo de Soja..." 
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={autoFill} title="Auto-preencher valores nutricionais">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                  </Button>
                </div>
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
            </div>

            {/* Linha 2: Custo + Dados Nutricionais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label>Custo / kg (R$)</Label>
                <Input type="number" step="0.01" value={form.cost_per_kg || ""} onChange={e => setForm({ ...form, cost_per_kg: Number(e.target.value) })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  PB %
                  <span className="text-[9px] text-blue-500 font-bold">(Proteína)</span>
                </Label>
                <Input type="number" step="0.1" value={form.pb || ""} onChange={e => setForm({ ...form, pb: Number(e.target.value) })} placeholder="0" className="border-blue-200 focus-visible:ring-blue-500" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  NDT %
                  <span className="text-[9px] text-amber-500 font-bold">(Energia)</span>
                </Label>
                <Input type="number" step="0.1" value={form.ndt || ""} onChange={e => setForm({ ...form, ndt: Number(e.target.value) })} placeholder="0" className="border-amber-200 focus-visible:ring-amber-500" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  FDN %
                  <span className="text-[9px] text-green-500 font-bold">(Fibra)</span>
                </Label>
                <Input type="number" step="0.1" value={form.fdn || ""} onChange={e => setForm({ ...form, fdn: Number(e.target.value) })} placeholder="0" className="border-green-200 focus-visible:ring-green-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Cálcio (Ca) %
                </Label>
                <Input type="number" step="0.01" value={form.ca || ""} onChange={e => setForm({ ...form, ca: Number(e.target.value) })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Fósforo (P) %
                </Label>
                <Input type="number" step="0.01" value={form.p || ""} onChange={e => setForm({ ...form, p: Number(e.target.value) })} placeholder="0" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1 h-10 font-bold">
                {editingId ? "Atualizar" : "Cadastrar"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm({ name: "", type: "Energia", cost_per_kg: 0, unit: "kg", pb: 0, ndt: 0, fdn: 0, ca: 0, p: 0 }); }}>
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
                <div className="flex items-center gap-4">
                  {/* Tags nutricionais */}
                  <div className="hidden sm:flex items-center gap-2">
                    {(i.pb || 0) > 0 && (
                      <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        PB {i.pb}%
                      </span>
                    )}
                    {(i.ndt || 0) > 0 && (
                      <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        NDT {i.ndt}%
                      </span>
                    )}
                    {(i.fdn || 0) > 0 && (
                      <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        FDN {i.fdn}%
                      </span>
                    )}
                    {((i as any).ca || 0) > 0 && (
                      <span className="text-[9px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        Ca {(i as any).ca}%
                      </span>
                    )}
                    {((i as any).p || 0) > 0 && (
                      <span className="text-[9px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        P {(i as any).p}%
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(i.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
