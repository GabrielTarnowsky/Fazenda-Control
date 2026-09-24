import { useEffect, useState, useMemo } from "react";
import { store, Financial, formatDateDisplay, parseDateSafe, Animal, Pasture } from "@/lib/store";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Trash2,
  AlertTriangle,
  Pencil,
  X,
  Check,
  Loader2,
  Download,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Beef,
  LandPlot,
  Wheat,
  Calendar,
  DollarSign,
  BarChart3,
  PieChart as PieIcon,
  Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from "recharts";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const CATEGORIES = [
  "Alimentação",
  "Saúde / Medicamentos",
  "Mão de Obra",
  "Manutenção e Peças",
  "Combustível e Óleo",
  "Compra de Animais",
  "Infraestrutura e Cercas",
  "Impostos / ITR / Taxas",
  "Frete e Transporte",
  "Outros"
];

const REVENUE_CATEGORIES = [
  "Venda de Bois / Novilhos",
  "Venda de Bezerros",
  "Venda de Vacas / Descarte",
  "Venda de Leite / Derivados",
  "Venda de Insumos / Grãos",
  "Prestação de Serviço",
  "Outros"
];

const PAYMENT_METHODS = [
  "Pix", "Dinheiro", "Boleto", "Cartão", "Transferência", "A Prazo"
];

// Helper para metadados de status e lote na descrição sem alterar o schema do banco
function parseFinancialMetadata(rawDescription: string) {
  if (!rawDescription) return { isPending: false, lote: undefined, cleanDescription: "" };
  const isPending = /\[PENDENTE\]/i.test(rawDescription) || /\(PENDENTE\)/i.test(rawDescription);
  const loteMatch = rawDescription.match(/\[LOTE:\s*([^\]]+)\]/i);
  const cleanDescription = rawDescription
    .replace(/\[PENDENTE\]/gi, '')
    .replace(/\[PAGO\]/gi, '')
    .replace(/\[LOTE:[^\]]+\]/gi, '')
    .trim();

  return {
    isPending,
    lote: loteMatch ? loteMatch[1].trim() : undefined,
    cleanDescription: cleanDescription || rawDescription
  };
}

function buildFinancialDescription(cleanDescription: string, isPending: boolean, lote?: string) {
  let res = cleanDescription.trim();
  if (lote && lote !== "Geral" && lote !== "none" && lote !== "") {
    res += ` [LOTE: ${lote}]`;
  }
  if (isPending) {
    res += ` [PENDENTE]`;
  }
  return res;
}

