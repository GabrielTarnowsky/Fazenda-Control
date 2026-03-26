import React, { useState, useEffect } from "react";
import { store, Ingredient } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wheat } from "lucide-react";
import { toast } from "sonner";

interface PurchaseFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function PurchaseForm({ onSuccess, onCancel }: PurchaseFormProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [form, setForm] = useState({ 
    ingredient_id: "", 
    total_value: 0, 
    total_qty_kg: 0, 
    payment_method: "Pix",
    date: new Date().toISOString().split("T")[0]
  });

  useEffect(() => {
    const load = async () => {
      const list = await store.getIngredients();
      setIngredients(list);
      if (list.length > 0) setForm(p => ({ ...p, ingredient_id: list[0].id }));
    };
    load();
  }, []);

  const handleRegisterPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ingredient_id || form.total_value <= 0 || form.total_qty_kg <= 0) {
      toast.error("Preencha todos os campos da compra");
      return;
    }

    const new_cost_per_kg = form.total_value / form.total_qty_kg;
    
    await store.addIngredientPurchase({
      ingredient_id: form.ingredient_id,
      total_value: form.total_value,
      total_qty_kg: form.total_qty_kg,
      cost_per_kg: new_cost_per_kg,
      payment_method: form.payment_method,
      date: form.date
    } as any);

    toast.success(`Compra registrada! Novo custo: R$ ${new_cost_per_kg.toFixed(2)}/kg`);
    setForm({ ...form, total_value: 0, total_qty_kg: 0, date: new Date().toISOString().split("T")[0] });
    if (onSuccess) onSuccess();
  };

  return (
    <Card className="border-primary bg-primary/5 animate-in slide-in-from-top duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wheat className="h-5 w-5 text-primary" /> Registrar Compra de Insumo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegisterPurchase} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Data</Label>
            <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="h-11 font-bold" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Produto</Label>
            <select 
              className="w-full h-11 px-3 rounded-md border border-input bg-background font-medium"
              value={form.ingredient_id}
              onChange={e => setForm({ ...form, ingredient_id: e.target.value })}
            >
              {ingredients.length === 0 && <option>Cadastre os insumos primeiro</option>}
              {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Valor Total (R$)</Label>
            <Input type="number" step="0.01" value={form.total_value || ""} onChange={e => setForm({ ...form, total_value: Number(e.target.value) })} placeholder="0.00" className="h-11 font-bold" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Quantidade (kg)</Label>
            <Input type="number" step="0.1" value={form.total_qty_kg || ""} onChange={e => setForm({ ...form, total_qty_kg: Number(e.target.value) })} placeholder="0" className="h-11 font-bold" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Pagamento</Label>
            <select 
              className="w-full h-11 px-3 rounded-md border border-input bg-background font-medium"
              value={form.payment_method}
              onChange={e => setForm({ ...form, payment_method: e.target.value })}
            >
              <option value="Pix">Pix</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="Boleto">Boleto</option>
              <option value="Dinheiro">Dinheiro</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 h-11 font-bold shadow-lg">Confirmar</Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} className="h-11 font-bold">Cancelar</Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
