import { useEffect, useState, useMemo } from "react";
import { store, Animal, Insemination } from "@/lib/store";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  Search, 
  Calendar, 
  Baby, 
  Activity, 
  AlertCircle, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Target, 
  Scale, 
  Milk, 
  Sparkles, 
  Heart, 
  ArrowUpRight,
  Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function InseminationPage() {
  const navigate = useNavigate();
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [inseminations, setInseminations] = useState<Insemination[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab & search states
  const [activeTab, setActiveTab] = useState("bezerros");
  const [searchCalf, setSearchCalf] = useState("");
  const [filterSex, setFilterSex] = useState<"todos" | "Macho" | "Fêmea">("todos");

  // Insemination Form Modal
  const [showInsemModal, setShowInsemModal] = useState(false);
  const [insemForm, setInsemForm] = useState({
    animal_id: "",
    date: new Date().toISOString().split("T")[0],
    bull: "",
    status: "aguardando" as "aguardando" | "prenha" | "vazia" | "aborto" | "parida",
    notes: ""
  });

  // Calving / Newborn Calf Modal
  const [showCalfModal, setShowCalfModal] = useState(false);
  const [calfForm, setCalfForm] = useState({
    mother_id: "",
    tag: "",
    birth_date: new Date().toISOString().split("T")[0],
    sex: "Macho",
    weight: "32",
    breed: "Nelore",
    father: "",
    lote_id: "Maternidade",
    notes: "Parto normal, mamou colostro"
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const animalsData = await store.getAnimals();
      setAllAnimals(animalsData);
      const insemData = await store.getInseminations();
      setInseminations(insemData);
    } catch (e) {
      toast.error("Erro ao carregar dados reprodutivos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fêmeas matrizes disponíveis para cobertura
  const females = useMemo(() => {
    return allAnimals.filter(a => 
      a.status === "ativo" && 
      (a.sex?.toLowerCase() === "fêmea" || a.sex?.toLowerCase() === "femea")
    );
  }, [allAnimals]);

  // Lista de bezerros nascidos
  const calves = useMemo(() => {
    return allAnimals.filter(a => {
      const cat = a.categoria?.toLowerCase() || "";
      const isCalf = cat.includes("bezerro") || cat.includes("bezerra") || a.origem === "Nascido na Fazenda" || Boolean(a.matriz_id);
      return isCalf;
    }).sort((a, b) => (b.birth_date || "").localeCompare(a.birth_date || ""));
  }, [allAnimals]);

  // Matrizes prenhas com previsão de parto
  const pregnantCows = useMemo(() => {
    return inseminations
      .filter(i => i.status === "prenha" && i.estimated_birth)
      .map(i => {
        const cow = allAnimals.find(a => a.id === i.animal_id);
        const estDate = new Date(i.estimated_birth!);
        const daysLeft = differenceInDays(estDate, new Date());
        return {
          ...i,
          cow,
          daysLeft
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [inseminations, allAnimals]);

  // KPIs de reprodução e maternidade
  const metrics = useMemo(() => {
    const totalCalves = calves.length;
    const maleCalves = calves.filter(c => c.sex === "Macho").length;
    const femaleCalves = calves.filter(c => c.sex?.toLowerCase().includes("f")).length;
    const pregnantCount = inseminations.filter(i => i.status === "prenha").length;
    const awaitingTouchCount = inseminations.filter(i => i.status === "aguardando").length;
    
    // Peso médio ao nascer
    const weights = calves.map(c => c.peso_entrada || c.weight).filter(w => w > 0 && w < 80);
    const avgBirthWeight = weights.length > 0 ? (weights.reduce((a, b) => a + b, 0) / weights.length) : 32;

    // Bezerros prontos para desmama (idade >= 210 dias / 7 meses)
    const now = new Date();
    const readyForWeaning = calves.filter(c => {
      if (!c.birth_date) return false;
      const days = differenceInDays(now, new Date(c.birth_date));
      return days >= 210;
    }).length;

    return {
      totalCalves,
      maleCalves,
      femaleCalves,
      pregnantCount,
      awaitingTouchCount,
      avgBirthWeight,
      readyForWeaning
    };
  }, [calves, inseminations]);

  // Submissão de nova inseminação
  const handleInsemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insemForm.animal_id || !insemForm.bull || !insemForm.date) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Gestação média: 283 dias
    const estBirth = addDays(new Date(insemForm.date), 283).toISOString().split("T")[0];

    try {
      await store.addInsemination({
        animal_id: insemForm.animal_id,
        date: insemForm.date,
        bull: insemForm.bull,
        status: insemForm.status,
        observation: insemForm.notes,
        estimated_birth: estBirth
      });

      await loadData();
      setShowInsemModal(false);
      toast.success("Inseminação registrada com sucesso!");
      setInsemForm({
        animal_id: "",
        date: new Date().toISOString().split("T")[0],
        bull: "",
        status: "aguardando",
        notes: ""
      });
    } catch (e) {
      toast.error("Erro ao salvar inseminação");
    }
  };

  // Preencher formulário de parto a partir de uma matriz prenha
  const openCalfModalForMother = (motherId: string, fatherName?: string, motherBreed?: string) => {
    setCalfForm({
      mother_id: motherId,
      tag: "",
      birth_date: new Date().toISOString().split("T")[0],
      sex: "Macho",
      weight: "32",
      breed: motherBreed || "Nelore",
      father: fatherName || "",
      lote_id: "Maternidade",
      notes: "Parto normal, mamou colostro"
    });
    setShowCalfModal(true);
  };

  // Submissão de novo bezerro nascido (Parto)
  const handleCalfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calfForm.tag.trim()) {
      toast.error("Informe o número ou código do brinco do bezerro");
      return;
    }

    const birthWeight = parseFloat(calfForm.weight) || 32;
    const mother = allAnimals.find(a => a.id === calfForm.mother_id);

    try {
      // 1. Cadastra o bezerro no rebanho
      const newAnimal = await store.addAnimal({
        tag: calfForm.tag.trim(),
        birth_date: calfForm.birth_date,
        sex: calfForm.sex,
        breed: calfForm.breed || (mother?.breed || "Nelore"),
        weight: birthWeight,
        peso_entrada: birthWeight,
        status: "ativo",
        categoria: calfForm.sex === "Macho" ? "Bezerro" : "Bezerra",
        origem: "Nascido na Fazenda",
        lote_id: calfForm.lote_id || "Maternidade",
        matriz_id: calfForm.mother_id || undefined,
        valor_compra: 0
      });

      // 2. Registra o evento de nascimento
      if (newAnimal?.id) {
        await store.addEvent({
          animal_id: newAnimal.id,
          type: "nascimento",
          date: calfForm.birth_date,
          description: `Nascimento de ${calfForm.sex === 'Macho' ? 'Bezerro' : 'Bezerra'} brinco #${calfForm.tag}. ${mother ? `Filho da vaca #${mother.tag}.` : ''} Pai: ${calfForm.father || 'N/I'}. Peso ao nascer: ${birthWeight} kg. ${calfForm.notes}`,
          value: birthWeight,
          weight: birthWeight
        });
      }

      // 3. Se a matriz tinha inseminação pendente/prenha, atualiza para parida
      if (calfForm.mother_id) {
        const activeInsem = inseminations.find(i => i.animal_id === calfForm.mother_id && (i.status === "prenha" || i.status === "aguardando"));
        if (activeInsem) {
          await store.updateInsemination(activeInsem.id, { status: "parida" as any });
        }
      }

      toast.success(`Bezerro #${calfForm.tag} registrado com sucesso e adicionado ao seu rebanho de animais!`, {
        action: {
          label: "Ver Animais",
          onClick: () => navigate("/animals?categoria=bezerros")
        }
      });
      setShowCalfModal(false);
      await loadData();
      setActiveTab("bezerros");

      // Reset form
      setCalfForm({
        mother_id: "",
        tag: "",
        birth_date: new Date().toISOString().split("T")[0],
        sex: "Macho",
        weight: "32",
        breed: "Nelore",
        father: "",
        lote_id: "Maternidade",
        notes: "Parto normal, mamou colostro"
      });
    } catch (err) {
      toast.error("Erro ao registrar nascimento do bezerro");
    }
  };

  const filteredCalves = calves.filter(c => {
    const matchesSearch = c.tag.toLowerCase().includes(searchCalf.toLowerCase()) ||
      (c.breed && c.breed.toLowerCase().includes(searchCalf.toLowerCase()));
    const matchesSex = filterSex === "todos" || c.sex === filterSex;
    return matchesSearch && matchesSex;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "prenha": return <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Prenha</Badge>;
      case "parida": return <Badge className="bg-blue-600 hover:bg-blue-700"><Baby className="h-3 w-3 mr-1" /> Parida (Cria no Pé)</Badge>;
      case "vazia": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Vazia</Badge>;
      case "aborto": return <Badge variant="outline" className="text-rose-500 border-rose-200"><AlertCircle className="h-3 w-3 mr-1" /> Aborto</Badge>;
      default: return <Badge variant="secondary" className="bg-slate-200 text-slate-800"><Clock className="h-3 w-3 mr-1" /> Aguardando Toque</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-pink-500" />
            <span className="text-[11px] font-semibold text-pink-600 dark:text-pink-400 tracking-wider uppercase">
              Ciclo Reprodutivo & Cria
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-0.5">
            Reprodução & Maternidade
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Acompanhe inseminações, prenhezes e todos os bezerros nascidos na fazenda
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button 
            onClick={() => setShowCalfModal(true)} 
            className="h-10 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Baby className="h-4 w-4" /> Registrar Nascimento (Parto)
          </Button>

          <Button 
            variant="outline"
            onClick={() => setShowInsemModal(true)} 
            className="h-10 text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted"
          >
            <Target className="h-4 w-4 text-primary" /> Nova Inseminação / IATF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Bezerros Nascidos */}
        <Card className="border border-border/70 shadow-sm hover:border-pink-500/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
            <span className="text-xs font-medium text-muted-foreground">Bezerros Nascidos</span>
            <div className="h-8 w-8 rounded-lg bg-pink-50 dark:bg-pink-950/40 flex items-center justify-center text-pink-600">
              <Baby className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {metrics.totalCalves} <span className="text-xs font-normal text-muted-foreground">crias</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="text-blue-600 font-semibold">{metrics.maleCalves} machos ♂</span>
              <span aria-hidden="true">·</span>
              <span className="text-pink-600 font-semibold">{metrics.femaleCalves} fêmeas ♀</span>
            </div>
          </CardContent>
        </Card>

        {/* Vacas Prenhas */}
        <Card className="border border-border/70 shadow-sm hover:border-emerald-500/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
            <span className="text-xs font-medium text-muted-foreground">Matrizes Confirmadas</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600">
              <Heart className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {metrics.pregnantCount} <span className="text-xs font-normal text-muted-foreground">prenhas</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span>{metrics.awaitingTouchCount} aguardando toque / ultrassom</span>
            </div>
          </CardContent>
        </Card>

        {/* Peso Médio ao Nascer */}
        <Card className="border border-border/70 shadow-sm hover:border-blue-500/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
            <span className="text-xs font-medium text-muted-foreground">Peso Médio ao Nascer</span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600">
              <Scale className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {metrics.avgBirthWeight.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">kg</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              <span>Média de vigor na maternidade</span>
            </div>
          </CardContent>
        </Card>

        {/* Prontos para Desmama */}
        <Card className="border border-border/70 shadow-sm hover:border-amber-500/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4">
            <span className="text-xs font-medium text-muted-foreground">Ponto de Desmama</span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600">
              <Milk className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {metrics.readyForWeaning} <span className="text-xs font-normal text-muted-foreground">bezerros</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              <span>$\ge 7$ meses de idade (210 dias)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/60 p-1 rounded-xl h-11 border border-border/60 grid grid-cols-3 max-w-xl">
          <TabsTrigger value="bezerros" className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Baby className="h-3.5 w-3.5 text-pink-600" />
            Bezerros ({calves.length})
          </TabsTrigger>
          <TabsTrigger value="inseminacoes" className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Target className="h-3.5 w-3.5 text-primary" />
            Inseminações ({inseminations.length})
          </TabsTrigger>
          <TabsTrigger value="previsao" className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-amber-600" />
            Previsão Partos ({pregnantCows.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: BEZERROS NASCIDOS */}
        <TabsContent value="bezerros" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar bezerro por brinco ou raça..." 
                value={searchCalf} 
                onChange={e => setSearchCalf(e.target.value)} 
                className="pl-9 h-10 bg-card"
              />
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-center">
              <span className="text-xs text-muted-foreground font-medium mr-1 flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Sexo:
              </span>
              <Button 
                variant={filterSex === "todos" ? "default" : "outline"} 
                size="sm" 
                className="h-8 text-xs font-semibold"
                onClick={() => setFilterSex("todos")}
              >
                Todos ({calves.length})
              </Button>
              <Button 
                variant={filterSex === "Macho" ? "default" : "outline"} 
                size="sm" 
                className="h-8 text-xs font-semibold"
                onClick={() => setFilterSex("Macho")}
              >
                Machos ♂
              </Button>
              <Button 
                variant={filterSex === "Fêmea" ? "default" : "outline"} 
                size="sm" 
                className="h-8 text-xs font-semibold"
                onClick={() => setFilterSex("Fêmea")}
              >
                Fêmeas ♀
              </Button>
            </div>
          </div>

          {filteredCalves.length === 0 ? (
            <Card className="border border-border/60">
              <CardContent className="py-16 text-center flex flex-col items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-pink-500/10 text-pink-600 flex items-center justify-center mb-3">
                  <Baby className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-foreground">Nenhum bezerro cadastrado ainda</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Registre o primeiro nascimento de bezerro na fazenda com a mãe, peso ao nascer e data de parto.
                </p>
                <Button 
                  onClick={() => setShowCalfModal(true)} 
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Registrar Primeiro Bezerro
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCalves.map(calf => {
                const mother = allAnimals.find(a => a.id === calf.matriz_id);
                const birthDateObj = calf.birth_date ? new Date(calf.birth_date) : null;
                const ageDays = birthDateObj ? differenceInDays(new Date(), birthDateObj) : null;
                const ageMonths = ageDays !== null ? (ageDays / 30.4).toFixed(1) : null;
                const isReadyToWean = ageDays !== null && ageDays >= 210;

                return (
                  <Card 
                    key={calf.id}
                    onClick={() => navigate(`/animals/${calf.id}`)}
                    className="border border-border/70 shadow-sm hover:border-primary/50 transition-all cursor-pointer group bg-card overflow-hidden"
                  >
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm ${
                          calf.sex === 'Macho' 
                            ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' 
                            : 'bg-pink-500/10 text-pink-600 border border-pink-500/20'
                        }`}>
                          {calf.sex === 'Macho' ? '♂' : '♀'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                              Brinco #{calf.tag}
                            </h3>
                            <Badge variant="outline" className="text-[10px] font-bold py-0 h-4">
                              {calf.categoria || (calf.sex === 'Macho' ? 'Bezerro' : 'Bezerra')}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {calf.breed || "Nelore"} · Lote: <strong>{calf.lote_id || "Maternidade"}</strong>
                          </p>
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </div>

                    {/* Metadados do Bezerro */}
                    <div className="px-4 pb-3 space-y-2 text-xs border-t border-border/50 pt-2.5 bg-muted/10">
                      <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                        <div>
                          <span className="text-[10px] font-medium block uppercase text-muted-foreground/80">Nascimento</span>
                          <span className="font-semibold text-foreground">
                            {calf.birth_date ? format(new Date(calf.birth_date), "dd/MM/yyyy") : "Não informada"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium block uppercase text-muted-foreground/80">Idade Atual</span>
                          <span className="font-semibold text-foreground">
                            {ageDays !== null ? `${ageDays} dias (${ageMonths} meses)` : "Recém-nascido"}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                        <div>
                          <span className="text-[10px] font-medium block uppercase text-muted-foreground/80">Mãe (Matriz)</span>
                          <span className="font-semibold text-foreground truncate block">
                            {mother ? `Vaca #${mother.tag} (${mother.breed})` : "Não vinculada"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium block uppercase text-muted-foreground/80">Peso Atual</span>
                          <span className="font-bold text-foreground">
                            {calf.weight} kg <span className="text-muted-foreground font-normal">({(calf.weight / 15).toFixed(1)} @)</span>
                          </span>
                        </div>
                      </div>

                      {/* Barra de Desmama */}
                      <div className="pt-2">
                        <div className="flex justify-between items-center text-[10px] font-medium text-muted-foreground mb-1">
                          <span>Desmama (7 meses)</span>
                          <span className={isReadyToWean ? "text-amber-600 font-bold" : ""}>
                            {isReadyToWean ? "✓ Pronto p/ Desmama" : `${Math.max(0, 210 - (ageDays || 0))} dias restantes`}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${isReadyToWean ? 'bg-amber-500' : 'bg-primary'}`}
                            style={{ width: `${Math.min(100, ((ageDays || 0) / 210) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: INSEMINAÇÕES & COBERTURAS */}
        <TabsContent value="inseminacoes" className="mt-4 space-y-4">
          <Card className="border border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Histórico de Inseminações & Coberturas
              </CardTitle>
              <Button size="sm" onClick={() => setShowInsemModal(true)} className="h-8 text-xs font-bold">
                + Nova Inseminação
              </Button>
            </CardHeader>
            <CardContent>
              {inseminations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  Nenhuma inseminação registrada até o momento.
                </div>
              ) : (
                <div className="space-y-3">
                  {inseminations.sort((a,b) => b.date.localeCompare(a.date)).map(ins => {
                    const cow = allAnimals.find(a => a.id === ins.animal_id);
                    return (
                      <div 
                        key={ins.id} 
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/60 bg-card hover:bg-muted/20 transition-all text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                            <Activity className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground">
                                Vaca #{cow?.tag || "N/I"}
                              </span>
                              {cow?.breed && <span className="text-muted-foreground font-medium">({cow.breed})</span>}
                              {getStatusBadge(ins.status)}
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground text-[11px] mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Data: {format(new Date(ins.date), "dd/MM/yyyy")}
                              </span>
                              <span className="flex items-center gap-1 font-semibold text-foreground">
                                <Target className="h-3 w-3 text-primary" /> Touro: {ins.bull}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {ins.status === "prenha" && (
                            <div className="flex items-center gap-2">
                              {ins.estimated_birth && (
                                <div className="text-right">
                                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Previsão Parto</span>
                                  <span className="font-bold text-foreground text-xs">
                                    {format(new Date(ins.estimated_birth), "dd/MM/yyyy")}
                                  </span>
                                </div>
                              )}
                              <Button 
                                size="sm" 
                                className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => openCalfModalForMother(ins.animal_id, ins.bull, cow?.breed)}
                              >
                                <Baby className="h-3.5 w-3.5 mr-1" /> Registrar Parto
                              </Button>
                            </div>
                          )}

                          {ins.status === "aguardando" && (
                            <div className="flex items-center gap-1.5">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-xs font-semibold text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                onClick={async () => {
                                  await store.updateInsemination(ins.id, { status: "prenha" });
                                  toast.success("Vaca confirmada PRENHA!");
                                  loadData();
                                }}
                              >
                                Confirmar Prenhez
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={async () => {
                                  await store.updateInsemination(ins.id, { status: "vazia" });
                                  toast.info("Status atualizado para VAZIA");
                                  loadData();
                                }}
                              >
                                Vazia
                              </Button>
                            </div>
                          )}

                          {ins.status === "parida" && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                              ✓ Parto Concluído
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: PREVISÃO DE PARTOS */}
        <TabsContent value="previsao" className="mt-4 space-y-4">
          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-600" />
                Matrizes com Parto Previsto nos Próximos Meses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pregnantCows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  Nenhuma matriz prenha com parto previsto cadastrada.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pregnantCows.map(item => {
                    const isImminent = item.daysLeft <= 15;
                    const isSoon = item.daysLeft > 15 && item.daysLeft <= 45;

                    return (
                      <div 
                        key={item.id} 
                        className={`p-4 rounded-xl border transition-all ${
                          isImminent 
                            ? 'bg-rose-500/5 border-rose-500/40 shadow-sm' 
                            : isSoon 
                            ? 'bg-amber-500/5 border-amber-500/30' 
                            : 'bg-card border-border/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-foreground">
                            Vaca #{item.cow?.tag || "N/I"}
                          </span>
                          <Badge className={
                            isImminent 
                              ? 'bg-rose-600 text-white font-bold text-[10px]' 
                              : isSoon 
                              ? 'bg-amber-600 text-white font-bold text-[10px]' 
                              : 'bg-emerald-600 text-white text-[10px]'
                          }>
                            {item.daysLeft < 0 ? 'Parto Atrasado' : `${item.daysLeft} dias restantes`}
                          </Badge>
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground mb-3">
                          <p>Raça: <strong className="text-foreground">{item.cow?.breed || "Nelore"}</strong></p>
                          <p>Touro / Sêmen: <strong className="text-foreground">{item.bull}</strong></p>
                          <p>Data Estimada: <strong className="text-foreground">{format(new Date(item.estimated_birth!), "dd/MM/yyyy")}</strong></p>
                        </div>

                        <Button 
                          className="w-full h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => openCalfModalForMother(item.animal_id, item.bull, item.cow?.breed)}
                        >
                          <Baby className="h-3.5 w-3.5 mr-1" /> Registrar Parto Desta Vaca
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: REGISTRAR NASCIMENTO / PARTO */}
      <Dialog open={showCalfModal} onOpenChange={setShowCalfModal}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Baby className="h-5 w-5 text-emerald-600" />
              Registrar Nascimento de Bezerro (Parto)
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCalfSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Brinco do Bezerro *
                </Label>
                <Input 
                  placeholder="Ex: 501 ou B-01" 
                  value={calfForm.tag} 
                  onChange={e => setCalfForm({...calfForm, tag: e.target.value})}
                  className="h-10 text-sm font-bold"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Data do Parto / Nascimento *
                </Label>
                <Input 
                  type="date" 
                  value={calfForm.birth_date} 
                  onChange={e => setCalfForm({...calfForm, birth_date: e.target.value})}
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
                  value={calfForm.sex} 
                  onValueChange={val => setCalfForm({...calfForm, sex: val})}
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
                  value={calfForm.weight} 
                  onChange={e => setCalfForm({...calfForm, weight: e.target.value})}
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
                value={calfForm.mother_id} 
                onValueChange={val => {
                  const m = allAnimals.find(a => a.id === val);
                  setCalfForm({
                    ...calfForm, 
                    mother_id: val,
                    breed: m?.breed || calfForm.breed
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
                  Touro / Pai (Sêmen)
                </Label>
                <Input 
                  placeholder="Ex: Nelore PO ou Angus" 
                  value={calfForm.father} 
                  onChange={e => setCalfForm({...calfForm, father: e.target.value})}
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Raça
                </Label>
                <Input 
                  placeholder="Ex: Nelore, Cruzado" 
                  value={calfForm.breed} 
                  onChange={e => setCalfForm({...calfForm, breed: e.target.value})}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Lote de Destino
              </Label>
              <Input 
                placeholder="Ex: Maternidade, Pasto 01" 
                value={calfForm.lote_id} 
                onChange={e => setCalfForm({...calfForm, lote_id: e.target.value})}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Observações do Parto & Manejo Inicial
              </Label>
              <Input 
                placeholder="Ex: Mamou colostro nas primeiras 2h, cura de umbigo feita" 
                value={calfForm.notes} 
                onChange={e => setCalfForm({...calfForm, notes: e.target.value})}
                className="h-10 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setShowCalfModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Salvar Bezerro no Rebanho
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVA INSEMINAÇÃO */}
      <Dialog open={showInsemModal} onOpenChange={setShowInsemModal}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Registrar Cobertura / Inseminação
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleInsemSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Matriz (Vaca) *
              </Label>
              <Select 
                value={insemForm.animal_id} 
                onValueChange={val => setInsemForm({...insemForm, animal_id: val})}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione a vaca" />
                </SelectTrigger>
                <SelectContent>
                  {females.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      Brinco #{f.tag} - {f.breed}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Data da Inseminação *
                </Label>
                <Input 
                  type="date" 
                  value={insemForm.date} 
                  onChange={e => setInsemForm({...insemForm, date: e.target.value})}
                  className="h-10 text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Touro / Sêmen *
                </Label>
                <Input 
                  placeholder="Nome do touro" 
                  value={insemForm.bull} 
                  onChange={e => setInsemForm({...insemForm, bull: e.target.value})}
                  className="h-10 text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Status Inicial
              </Label>
              <Select 
                value={insemForm.status} 
                onValueChange={(val: any) => setInsemForm({...insemForm, status: val})}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando">Aguardando Toque / Diagnóstico</SelectItem>
                  <SelectItem value="prenha">Confirmada Prenha</SelectItem>
                  <SelectItem value="vazia">Vazia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Observações
              </Label>
              <Input 
                placeholder="Ex: IATF protocolo 1, aplicador João" 
                value={insemForm.notes} 
                onChange={e => setInsemForm({...insemForm, notes: e.target.value})}
                className="h-10 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setShowInsemModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="font-bold">
                Salvar Inseminação
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
