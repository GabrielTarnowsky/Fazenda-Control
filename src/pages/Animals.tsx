import { useEffect, useState } from "react";
import { store, Animal } from "@/lib/store";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Plus, ChevronRight, Filter, Users, Weight, TrendingUp, Calendar, Info, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function Animals() {
  const [searchParams] = useSearchParams();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [search, setSearch] = useState("");
  const [selectedLote, setSelectedLote] = useState<string | null>(searchParams.get("lote") || null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await store.getAnimals();
      setAnimals(data);
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    const loteParam = searchParams.get("lote");
    if (loteParam) {
      setSelectedLote(loteParam);
    }
  }, [searchParams]);

  const lotes = Array.from(new Set(animals.filter(a => a.status === "ativo").map(a => a.lote_id || "Sem Lote"))).sort();

  const filtered = animals.filter(a =>
    a.tag.toLowerCase().includes(search.toLowerCase()) &&
    (!selectedLote || (a.lote_id || "Sem Lote") === selectedLote)
  );

  const activeAnimals = animals.filter(a => a.status === "ativo");
  const totalWeight = activeAnimals.reduce((acc, a) => acc + (a.weight || 0), 0);
  const avgWeight = activeAnimals.length > 0 ? totalWeight / activeAnimals.length : 0;

  const handleDelete = async (e: React.MouseEvent, id: string, tag: string) => {
    e.stopPropagation();
    if (window.confirm(`Tem certeza que deseja excluir o animal brinco ${tag}? Esta ação não pode ser desfeita e removerá todo o histórico dele.`)) {
      await store.deleteAnimal(id);
      const data = await store.getAnimals();
      setAnimals(data);
      toast.success("Animal removido com sucesso");
    }
  };

  const getDisplayWeight = (animal: Animal) => {
    if (animal.status === "vendido") {
      return (animal.peso_saida || animal.weight) * 2;
    }
    return animal.weight;
  };

  const renderAnimalCard = (animal: Animal) => (
    <Card 
      key={animal.id}
      onClick={() => navigate(`/animals/${animal.id}`)}
      className="overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-2xl transition-all active:scale-[0.98] border-none bg-card shadow-xl group relative"
    >
      <button 
        onClick={(e) => handleDelete(e, animal.id, animal.tag)}
        className="absolute top-2 right-2 p-2 rounded-lg bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground z-10"
        title="Excluir Animal"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <CardContent className="p-0">
        <div className="flex items-center p-4 gap-4">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg ${animal.sex === 'Macho' ? 'bg-blue-500/10 text-blue-600' : 'bg-pink-500/10 text-pink-600'}`}>
            {animal.tag.slice(-2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <h3 className="font-bold text-base truncate">brinco {animal.tag}</h3>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider py-0 px-2 h-5 mr-6">
                {animal.lote_id || "Sem Lote"}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Weight className="h-3.5 w-3.5" /> {getDisplayWeight(animal)}kg {animal.status === "vendido" && "(Vivo)"}
              </span>
              <span className="flex items-center gap-1">
                <Info className="h-3.5 w-3.5" /> {animal.breed}
              </span>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <div className="bg-muted/30 px-4 py-2 flex justify-between items-center text-[10px] uppercase font-bold tracking-tight text-muted-foreground border-t border-muted/40">
           <span>{animal.categoria}</span>
           <span>{animal.status === 'ativo' ? 'No Pasto' : animal.status}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 pb-24 animate-fade-in space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Meu Rebanho</h1>
            <p className="text-sm text-muted-foreground font-medium">Gerencie seus animais e lotes</p>
          </div>
          <button 
            onClick={() => navigate("/animals/new")} 
            className="h-10 w-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        {/* Summary horizontal bar */}
        <div className="grid grid-cols-1 gap-3">
          <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] uppercase font-black text-muted-foreground leading-none mb-1.5 tracking-wider">Total de Animais Ativos</p>
              <p className="text-3xl font-black leading-none text-primary">{activeAnimals.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters section */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por brinco ou raça..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-11 bg-card border-muted/60"
          />
        </div>

        {lotes.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground mr-1" />
              <Badge 
                variant={selectedLote === null ? "default" : "outline"}
                className={`cursor-pointer whitespace-nowrap px-4 py-1.5 text-xs font-bold rounded-full transition-all ${selectedLote === null ? '' : 'border-muted-foreground/30 text-muted-foreground'}`}
                onClick={() => setSelectedLote(null)}
              >
                Todos
              </Badge>
              {lotes.map(lote => (
                <Badge 
                  key={lote}
                  variant={selectedLote === lote ? "default" : "outline"}
                  className={`cursor-pointer whitespace-nowrap px-4 py-1.5 text-xs font-bold rounded-full transition-all ${selectedLote === lote ? '' : 'border-muted-foreground/30 text-muted-foreground'}`}
                  onClick={() => setSelectedLote(lote)}
                >
                  {lote}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* List section */}
      <Tabs defaultValue="ativo" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6 rounded-xl border border-muted/60 h-11 grid grid-cols-2">
          <TabsTrigger 
            value="ativo" 
            className="rounded-lg font-bold text-xs uppercase transition-all data-[state=active]:bg-success/15 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm"
          >
            Ativos no Pasto
          </TabsTrigger>
          <TabsTrigger 
            value="outros" 
            className="rounded-lg font-bold text-xs uppercase transition-all data-[state=active]:bg-destructive/15 data-[state=active]:text-destructive data-[state=active]:shadow-sm"
          >
            Vendidos/Mortos
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="ativo" className="mt-0">
          {loading ? (
            <div className="py-20 text-center">Carregando animais...</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.filter(a => a.status === "ativo").map(animal => renderAnimalCard(animal))}
              {filtered.filter(a => a.status === "ativo").length === 0 && (
                <div className="col-span-full py-12 text-center flex flex-col items-center gap-2">
                  <div className="h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center text-muted-foreground/40">
                    <TrendingUp className="h-8 w-8" />
                  </div>
                  <p className="text-muted-foreground font-medium">Nenhum animal ativo encontrado</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="outros" className="mt-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.filter(a => a.status === "vendido" || a.status === "morto").map(animal => renderAnimalCard(animal))}
            {filtered.filter(a => a.status === "vendido" || a.status === "morto").length === 0 && (
              <div className="col-span-full py-12 text-center flex flex-col items-center gap-2">
                <div className="h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center text-muted-foreground/40">
                  <Calendar className="h-8 w-8" />
                </div>
                <p className="text-muted-foreground font-medium">Nenhum histórico encontrado</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
