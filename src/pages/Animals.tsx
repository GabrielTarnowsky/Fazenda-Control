import { useEffect, useState, useMemo } from "react";
import { store, Animal } from "@/lib/store";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  Search, 
  Plus, 
  ChevronRight, 
  Filter, 
  Users, 
  Weight, 
  TrendingUp, 
  Calendar, 
  Info, 
  Trash2, 
  Loader2, 
  Baby, 
  Scale, 
  Sparkles,
  Heart
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

const isCalf = (a: Animal) => {
  const cat = (a.categoria || "").toLowerCase();
  return cat.includes("bezerro") || cat.includes("bezerra") || a.origem === "Nascido na Fazenda" || Boolean(a.matriz_id);
};

const isCow = (a: Animal) => {
  const cat = (a.categoria || "").toLowerCase();
  const sex = (a.sex || "").toLowerCase();
  return (sex === "fêmea" || sex === "femea") && !isCalf(a);
};

const isSteerOrBull = (a: Animal) => {
  const sex = (a.sex || "").toLowerCase();
  return (sex === "macho") && !isCalf(a);
};

export default function Animals() {
  const [searchParams] = useSearchParams();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [search, setSearch] = useState("");
  const [selectedLote, setSelectedLote] = useState<string | null>(searchParams.get("lote") || null);
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get("categoria") || "todos");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Newborn Calf Modal State
  const [showBirthModal, setShowBirthModal] = useState(false);
  const [birthForm, setBirthForm] = useState({
    tag: "",
    birth_date: new Date().toISOString().split("T")[0],
    sex: "Macho",
    weight: "32",
    breed: "Nelore",
    mother_id: "",
    lote_id: "Maternidade",
    father: "",
    notes: "Parto normal"
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await store.getAnimals();
      setAnimals(data);
    } catch (e) {
      toast.error('Erro ao carregar dados. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const loteParam = searchParams.get("lote");
    if (loteParam) {
      setSelectedLote(loteParam);
    }
    const catParam = searchParams.get("categoria");
    if (catParam) {
      setSelectedCategory(catParam);
    }
  }, [searchParams]);

  const lotes = useMemo(() => {
    return Array.from(new Set(animals.filter(a => a.status === "ativo").map(a => a.lote_id || "Sem Lote"))).sort();
  }, [animals]);

  const females = useMemo(() => {
    return animals.filter(a => 
      a.status === "ativo" && 
      (a.sex?.toLowerCase() === "fêmea" || a.sex?.toLowerCase() === "femea")
    );
  }, [animals]);

  const activeAnimals = useMemo(() => animals.filter(a => a.status === "ativo"), [animals]);
  const activeCalves = useMemo(() => activeAnimals.filter(isCalf), [activeAnimals]);
  const activeCows = useMemo(() => activeAnimals.filter(isCow), [activeAnimals]);
  const activeSteers = useMemo(() => activeAnimals.filter(isSteerOrBull), [activeAnimals]);

  const filtered = useMemo(() => {
    return animals.filter(a => {
      const matchesSearch = a.tag.toLowerCase().includes(search.toLowerCase()) ||
        (a.breed && a.breed.toLowerCase().includes(search.toLowerCase())) ||
        (a.categoria && a.categoria.toLowerCase().includes(search.toLowerCase()));

      const matchesLote = !selectedLote || (a.lote_id || "Sem Lote") === selectedLote;

      let matchesCategory = true;
      if (selectedCategory === "bezerros") {
        matchesCategory = isCalf(a);
      } else if (selectedCategory === "vacas") {
        matchesCategory = isCow(a);
      } else if (selectedCategory === "bois") {
        matchesCategory = isSteerOrBull(a);
      }

      return matchesSearch && matchesLote && matchesCategory;
    });
  }, [animals, search, selectedLote, selectedCategory]);

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

  // Cadastrar Bezerro Nascido Diretamente
  const handleRegisterBirth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!birthForm.tag.trim()) {
      toast.error("Informe o brinco do bezerro");
      return;
    }

    const birthWeight = parseFloat(birthForm.weight) || 32;
    const mother = animals.find(a => a.id === birthForm.mother_id);

    try {
      const newAnimal = await store.addAnimal({
        tag: birthForm.tag.trim(),
        birth_date: birthForm.birth_date,
        sex: birthForm.sex,
        breed: birthForm.breed || (mother?.breed || "Nelore"),
        weight: birthWeight,
        peso_entrada: birthWeight,
        status: "ativo",
        categoria: birthForm.sex === "Macho" ? "Bezerro" : "Bezerra",
        origem: "Nascido na Fazenda",
        lote_id: birthForm.lote_id || "Maternidade",
        matriz_id: birthForm.mother_id || undefined,
        valor_compra: 0
      });

      if (newAnimal?.id) {
        await store.addEvent({
          animal_id: newAnimal.id,
          type: "nascimento",
          date: birthForm.birth_date,
          description: `Nascimento de ${birthForm.sex === 'Macho' ? 'Bezerro' : 'Bezerra'} brinco #${birthForm.tag}. ${mother ? `Mãe: vaca #${mother.tag}.` : ''} Peso ao nascer: ${birthWeight} kg. ${birthForm.notes}`,
          value: birthWeight,
          weight: birthWeight
        });
      }

      toast.success(`Bezerro #${birthForm.tag} cadastrado e adicionado à lista de animais com sucesso!`);
      setShowBirthModal(false);
      setBirthForm({
        tag: "",
        birth_date: new Date().toISOString().split("T")[0],
        sex: "Macho",
        weight: "32",
        breed: "Nelore",
        mother_id: "",
        lote_id: "Maternidade",
        father: "",
        notes: "Parto normal"
      });

      await loadData();
      setSelectedCategory("bezerros");
    } catch (err) {
      toast.error("Erro ao registrar nascimento");
    }
  };

  const renderAnimalCard = (animal: Animal) => {
    const isAnimalCalf = isCalf(animal);
    const mother = animal.matriz_id ? animals.find(a => a.id === animal.matriz_id) : null;
    const ageDays = animal.birth_date ? differenceInDays(new Date(), new Date(animal.birth_date)) : null;

    return (
      <Card 
        key={animal.id}
        onClick={() => navigate(`/animals/${animal.id}`)}
        className="overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-xl transition-all active:scale-[0.99] border border-border/70 bg-card shadow-sm group relative"
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
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg ${
              animal.sex === 'Macho' 
                ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' 
                : 'bg-pink-500/10 text-pink-600 border border-pink-500/20'
            }`}>
              {isAnimalCalf ? '🍼' : animal.tag.slice(-2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-bold text-base text-foreground truncate">Brinco #{animal.tag}</h3>
                  {isAnimalCalf && (
                    <Badge className="bg-pink-500/15 text-pink-700 dark:text-pink-300 border-none text-[9px] font-black uppercase px-1.5 h-4">
                      Cria / Bezerro
                    </Badge>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider py-0 px-2 h-5 mr-6 shrink-0">
                  {animal.lote_id || "Sem Lote"}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <Weight className="h-3.5 w-3.5 text-primary" /> 
                  {getDisplayWeight(animal)} kg 
                  <span className="text-muted-foreground font-normal">({(getDisplayWeight(animal) / 15).toFixed(1)} @)</span>
                </span>
                <span className="flex items-center gap-1">
                  <Info className="h-3.5 w-3.5" /> {animal.breed || "Nelore"}
                </span>
                {ageDays !== null && (
                  <span className="text-[11px] text-muted-foreground">
                    · {ageDays} dias ({Math.floor(ageDays / 30.4)}m)
                  </span>
                )}
              </div>

              {mother && (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Heart className="h-3 w-3 text-pink-500" />
                  Mãe: <strong className="text-foreground">Vaca #{mother.tag}</strong>
                </p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:translate-x-0.5 transition-transform" />
          </div>

          <div className="bg-muted/30 px-4 py-2 flex justify-between items-center text-[10px] uppercase font-bold tracking-tight text-muted-foreground border-t border-border/40">
            <span>{animal.categoria || "Rebanho Geral"}</span>
            <span className={animal.status === 'ativo' ? 'text-emerald-600 font-black' : ''}>
              {animal.status === 'ativo' ? 'No Pasto' : animal.status}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-4 pb-24 animate-fade-in space-y-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Meu Rebanho
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Gerencie animais ativos, crias nascidas e histórico da fazenda
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button 
            onClick={() => setShowBirthModal(true)} 
            className="h-10 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Baby className="h-4 w-4" /> + Bezerro Nascido (Parto)
          </Button>

          <Button 
            onClick={() => navigate("/animals/new")} 
            className="h-10 text-xs font-bold gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Novo Animal (Compra)
          </Button>
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div 
          onClick={() => setSelectedCategory("todos")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedCategory === 'todos' 
              ? 'bg-primary/10 border-primary shadow-sm' 
              : 'bg-card border-border/70 hover:border-muted-foreground/40'
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Total Ativos</span>
          <p className="text-2xl font-black text-foreground mt-0.5 tabular-nums">{activeAnimals.length}</p>
          <span className="text-[11px] text-muted-foreground">Animais na propriedade</span>
        </div>

        <div 
          onClick={() => setSelectedCategory("bezerros")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedCategory === 'bezerros' 
              ? 'bg-pink-500/10 border-pink-500 shadow-sm' 
              : 'bg-card border-border/70 hover:border-pink-500/40'
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-pink-600 dark:text-pink-400 block tracking-wider flex items-center gap-1">
            <Baby className="h-3 w-3" /> Bezerros Nascidos
          </span>
          <p className="text-2xl font-black text-pink-600 dark:text-pink-400 mt-0.5 tabular-nums">{activeCalves.length}</p>
          <span className="text-[11px] text-muted-foreground">Crias da fazenda</span>
        </div>

        <div 
          onClick={() => setSelectedCategory("bois")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedCategory === 'bois' 
              ? 'bg-blue-500/10 border-blue-500 shadow-sm' 
              : 'bg-card border-border/70 hover:border-blue-500/40'
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block tracking-wider">Bois & Engorda</span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">{activeSteers.length}</p>
          <span className="text-[11px] text-muted-foreground">Machos adultos</span>
        </div>

        <div 
          onClick={() => setSelectedCategory("vacas")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedCategory === 'vacas' 
              ? 'bg-purple-500/10 border-purple-500 shadow-sm' 
              : 'bg-card border-border/70 hover:border-purple-500/40'
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 block tracking-wider">Vacas & Matrizes</span>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-0.5 tabular-nums">{activeCows.length}</p>
          <span className="text-[11px] text-muted-foreground">Fêmeas em reprodução</span>
        </div>
      </div>

      {/* Filters section */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por brinco, raça ou categoria..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-11 bg-card border-border/70 text-sm"
          />
        </div>

        {/* Categoria Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-semibold mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Categoria:
          </span>
          <Button 
            variant={selectedCategory === "todos" ? "default" : "outline"} 
            size="sm" 
            className="h-7 text-xs font-semibold"
            onClick={() => setSelectedCategory("todos")}
          >
            Todos ({activeAnimals.length})
          </Button>
          <Button 
            variant={selectedCategory === "bezerros" ? "default" : "outline"} 
            size="sm" 
            className={`h-7 text-xs font-semibold ${selectedCategory === "bezerros" ? "bg-pink-600 text-white" : "hover:text-pink-600"}`}
            onClick={() => setSelectedCategory("bezerros")}
          >
            🍼 Bezerros ({activeCalves.length})
          </Button>
          <Button 
            variant={selectedCategory === "bois" ? "default" : "outline"} 
            size="sm" 
            className="h-7 text-xs font-semibold"
            onClick={() => setSelectedCategory("bois")}
          >
            Bois ({activeSteers.length})
          </Button>
          <Button 
            variant={selectedCategory === "vacas" ? "default" : "outline"} 
            size="sm" 
            className="h-7 text-xs font-semibold"
            onClick={() => setSelectedCategory("vacas")}
          >
            Vacas ({activeCows.length})
          </Button>
        </div>

        {/* Lote Filter Pills */}
        {lotes.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-xs text-muted-foreground font-semibold mr-1 shrink-0">Lotes:</span>
            <Badge 
              variant={selectedLote === null ? "default" : "outline"}
              className={`cursor-pointer whitespace-nowrap px-3 py-1 text-xs font-bold rounded-full transition-all ${selectedLote === null ? '' : 'border-border/70 text-muted-foreground'}`}
              onClick={() => setSelectedLote(null)}
            >
              Todos os Lotes
            </Badge>
            {lotes.map(lote => (
              <Badge 
                key={lote}
                variant={selectedLote === lote ? "default" : "outline"}
                className={`cursor-pointer whitespace-nowrap px-3 py-1 text-xs font-bold rounded-full transition-all ${selectedLote === lote ? '' : 'border-border/70 text-muted-foreground'}`}
                onClick={() => setSelectedLote(lote)}
              >
                {lote}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* List section */}
      <Tabs defaultValue="ativo" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-4 rounded-xl border border-border/70 h-11 grid grid-cols-2">
          <TabsTrigger 
            value="ativo" 
            className="rounded-lg font-bold text-xs uppercase transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Ativos no Pasto ({filtered.filter(a => a.status === "ativo").length})
          </TabsTrigger>
          <TabsTrigger 
            value="outros" 
            className="rounded-lg font-bold text-xs uppercase transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Vendidos / Baixas ({filtered.filter(a => a.status === "vendido" || a.status === "morto").length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="ativo" className="mt-0">
          {loading ? (
            <div className="py-20 text-center">Carregando animais...</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.filter(a => a.status === "ativo").map(animal => renderAnimalCard(animal))}
              {filtered.filter(a => a.status === "ativo").length === 0 && (
                <div className="col-span-full py-16 text-center flex flex-col items-center gap-3">
                  <div className="h-16 w-16 bg-muted/40 rounded-full flex items-center justify-center text-muted-foreground">
                    <TrendingUp className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-foreground font-bold text-base">Nenhum animal encontrado</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Tente ajustar os filtros ou cadastrar um novo bezerro/animal.</p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button 
                      size="sm"
                      onClick={() => {
                        setSelectedCategory("todos");
                        setSelectedLote(null);
                        setSearch("");
                      }}
                      variant="outline"
                    >
                      Limpar Filtros
                    </Button>
                    <Button 
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      onClick={() => setShowBirthModal(true)}
                    >
                      + Cadastrar Bezerro
                    </Button>
                  </div>
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
                <p className="text-muted-foreground font-medium">Nenhum histórico de venda ou baixa encontrado</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL: REGISTRAR NASCIMENTO DIRETO NA TELA DE ANIMAIS */}
      <Dialog open={showBirthModal} onOpenChange={setShowBirthModal}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Baby className="h-5 w-5 text-emerald-600" />
              Registrar Bezerro Nascido (Parto)
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRegisterBirth} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Brinco do Bezerro *
                </Label>
                <Input 
                  placeholder="Ex: 501 ou B-01" 
                  value={birthForm.tag} 
                  onChange={e => setBirthForm({...birthForm, tag: e.target.value})}
                  className="h-10 text-sm font-bold"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Data de Nascimento *
                </Label>
                <Input 
                  type="date" 
                  value={birthForm.birth_date} 
                  onChange={e => setBirthForm({...birthForm, birth_date: e.target.value})}
                  className="h-10 text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Sexo do Bezerro *
                </Label>
                <Select 
                  value={birthForm.sex} 
                  onValueChange={val => setBirthForm({...birthForm, sex: val})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Macho">Macho ♂ (Bezerro)</SelectItem>
                    <SelectItem value="Fêmea">Fêmea ♀ (Bezerra)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Peso ao Nascer (kg) *
                </Label>
                <Input 
                  type="number" 
                  step="0.5" 
                  placeholder="Ex: 34" 
                  value={birthForm.weight} 
                  onChange={e => setBirthForm({...birthForm, weight: e.target.value})}
                  className="h-10 text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Mãe / Matriz (Vaca)
              </Label>
              <Select 
                value={birthForm.mother_id} 
                onValueChange={val => {
                  const m = animals.find(a => a.id === val);
                  setBirthForm({
                    ...birthForm, 
                    mother_id: val,
                    breed: m?.breed || birthForm.breed
                  });
                }}
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="Selecione a vaca mãe (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem mãe vinculada</SelectItem>
                  {females.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      Brinco #{f.tag} - {f.breed} (Lote: {f.lote_id || "Geral"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Raça
                </Label>
                <Input 
                  placeholder="Ex: Nelore, Cruzado" 
                  value={birthForm.breed} 
                  onChange={e => setBirthForm({...birthForm, breed: e.target.value})}
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Lote de Destino
                </Label>
                <Input 
                  placeholder="Ex: Maternidade" 
                  value={birthForm.lote_id} 
                  onChange={e => setBirthForm({...birthForm, lote_id: e.target.value})}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Observações
              </Label>
              <Input 
                placeholder="Ex: Parto normal, mamou colostro" 
                value={birthForm.notes} 
                onChange={e => setBirthForm({...birthForm, notes: e.target.value})}
                className="h-10 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setShowBirthModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Salvar Bezerro no Rebanho
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