export default function FinancialPage() {
  const [records, setRecords] = useState<Financial[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [pastures, setPastures] = useState<Pasture[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewScope, setViewScope] = useState<"month" | "year">("month");
  const [activeTab, setActiveTab] = useState<"table" | "charts">("table");

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pago" | "pendente" | "atrasado">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterLote, setFilterLote] = useState<string>("all");

  // Edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    type?: string;
    cleanDescription?: string;
    isPending?: boolean;
    lote?: string;
    value?: number;
    date?: string;
    category?: string;
    payment_method?: string;
  }>({});

  // Formulário de Novo Lançamento
  const [form, setForm] = useState({
    type: "despesa",
    cleanDescription: "",
    value: 0,
    date: new Date().toISOString().split("T")[0],
    category: "Alimentação",
    payment_method: "Pix",
    isPending: false,
    lote: "Geral",
    installments: 1
  });

  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [finData, animData, pastData] = await Promise.all([
        store.getFinancials(),
        store.getAnimals(),
        store.getPastures()
      ]);
      setRecords(finData);
      setAnimals(animData);
      setPastures(pastData);
    } catch {
      toast.error("Erro ao carregar dados financeiros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshRecords = async () => {
    try {
      const data = await store.getFinancials();
      setRecords(data);
    } catch {
      toast.error("Erro ao sincronizar lançamentos.");
    }
  };

  // Lista de lotes ativos da fazenda
  const availableLots = useMemo(() => {
    const lotSet = new Set<string>();
    animals.filter(a => a.status === "ativo" && a.lote_id).forEach(a => lotSet.add(a.lote_id!));
    return Array.from(lotSet).sort();
  }, [animals]);

  // Contagem de cabeças ativas e hectares totais
  const activeAnimalsCount = useMemo(() => {
    return animals.filter(a => a.status === "ativo").length;
  }, [animals]);

  const totalPastureArea = useMemo(() => {
    return pastures.reduce((sum, p) => sum + (Number(p.area_ha) || 0), 0);
  }, [pastures]);

  // Registros filtrados pelo período (Mês ou Ano)
  const periodRecords = useMemo(() => {
    const targetYear = selectedDate.getFullYear().toString();
    const targetMonth = (selectedDate.getMonth() + 1).toString().padStart(2, "0");
    const prefix = viewScope === "month" ? `${targetYear}-${targetMonth}` : targetYear;

    return records.filter(r => r.date.startsWith(prefix));
  }, [records, selectedDate, viewScope]);

  // Registros após busca e filtros da tabela
  const filteredRecords = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return periodRecords.filter(r => {
      const meta = parseFinancialMetadata(r.description);
      const rDate = parseDateSafe(r.date);
      rDate.setHours(0, 0, 0, 0);
      const isOverdue = meta.isPending && rDate < today;

      // Filtro Tipo
      if (filterType !== "all" && r.type !== filterType) return false;

      // Filtro Status
      if (filterStatus === "pago" && meta.isPending) return false;
      if (filterStatus === "pendente" && !meta.isPending) return false;
      if (filterStatus === "atrasado" && !isOverdue) return false;

      // Filtro Categoria
      if (filterCategory !== "all" && r.category !== filterCategory) return false;

      // Filtro Lote
      if (filterLote !== "all") {
        if (filterLote === "Geral" && meta.lote) return false;
        if (filterLote !== "Geral" && meta.lote !== filterLote) return false;
      }

      // Busca por texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesDesc = meta.cleanDescription.toLowerCase().includes(query);
        const matchesCat = (r.category || "").toLowerCase().includes(query);
        const matchesPay = (r.payment_method || "").toLowerCase().includes(query);
        const matchesLote = (meta.lote || "").toLowerCase().includes(query);
        if (!matchesDesc && !matchesCat && !matchesPay && !matchesLote) return false;
      }

      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [periodRecords, filterType, filterStatus, filterCategory, filterLote, searchTerm]);

  // KPIs Financeiros do Período
  const totalRevenue = useMemo(() => {
    return periodRecords.filter(r => r.type === "receita").reduce((acc, r) => acc + r.value, 0);
  }, [periodRecords]);

  const totalExpense = useMemo(() => {
    return periodRecords.filter(r => r.type === "despesa").reduce((acc, r) => acc + r.value, 0);
  }, [periodRecords]);

  const balance = totalRevenue - totalExpense;

  const totalPendingExpense = useMemo(() => {
    return periodRecords.filter(r => r.type === "despesa" && parseFinancialMetadata(r.description).isPending)
      .reduce((acc, r) => acc + r.value, 0);
  }, [periodRecords]);

  const totalPendingRevenue = useMemo(() => {
    return periodRecords.filter(r => r.type === "receita" && parseFinancialMetadata(r.description).isPending)
      .reduce((acc, r) => acc + r.value, 0);
  }, [periodRecords]);

  // Indicadores Zootécnicos Chave
  const costPerHead = useMemo(() => {
    return activeAnimalsCount > 0 ? totalExpense / activeAnimalsCount : 0;
  }, [totalExpense, activeAnimalsCount]);

  const costPerHectare = useMemo(() => {
    return totalPastureArea > 0 ? totalExpense / totalPastureArea : 0;
  }, [totalExpense, totalPastureArea]);

  const operatingMargin = useMemo(() => {
    return totalRevenue > 0 ? ((totalRevenue - totalExpense) / totalRevenue) * 100 : 0;
  }, [totalRevenue, totalExpense]);

  const nutritionExpense = useMemo(() => {
    return periodRecords
      .filter(r => r.type === "despesa" && (
        r.category === "Alimentação" ||
        r.category?.toLowerCase().includes("alimento") ||
        r.category?.toLowerCase().includes("ração")
      ))
      .reduce((acc, r) => acc + r.value, 0);
  }, [periodRecords]);

  const nutritionShare = totalExpense > 0 ? (nutritionExpense / totalExpense) * 100 : 0;

  // Alertas de contas a pagar pendentes e vencidas
  const pendingAlerts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingExpenses = records.filter(r => {
      if (r.type !== "despesa") return false;
      const meta = parseFinancialMetadata(r.description);
      return meta.isPending;
    });

    const overdue = pendingExpenses.filter(r => {
      const rDate = parseDateSafe(r.date);
      rDate.setHours(0, 0, 0, 0);
      return rDate < today;
    });

    const dueThisWeek = pendingExpenses.filter(r => {
      const rDate = parseDateSafe(r.date);
      rDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((rDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });

    const totalOverdue = overdue.reduce((acc, r) => acc + r.value, 0);
    const totalDueThisWeek = dueThisWeek.reduce((acc, r) => acc + r.value, 0);

    return {
      overdueCount: overdue.length,
      overdueValue: totalOverdue,
      dueThisWeekCount: dueThisWeek.length,
      dueThisWeekValue: totalDueThisWeek,
      hasAlerts: overdue.length > 0 || dueThisWeek.length > 0
    };
  }, [records]);

  // Evolução dos últimos 6 meses para o Gráfico
  const monthlyEvolutionData = useMemo(() => {
    const result = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const prefix = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
      const monthRecords = records.filter(r => r.date.startsWith(prefix));

      const rec = monthRecords.filter(r => r.type === "receita").reduce((acc, r) => acc + r.value, 0);
      const desp = monthRecords.filter(r => r.type === "despesa").reduce((acc, r) => acc + r.value, 0);

      result.push({
        mes: MONTHS[d.getMonth()].substring(0, 3) + "/" + d.getFullYear().toString().substring(2),
        Receitas: Number(rec.toFixed(2)),
        Despesas: Number(desp.toFixed(2)),
        Saldo: Number((rec - desp).toFixed(2))
      });
    }
    return result;
  }, [records]);

  // Distribuição de Despesas por Categoria
  const categoryDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    const expenses = periodRecords.filter(r => r.type === "despesa");
    const total = expenses.reduce((acc, r) => acc + r.value, 0);

    expenses.forEach(r => {
      const cat = r.category || "Outros";
      map[cat] = (map[cat] || 0) + r.value;
    });

    return Object.entries(map)
      .map(([category, value]) => ({
        category,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [periodRecords]);

  // Submissão do Novo Lançamento
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cleanDescription || !form.value || form.value <= 0) {
      toast.error("Preencha uma descrição e um valor válido!");
      return;
    }

    const finalDescription = buildFinancialDescription(form.cleanDescription, form.isPending, form.lote);

    const payload = {
      type: form.type,
      description: finalDescription,
      value: form.value,
      date: form.date,
      category: form.category,
      payment_method: form.payment_method
    };

    await store.addFinancial(payload, form.type === "despesa" ? form.installments : 1);
    toast.success(
      form.installments > 1
        ? `${form.installments} parcelas geradas com sucesso!`
        : "Lançamento adicionado com sucesso!"
    );

    await refreshRecords();
    setShowForm(false);
    setForm({
      type: "despesa",
      cleanDescription: "",
      value: 0,
      date: new Date().toISOString().split("T")[0],
      category: "Alimentação",
      payment_method: "Pix",
      isPending: false,
      lote: "Geral",
      installments: 1
    });
  };

  // Alternar rapidamente status entre Pago e Pendente (Dar Baixa com 1 clique)
  const handleTogglePaymentStatus = async (record: Financial) => {
    const meta = parseFinancialMetadata(record.description);
    const newIsPending = !meta.isPending;
    const newDescription = buildFinancialDescription(meta.cleanDescription, newIsPending, meta.lote);

    await store.updateFinancial(record.id, {
      description: newDescription
    });

    if (newIsPending) {
      toast.info("Lançamento marcado como Pendente.");
    } else {
      toast.success("Conta baixada com sucesso como PAGA! ✓");
    }
    await refreshRecords();
  };

  // Iniciar edição inline
  const startEditing = (record: Financial) => {
    const meta = parseFinancialMetadata(record.description);
    setEditingId(record.id);
    setEditForm({
      type: record.type,
      cleanDescription: meta.cleanDescription,
      isPending: meta.isPending,
      lote: meta.lote || "Geral",
      value: record.value,
      date: record.date,
      category: record.category,
      payment_method: record.payment_method
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEditing = async () => {
    if (!editingId) return;

    const finalDescription = buildFinancialDescription(
      editForm.cleanDescription || "Sem descrição",
      !!editForm.isPending,
      editForm.lote
    );

    await store.updateFinancial(editingId, {
      type: editForm.type,
      description: finalDescription,
      value: editForm.value,
      date: editForm.date,
      category: editForm.category,
      payment_method: editForm.payment_method
    });

    toast.success("Lançamento atualizado!");
    await refreshRecords();
    cancelEditing();
  };

  const handleDelete = async (id: string) => {
    await store.deleteFinancial(id);
    toast.success("Lançamento excluído.");
    await refreshRecords();
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setSelectedDate(newDate);
  };

  // Exportar para Excel (.csv) com acentuação UTF-8 BOM
  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      toast.error("Nenhum lançamento no período para exportar.");
      return;
    }

    const headers = [
      "Data",
      "Tipo",
      "Status",
      "Categoria",
      "Descricao",
      "Centro de Custo (Lote)",
      "Forma de Pagamento",
      "Valor (R$)"
    ];

    const rows = filteredRecords.map(r => {
      const meta = parseFinancialMetadata(r.description);
      const statusText = meta.isPending ? "Pendente" : "Pago";
      const typeText = r.type === "receita" ? "Receita" : "Despesa";
      const valFormatted = (r.type === "receita" ? r.value : -r.value).toFixed(2).replace(".", ",");
      return [
        formatDateDisplay(r.date),
        typeText,
        statusText,
        r.category || "Outros",
        `"${meta.cleanDescription.replace(/"/g, '""')}"`,
        meta.lote || "Geral",
        r.payment_method || "—",
        valFormatted
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const periodStr = viewScope === "year"
      ? `ano_${selectedDate.getFullYear()}`
      : `${MONTHS[selectedDate.getMonth()].toLowerCase()}_${selectedDate.getFullYear()}`;
    link.setAttribute("href", url);
    link.setAttribute("download", `extrato_financeiro_${periodStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Extrato exportado para Excel com sucesso!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-24 space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* CABEÇALHO & CONTROLES DE PERÍODO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <Receipt className="h-8 w-8 text-emerald-600" />
              Gestão Financeira & DRE
            </h1>
            <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/40 text-emerald-700 bg-emerald-500/10">
              Pecuária de Precisão
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Controle de fluxo de caixa, contas a pagar, custos por cabeça e indicadores da fazenda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Escopo: Mês ou Ano */}
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/80">
            <button
              type="button"
              onClick={() => setViewScope("month")}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                viewScope === "month"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mês
            </button>
            <button
              type="button"
              onClick={() => setViewScope("year")}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                viewScope === "year"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ano ({selectedDate.getFullYear()})
            </button>
          </div>

          {/* Navegação de Mês/Ano */}
          <div className="flex items-center bg-card rounded-xl p-1 border shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeMonth(viewScope === "month" ? -1 : -12)}
              className="h-8 w-8"
              title="Período anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 text-xs font-black uppercase tracking-wider min-w-[120px] text-center">
              {viewScope === "month"
                ? `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
                : `Ano ${selectedDate.getFullYear()}`}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeMonth(viewScope === "month" ? 1 : 12)}
              className="h-8 w-8"
              title="Próximo período"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Exportar Excel */}
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="h-9 font-bold text-xs gap-1.5 shadow-sm"
            title="Exportar para Excel / CSV"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Exportar Excel
          </Button>

          {/* Botão Novo Lançamento */}
          <Button
            onClick={() => setShowForm(!showForm)}
            className="h-9 px-4 font-extrabold shadow-md bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Novo Lançamento
          </Button>
        </div>
      </div>

      {/* BANNER DE ALERTA: CONTAS A VENCER OU VENCIDAS */}
      {pendingAlerts.hasAlerts && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                Atenção ao Fluxo de Contas a Pagar
              </h4>
              <p className="text-xs text-amber-800/90 dark:text-amber-400/90 mt-0.5">
                {pendingAlerts.overdueCount > 0 && (
                  <span className="font-bold text-rose-700 dark:text-rose-400 mr-2">
                    {pendingAlerts.overdueCount} conta(s) vencida(s) (R$ {pendingAlerts.overdueValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                  </span>
                )}
                {pendingAlerts.dueThisWeekCount > 0 && (
                  <span>
                    {pendingAlerts.dueThisWeekCount} conta(s) a vencer nos próximos 7 dias (R$ {pendingAlerts.dueThisWeekValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFilterStatus("pendente")}
            className="h-8 text-xs font-bold border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-500/20 whitespace-nowrap"
          >
            Filtrar Pendências
          </Button>
        </div>
      )}

      {/* CARDS DE INDICADORES PRINCIPAIS & ZOOTÉCNICOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Receitas */}
        <Card className="border shadow-sm bg-card relative overflow-hidden">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <p className="text-[10px] uppercase font-black text-emerald-600 tracking-wider flex items-center justify-between">
              <span>Receitas</span>
              <TrendingUp className="h-3.5 w-3.5" />
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl font-black text-emerald-600 tracking-tight">
              R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              {totalPendingRevenue > 0 ? (
                <span className="text-amber-600 font-semibold">
                  R$ {totalPendingRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} a receber
                </span>
              ) : (
                <span className="text-emerald-700">100% recebido</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Despesas */}
        <Card className="border shadow-sm bg-card relative overflow-hidden">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <p className="text-[10px] uppercase font-black text-rose-600 tracking-wider flex items-center justify-between">
              <span>Despesas</span>
              <TrendingDown className="h-3.5 w-3.5" />
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl font-black text-rose-600 tracking-tight">
              R$ {totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              {totalPendingExpense > 0 ? (
                <span className="text-amber-600 font-semibold">
                  R$ {totalPendingExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} pendente
                </span>
              ) : (
                <span className="text-slate-600">Total liquidado</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Saldo Líquido & Margem */}
        <Card className="border shadow-sm bg-card relative overflow-hidden">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-wider flex items-center justify-between">
              <span>Saldo Líquido</span>
              <Wallet className="h-3.5 w-3.5" />
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className={`text-xl font-black tracking-tight ${balance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"}`}>
              R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Margem: <strong className={operatingMargin >= 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                {operatingMargin.toFixed(1)}%
              </strong>
            </p>
          </CardContent>
        </Card>

        {/* Custo por Cabeça / Mês */}
        <Card className="border shadow-sm bg-card relative overflow-hidden">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <p className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-300 tracking-wider flex items-center justify-between">
              <span>Custo / Cabeça</span>
              <Beef className="h-3.5 w-3.5 text-emerald-600" />
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl font-black text-foreground tracking-tight">
              R$ {costPerHead.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {activeAnimalsCount} animais ativos
            </p>
          </CardContent>
        </Card>

        {/* Custo por Hectare */}
        <Card className="border shadow-sm bg-card relative overflow-hidden">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <p className="text-[10px] uppercase font-black text-slate-700 dark:text-slate-300 tracking-wider flex items-center justify-between">
              <span>Custo / Hectare</span>
              <LandPlot className="h-3.5 w-3.5 text-blue-600" />
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl font-black text-foreground tracking-tight">
              R$ {costPerHectare.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {totalPastureArea.toFixed(1)} ha de pastos
            </p>
          </CardContent>
        </Card>

        {/* Nutrição e Alimentação */}
        <Card className="border shadow-sm bg-card relative overflow-hidden">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <p className="text-[10px] uppercase font-black text-amber-700 dark:text-amber-400 tracking-wider flex items-center justify-between">
              <span>Nutrição & Ração</span>
              <Wheat className="h-3.5 w-3.5" />
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl font-black text-amber-700 dark:text-amber-400 tracking-tight">
              R$ {nutritionExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              <strong>{nutritionShare.toFixed(1)}%</strong> do custo total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* FORMULÁRIO DE NOVO LANÇAMENTO (QUANDO EXPANDIDO) */}
      {showForm && (
        <Card className="border-2 border-emerald-500/40 bg-emerald-500/[0.02] shadow-xl animate-in slide-in-from-top-4 duration-300">
          <CardHeader className="pb-3 border-b bg-muted/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-black flex items-center gap-2 text-foreground">
                <Plus className="h-4 w-4 text-emerald-600" />
                Novo Lançamento Financeiro
              </CardTitle>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Tipo */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Tipo de Movimento</Label>
                  <Select
                    value={form.type}
                    onValueChange={v => setForm(f => ({
                      ...f,
                      type: v,
                      category: v === "receita" ? "Venda de Bois / Novilhos" : "Alimentação"
                    }))}
                  >
                    <SelectTrigger className="font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="despesa" className="text-rose-600 font-bold">Despesa (-)</SelectItem>
                      <SelectItem value="receita" className="text-emerald-600 font-bold">Receita (+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Categoria */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(form.type === "receita" ? REVENUE_CATEGORIES : CATEGORIES).map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Descrição */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Descrição / Fornecedor / Observação</Label>
                  <Input
                    value={form.cleanDescription}
                    onChange={e => setForm(f => ({ ...f, cleanDescription: e.target.value }))}
                    placeholder="Ex: Sal mineral 80 sacos - Casa da Lavoura"
                    className="font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
                {/* Valor */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Valor (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={form.value || ""}
                      onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))}
                      className="pl-8 font-black text-base"
                      placeholder="0,00"
                      required
                    />
                  </div>
                </div>

                {/* Data */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Data do Lançamento</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="font-medium"
                    required
                  />
                </div>

                {/* Status: Pago ou Pendente */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Status do Pagamento</Label>
                  <Select
                    value={form.isPending ? "pendente" : "pago"}
                    onValueChange={v => setForm(f => ({ ...f, isPending: v === "pendente" }))}
                  >
                    <SelectTrigger className="font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago" className="text-emerald-600 font-bold">Pago / Liquidado ✓</SelectItem>
                      <SelectItem value="pendente" className="text-amber-600 font-bold">Pendente (A Pagar / Receber)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Centro de Custo / Lote */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Centro de Custo (Lote)</Label>
                  <Select value={form.lote} onValueChange={v => setForm(f => ({ ...f, lote: v }))}>
                    <SelectTrigger className="font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Geral">Geral da Fazenda</SelectItem>
                      {availableLots.map(l => (
                        <SelectItem key={l} value={l}>Lote: {l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Forma de Pagamento */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Forma de Pagamento</Label>
                  <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger className="font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Parcelamento (apenas para despesas) */}
              {form.type === "despesa" && (
                <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-muted/30 rounded-xl border">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">
                      Dividir em Parcelas Mensais?
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="48"
                      value={form.installments}
                      onChange={e => setForm(f => ({ ...f, installments: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="w-20 font-bold text-center h-8"
                    />
                    <span className="text-xs text-muted-foreground">
                      {form.installments > 1 && (
                        <span>
                          (Serão geradas <strong>{form.installments} parcelas</strong> de{" "}
                          <strong>R$ {(form.value / form.installments).toFixed(2)}</strong> cada nos próximos meses)
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-5">
                      Confirmar Lançamento {form.installments > 1 ? `(${form.installments}x)` : ""}
                    </Button>
                  </div>
                </div>
              )}

              {form.type === "receita" && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-5">
                    Confirmar Receita
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {/* TABS DE VISUALIZAÇÃO: TABELA vs GRÁFICOS */}
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
              activeTab === "table"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            Lançamentos ({filteredRecords.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("charts")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
              activeTab === "charts"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Gráficos & Distribuição
          </button>
        </div>

        {/* Resumo do filtro */}
        <div className="text-xs text-muted-foreground hidden sm:block">
          Mostrando <strong>{filteredRecords.length}</strong> registros no período
        </div>
      </div>

      {/* ABA DE GRÁFICOS & DISTRIBUIÇÃO */}
      {activeTab === "charts" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          {/* Gráfico de Evolução Mensal */}
          <Card className="lg:col-span-7 border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  Evolução Semestral (Receitas vs Despesas)
                </span>
                <span className="text-xs font-normal text-muted-foreground">Últimos 6 Meses</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyEvolutionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      formatter={(val: number) => `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "none", color: "#fff", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Bar dataKey="Receitas" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Despesas" fill="#e11d48" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Distribuição de Custos por Categoria */}
          <Card className="lg:col-span-5 border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-amber-600" />
                Despesas por Categoria (Período Atual)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {categoryDistribution.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground italic">
                  Nenhuma despesa registrada neste período.
                </div>
              ) : (
                <div className="space-y-3 pt-1 max-h-[280px] overflow-y-auto pr-1">
                  {categoryDistribution.map(item => (
                    <div key={item.category} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-foreground truncate max-w-[180px]">{item.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-foreground">
                            R$ {item.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-muted-foreground w-10 text-right">
                            {item.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, item.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA DA TABELA DE LANÇAMENTOS COM BUSCA E FILTROS */}
      {activeTab === "table" && (
        <div className="space-y-4">
          {/* BARRA DE FILTROS & BUSCA INTELIGENTE */}
          <div className="bg-card p-3 rounded-2xl border shadow-sm flex flex-col md:flex-row items-center gap-3">
            {/* Campo de Busca */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar descrição, lote, fornecedor..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Filtros em Linha */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:ml-auto">
              {/* Tipo */}
              <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                <SelectTrigger className="h-9 text-xs w-[110px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  <SelectItem value="receita">Receitas (+)</SelectItem>
                  <SelectItem value="despesa">Despesas (-)</SelectItem>
                </SelectContent>
              </Select>

              {/* Status */}
              <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger className="h-9 text-xs w-[125px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="pago">Apenas Pagos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="atrasado">Atrasados</SelectItem>
                </SelectContent>
              </Select>

              {/* Categoria */}
              <Select value={filterCategory} onValueChange={v => setFilterCategory(v)}>
                <SelectTrigger className="h-9 text-xs w-[130px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  {[...CATEGORIES, ...REVENUE_CATEGORIES].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Lote */}
              {availableLots.length > 0 && (
                <Select value={filterLote} onValueChange={v => setFilterLote(v)}>
                  <SelectTrigger className="h-9 text-xs w-[115px]">
                    <SelectValue placeholder="Lote" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Lotes</SelectItem>
                    <SelectItem value="Geral">Geral</SelectItem>
                    {availableLots.map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Limpar filtros */}
              {(searchTerm || filterType !== "all" || filterStatus !== "all" || filterCategory !== "all" || filterLote !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterType("all");
                    setFilterStatus("all");
                    setFilterCategory("all");
                    setFilterLote("all");
                  }}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* TABELA DE LANÇAMENTOS */}
          <div className="bg-card rounded-2xl border shadow-sm overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Data</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest text-center">Status / Liquidação</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Categoria</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Descrição</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Centro de Custo</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Pagamento</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Valor</TableHead>
                  <TableHead className="w-[90px] text-[10px] font-black uppercase tracking-widest text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((r) => {
                  const meta = parseFinancialMetadata(r.description);
                  const isEditing = editingId === r.id;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const rDate = parseDateSafe(r.date);
                  rDate.setHours(0, 0, 0, 0);
                  const isOverdue = meta.isPending && rDate < today;

                  if (isEditing) {
                    return (
                      /* LINHA DE EDIÇÃO INLINE */
                      <TableRow key={r.id} className="bg-emerald-500/10 border-b border-emerald-500/30">
                        {/* Data */}
                        <TableCell>
                          <Input
                            type="date"
                            className="h-8 text-xs w-[125px]"
                            value={editForm.date || ""}
                            onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                          />
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Select
                            value={editForm.isPending ? "pendente" : "pago"}
                            onValueChange={v => setEditForm(f => ({ ...f, isPending: v === "pendente" }))}
                          >
                            <SelectTrigger className="h-8 text-xs w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pago">Pago ✓</SelectItem>
                              <SelectItem value="pendente">Pendente</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Categoria */}
                        <TableCell>
                          <Select
                            value={editForm.category || ""}
                            onValueChange={v => setEditForm(f => ({ ...f, category: v }))}
                          >
                            <SelectTrigger className="h-8 text-xs w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[...CATEGORIES, ...REVENUE_CATEGORIES].map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Descrição limpa */}
                        <TableCell>
                          <Input
                            className="h-8 text-xs"
                            value={editForm.cleanDescription || ""}
                            onChange={e => setEditForm(f => ({ ...f, cleanDescription: e.target.value }))}
                          />
                        </TableCell>

                        {/* Lote */}
                        <TableCell>
                          <Select
                            value={editForm.lote || "Geral"}
                            onValueChange={v => setEditForm(f => ({ ...f, lote: v }))}
                          >
                            <SelectTrigger className="h-8 text-xs w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Geral">Geral</SelectItem>
                              {availableLots.map(l => (
                                <SelectItem key={l} value={l}>{l}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Pagamento */}
                        <TableCell>
                          <Select
                            value={editForm.payment_method || ""}
                            onValueChange={v => setEditForm(f => ({ ...f, payment_method: v }))}
                          >
                            <SelectTrigger className="h-8 text-xs w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_METHODS.map(m => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Valor */}
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 text-xs text-right w-[100px]"
                            value={editForm.value || ""}
                            onChange={e => setEditForm(f => ({ ...f, value: Number(e.target.value) }))}
                          />
                        </TableCell>

                        {/* Ações Salvar / Cancelar */}
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-500/20" onClick={saveEditing}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:bg-slate-500/20" onClick={cancelEditing}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    /* LINHA NORMAL */
                    <TableRow key={r.id} className="hover:bg-muted/30 transition-colors border-b border-border/40 group">
                      {/* Data */}
                      <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {formatDateDisplay(r.date)}
                      </TableCell>

                      {/* Status / Botão Rápido de Liquidação */}
                      <TableCell className="text-center">
                        {meta.isPending ? (
                          <button
                            type="button"
                            onClick={() => handleTogglePaymentStatus(r)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border transition-all hover:scale-105 active:scale-95 ${
                              isOverdue
                                ? "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-500/25"
                                : "bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25"
                            }`}
                            title="Clique para dar baixa como PAGO"
                          >
                            <Clock className="h-3 w-3" />
                            <span>{isOverdue ? "Vencido (Baixar)" : "Pendente (Baixar)"}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTogglePaymentStatus(r)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                            title="Conta paga. Clique se desejar marcar como pendente"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Pago</span>
                          </button>
                        )}
                      </TableCell>

                      {/* Categoria */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-bold text-foreground leading-tight">{r.category || "Geral"}</span>
                          <Badge
                            variant={r.type === "receita" ? "outline" : "destructive"}
                            className={`text-[8px] uppercase font-black h-3.5 px-1 rounded w-fit ${
                              r.type === "receita"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                            }`}
                          >
                            {r.type}
                          </Badge>
                        </div>
                      </TableCell>

                      {/* Descrição */}
                      <TableCell className="text-xs font-semibold tracking-tight">
                        <span className="text-foreground">{meta.cleanDescription}</span>
                      </TableCell>

                      {/* Centro de Custo / Lote */}
                      <TableCell>
                        {meta.lote ? (
                          <Badge variant="outline" className="text-[9px] font-bold bg-muted/60 text-foreground border-border/80">
                            {meta.lote}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Geral</span>
                        )}
                      </TableCell>

                      {/* Pagamento */}
                      <TableCell className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                        {r.payment_method || "—"}
                      </TableCell>

                      {/* Valor */}
                      <TableCell className={`text-right text-sm font-black tracking-tight whitespace-nowrap ${
                        r.type === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}>
                        {r.type === "receita" ? "+" : "-"}R$ {r.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>

                      {/* Ações */}
                      <TableCell>
                        <div className="flex items-center justify-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-blue-500 hover:bg-blue-500/10"
                            onClick={() => startEditing(r)}
                            title="Editar lançamento"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-rose-400 hover:bg-rose-500/10"
                                title="Excluir lançamento"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                                  <AlertTriangle className="h-5 w-5" /> Excluir Registro Financeiro
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Deseja realmente excluir <strong>"{meta.cleanDescription}"</strong> no valor de{" "}
                                  <strong>R$ {r.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>? Esta operação não pode ser revertida.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(r.id)}
                                  className="bg-rose-600 hover:bg-rose-700 font-bold"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic text-xs">
                      Nenhum lançamento financeiro encontrado com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
