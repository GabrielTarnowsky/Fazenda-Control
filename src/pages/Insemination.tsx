import { useEffect, useState, useMemo } from "react";
import { store, Animal, Insemination } from "@/lib/store";
import { Plus, Search, Calendar, Baby, Activity, AlertCircle, ChevronRight, CheckCircle2, XCircle, Clock, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function InseminationPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [inseminations, setInseminations] = useState<Insemination[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [bull, setBull] = useState("");
  const [status, setStatus] = useState<any>("aguardando");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const allAnimals = await store.getAnimals();
      setAnimals(allAnimals.filter(a => a.sex?.toLowerCase() === "fêmea" || a.sex?.toLowerCase() === "femea"));
      setInseminations(await store.getInseminations());
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimalId || !bull || !date) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Gestaçāo média: 283 dias
    const estBirth = addDays(new Date(date), 283).toISOString().split("T")[0];

    await store.addInsemination({
      animal_id: selectedAnimalId,
      date,
      bull,
      status,
      observation: notes,
      estimated_birth: estBirth
    });

    setInseminations(await store.getInseminations());
    setShowForm(false);
    toast.success("Inseminação registrada com sucesso!");
    // Reset form
    setSelectedAnimalId("");
    setBull("");
    setNotes("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "prenha": return <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Prenha</Badge>;
      case "vazia": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Vazia</Badge>;
      case "aborto": return <Badge variant="outline" className="text-rose-500 border-rose-200"><AlertCircle className="h-3 w-3 mr-1" /> Aborto</Badge>;
      default: return <Badge variant="secondary" className="bg-slate-200"><Clock className="h-3 w-3 mr-1" /> Aguardando</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Inseminação e Reprodução</h1>
          <p className="text-muted-foreground mt-1">Gerencie o ciclo reprodutivo das suas matrizes</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="font-bold">
          {showForm ? "Cancelar" : <><Plus className="mr-2 h-4 w-4" /> Nova Inseminação</>}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20 shadow-lg animate-in slide-in-from-top-4 duration-300">
          <CardHeader>
            <CardTitle className="text-lg">Registrar Nova Cobertura/Inseminação</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold">Matriz (Vaca)</label>
                <Select value={selectedAnimalId} onValueChange={setSelectedAnimalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a vaca" />
                  </SelectTrigger>
                  <SelectContent>
                    {animals.map(a => (
                      <SelectItem key={a.id} value={a.id}>Brinco {a.tag} - {a.breed}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">Data</label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">Touro / Sêmen</label>
                <Input placeholder="Nome ou ID do touro" value={bull} onChange={e => setBull(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">Status Inicial</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aguardando">Aguardando Toque</SelectItem>
                    <SelectItem value="prenha">Confirmada Prenha</SelectItem>
                    <SelectItem value="vazia">Vazia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-4 space-y-2 mt-2">
                <label className="text-sm font-bold">Observações</label>
                <Input placeholder="Alguma observação importante..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <div className="lg:col-span-4 flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Descartar</Button>
                <Button type="submit" className="px-8">Salvar Registro</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        {/* Próximos Partos (Cards) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Baby className="h-5 w-5 text-primary" />
              Histórico de Inseminações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inseminations.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground italic">Nenhuma inseminação registrada.</div>
              ) : (
                inseminations.sort((a,b) => b.date.localeCompare(a.date)).map(ins => {
                  const cow = animals.find(a => a.id === ins.animal_id);
                  return (
                    <div key={ins.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                           <Activity className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black italic">Vaca {cow?.tag || "N/A"}</h3>
                            {getStatusBadge(ins.status)}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1 font-medium">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(ins.date), "dd/MM/yyyy")}</span>
                            <span className="flex items-center gap-1"><Target className="h-3 w-3" /> Touro: {ins.bull}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {ins.status === "prenha" && ins.estimated_birth && (
                          <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">Previsão de Parto</p>
                            <p className="font-black text-emerald-700 text-sm italic">{format(new Date(ins.estimated_birth), "MMMM / yyyy", { locale: ptBR })}</p>
                          </div>
                        )}
                        {!ins.status || ins.status === "aguardando" && (
                           <Button variant="ghost" size="sm" className="text-xs font-bold" onClick={async () => {
                             await store.updateInsemination(ins.id, { status: "prenha" });
                             setInseminations(await store.getInseminations());
                             toast.success("Status atualizado para PRENHA!");
                           }}>
                             Confirmar Prenhez <ChevronRight className="ml-1 h-3 w-3" />
                           </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resumo Reprodutivo */}
        <Card className="h-fit sticky top-6">
          <CardHeader>
            <CardTitle>Status Reprodutivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-between items-end border-b pb-4">
               <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Confirmadas</p>
                  <p className="text-3xl font-black italic">{inseminations.filter(i => i.status === "prenha").length}</p>
               </div>
               <Badge className="bg-emerald-500 mb-1">Prenhas</Badge>
            </div>
            <div className="flex justify-between items-end border-b pb-4">
               <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Em Aberto</p>
                  <p className="text-3xl font-black italic">{inseminations.filter(i => i.status === "aguardando").length}</p>
               </div>
               <Badge variant="secondary" className="mb-1">Aguardando</Badge>
            </div>
            
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
               <h4 className="text-xs font-black uppercase text-primary mb-2 flex items-center gap-2">
                 <AlertCircle className="h-3 w-3" /> Atenção ao Manejo
               </h4>
               <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                 O período médio de gestação é de <span className="text-primary font-bold">283 dias</span>. O sistema calcula automaticamente a previsão de parto com base na data da inseminação.
               </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
