import React, { useState, useEffect } from "react";
import { store } from "@/lib/store";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function AddEvent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const animalIdFromParam = params.get("animal") || "";
  const preType = params.get("type") || "vacina";

  const [form, setForm] = useState({
    type: preType,
    date: new Date().toISOString().split("T")[0],
    weight: 0,
    value: 0,
    description: "",
    animal_id: animalIdFromParam,
    payment_method: "Pix"
  });
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (id) {
      const event = store.getEvent(id);
      if (event) {
        setForm({
          type: event.type || "vacina",
          date: event.date || new Date().toISOString().split("T")[0],
          weight: event.weight || 0,
          value: event.value || 0,
          description: event.description || "",
          animal_id: event.animal_id || "",
          payment_method: (event as any).payment_method || "Pix"
        });
        setLoading(false);
      } else {
        toast.error("Evento não encontrado");
        navigate(-1);
      }
    }
  }, [id, navigate]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.animal_id) { toast.error("Animal não identificado"); return; }
    
    if (id) {
      store.updateEvent(id, form);
    } else {
      store.addEvent(form);
    }

    // If vacina, also add health record
    if (form.type === "vacina" && !id) {
      const nextDate = new Date(form.date);
      nextDate.setMonth(nextDate.getMonth() + 6);
      store.addHealth({
        animal_id: form.animal_id,
        type: form.description || "Vacina",
        date: form.date,
        next_date: nextDate.toISOString().split("T")[0],
      });
    }

    // If venda, add financial record
    if (form.type === "venda" && form.value > 0 && !id && form.animal_id) {
      store.addFinancial({
        type: "receita",
        category: "Venda de Animais",
        payment_method: form.payment_method,
        description: `Venda animal ${form.animal_id.slice(0, 8)}`,
        value: form.value,
        date: form.date,
        animal_id: form.animal_id,
      });
    }

    toast.success(id ? "Evento atualizado!" : "Evento registrado!");
    navigate(-1);
  };

  return (
    <div className="p-4 pb-20 animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <h1 className="font-display text-xl font-bold mb-6">{id ? "Editar Evento" : "Novo Evento"}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vacina">Vacina</SelectItem>
              <SelectItem value="pesagem">Pesagem</SelectItem>
              <SelectItem value="venda">Venda</SelectItem>
              <SelectItem value="morte">Morte</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Data</Label>
          <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        {(form.type === "pesagem" || form.type === "venda") && (
          <div>
            <Label>Peso (kg)</Label>
            <Input type="number" value={form.weight || ""} onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))} />
          </div>
        )}
        {(form.type === "venda") && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" value={form.value || ""} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Forma de Recebimento</Label>
              <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pix">Pix</SelectItem>
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div>
          <Label>Descrição</Label>
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Observações..." />
        </div>
        <Button type="submit" className="w-full" size="lg">
          {id ? "Atualizar Evento" : "Salvar Evento"}
        </Button>
      </form>
    </div>
  );
}
