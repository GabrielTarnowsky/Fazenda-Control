import { useState, useEffect } from "react";
import { store, Animal } from "@/lib/store";
import { useNavigate, useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const BREEDS = [
  "Nelore", 
  "Tabapuã", 
  "Gabiru", 
  "Cruzamento Industrial", 
  "Sindi", 
  "Senepol", 
  "Angus", 
  "Outra"
];

export default function AddAnimal() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [animals_list, setAnimalsList] = useState<Animal[]>([]);
  const [useExistingLote, setUseExistingLote] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    tag: "", sex: "Macho", breed: "Nelore", birth_date: "", weight: 0, categoria: "Bezerro",
    origem: "Nascimento", data_compra: "", valor_compra: "", lote_id: "", preco_arroba: "",
    peso_entrada: "", peso_saida: "", matriz_id: "", payment_method: "Pix"
  });

  useEffect(() => {
    const loadData = async () => {
      const all = await store.getAnimals();
      setAnimalsList(all);
      
      if (id) {
        const animal = all.find(a => a.id === id);
        if (animal) {
          setForm({
            tag: animal.tag || "",
            sex: animal.sex || "Macho",
            breed: animal.breed || "",
            birth_date: animal.birth_date || "",
            weight: animal.weight || 0,
            categoria: animal.categoria || "Bezerro",
            origem: animal.origem || "Nascimento",
            data_compra: animal.data_compra || "",
            valor_compra: animal.valor_compra ? animal.valor_compra.toString() : "",
            preco_arroba: animal.preco_arroba ? animal.preco_arroba.toString() : "",
            peso_entrada: animal.peso_entrada ? animal.peso_entrada.toString() : "",
            peso_saida: animal.peso_saida ? animal.peso_saida.toString() : "",
            lote_id: animal.lote_id || (animal as any).lot || "",
            matriz_id: animal.matriz_id || "",
          } as any);
        }
      }
    };
    loadData();
  }, [id]);

  const females = animals_list
    .filter(a => a.sex?.toLowerCase() === "fêmea" || a.sex?.toLowerCase() === "femea")
    .sort((a, b) => a.tag.localeCompare(b.tag));

  const existingLots = Array.from(new Set(animals_list.map(a => a.lote_id).filter(Boolean))) as string[];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tag) { toast.error("Informe o brinco"); return; }
    
    const pesoEntrada = Number(form.peso_entrada) || Number(form.weight) || 0;
    const animalData = { 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(form as any), 
      weight: Number(form.weight) || pesoEntrada,
      valor_compra: Number(form.valor_compra) || 0,
      preco_arroba: Number(form.preco_arroba) || 0,
      peso_entrada: pesoEntrada,
      peso_saida: Number(form.peso_saida) || 0,
      status: "ativo" 
    };

    setSubmitting(true);
    try {
      if (id) {
        await store.updateAnimal(id, animalData);
        toast.success("Animal atualizado com sucesso!");
        navigate(`/animals/${id}`);
      } else {
        const newAnimal = await store.addAnimal(animalData);

        if (form.origem === "Compra" && (Number(form.valor_compra) || 0) > 0) {
          await store.addFinancial({
            type: "despesa",
            description: `Compra de Animal - Brinco ${form.tag}`,
            category: "Compra de Animais",
            payment_method: form.payment_method,
            value: Number(form.valor_compra),
            date: form.data_compra || new Date().toISOString().split("T")[0],
            animal_id: newAnimal.id
          });
        }

        // Adicionar evento de pesagem inicial para garantir histórico de ganho
        if (pesoEntrada > 0) {
          await store.addEvent({
            animal_id: newAnimal.id,
            type: "pesagem",
            date: form.data_compra || form.birth_date || new Date().toISOString().split("T")[0],
            description: "Peso Inicial (Cadastro)",
            weight: pesoEntrada,
            value: 0
          });
        }

        toast.success("Animal cadastrado!");
        navigate("/animals");
      }
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error("Falha ao salvar: " + (error.message || "Erro desconhecido"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 pb-20 animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <h1 className="font-display text-xl font-bold mb-6">{id ? "Editar Animal" : "Adicionar Animal"}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-bold">Brinco *</Label>
            <Input value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} placeholder="001" className="h-11 text-lg font-bold" />
          </div>
          <div className="space-y-2">
            <Label className="font-bold">Origem</Label>
            <Select value={form.origem} onValueChange={v => setForm(f => ({ ...f, origem: v }))}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Nascimento">Nascimento</SelectItem>
                <SelectItem value="Compra">Compra</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.origem === "Compra" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-primary">Data da Compra</Label>
              <Input type="date" value={form.data_compra} onChange={e => setForm(f => ({ ...f, data_compra: e.target.value }))} className="h-10 bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-primary">Valor Investido (R$)</Label>
              <Input type="number" value={form.valor_compra} onChange={e => setForm(f => ({ ...f, valor_compra: e.target.value }))} placeholder="0.00" className="h-10 bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-primary">Forma de Pagamento</Label>
              <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger className="h-10 bg-background"><SelectValue /></SelectTrigger>
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

        {form.origem === "Nascimento" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-primary">Data de Nascimento</Label>
              <Input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} className="h-10 bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-primary">Matriz (Mãe)</Label>
              <Select value={form.matriz_id} onValueChange={v => setForm(f => ({ ...f, matriz_id: v }))}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Selecione a mãe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem Matriz</SelectItem>
                  {females.map(f => (
                    <SelectItem key={f.id} value={f.id}>Brinco {f.tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Sexo</Label>
            <Select value={form.sex} onValueChange={v => setForm(f => ({ ...f, sex: v, categoria: v === "Macho" ? "Bezerro" : "Bezerra" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Macho">Macho</SelectItem>
                <SelectItem value="Fêmea">Fêmea</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {form.sex === "Macho" ? (
                  <>
                    <SelectItem value="Bezerro">Bezerro</SelectItem>
                    <SelectItem value="Garrote">Garrote</SelectItem>
                    <SelectItem value="Boi Magro">Boi Magro</SelectItem>
                    <SelectItem value="Reprodutor/Touro">Reprodutor/Touro</SelectItem>
                    <SelectItem value="Boi Gordo">Boi Gordo</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="Bezerra">Bezerra</SelectItem>
                    <SelectItem value="Novilha">Novilha</SelectItem>
                    <SelectItem value="Vaca">Vaca</SelectItem>
                    <SelectItem value="Doadora">Doadora</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex justify-between items-center">
              Lote 
              {existingLots.length > 0 && (
                <button type="button" onClick={() => setUseExistingLote(!useExistingLote)} className="text-[10px] text-primary hover:underline font-black uppercase">
                  {useExistingLote ? "Criar Novo" : "Ver Existentes"}
                </button>
              )}
            </Label>
            {useExistingLote && existingLots.length > 0 ? (
              <Select value={form.lote_id} onValueChange={v => setForm(f => ({ ...f, lote_id: v }))}>
                <SelectTrigger className="h-10 bg-background"><SelectValue placeholder="Selecione o lote" /></SelectTrigger>
                <SelectContent>
                  {existingLots.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.lote_id} onChange={e => setForm(f => ({ ...f, lote_id: e.target.value }))} placeholder="Nome do novo lote" className="h-10" />
            )}
          </div>
          <div className="space-y-2">
            <Label>Raça</Label>
            <Select value={BREEDS.includes(form.breed) ? form.breed : "Outra"} onValueChange={v => setForm(f => ({ ...f, breed: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BREEDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            {!BREEDS.includes(form.breed) && (
              <Input 
                value={form.breed} 
                onChange={e => setForm(f => ({ ...f, breed: e.target.value }))} 
                placeholder="Qual raça?" 
                className="mt-2 text-xs h-8"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-bold flex items-center gap-1">
               Peso de Entrada <span className="text-[10px] text-muted-foreground">(kg)</span>
            </Label>
            <Input type="number" value={form.peso_entrada} onChange={e => setForm(f => ({ ...f, peso_entrada: e.target.value }))} placeholder="200" className="border-primary/30" />
          </div>
          <div className="space-y-2">
            <Label>Preço do Kg/V <span className="text-[10px] text-muted-foreground">(R$)</span></Label>
            <Input type="number" value={form.preco_arroba} onChange={e => setForm(f => ({ ...f, preco_arroba: e.target.value }))} placeholder="300" />
          </div>
        </div>

        <Button type="submit" className="w-full shadow-lg" size="lg" disabled={submitting}>
          {submitting ? "Processando..." : (id ? "Atualizar Animal" : "Salvar Animal")}
        </Button>
      </form>
    </div>
  );
}
