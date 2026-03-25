import { useEffect, useState, useMemo } from "react";
import { store, Financial } from "@/lib/store";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  DollarSign,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  AlertTriangle
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
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const CATEGORIES = [
  "Alimentação", "Saúde / Medicamentos", "Mão de Obra",
  "Manutenção", "Impostos / Taxas", "Compra de Animais",
  "Combustível", "Infraestrutura", "Outros"
];

const REVENUE_CATEGORIES = [
  "Venda de Animais", "Venda de Insumos", "Prestação de Serviço", "Outros"
];

const PAYMENT_METHODS = [
  "Pix", "Dinheiro", "Boleto", "Cartão", "Transferência"
];

export default function FinancialPage() {
  const [records, setRecords] = useState<Financial[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [form, setForm] = useState({
    type: "despesa",
    description: "",
    value: 0,
    date: new Date().toISOString().split("T")[0],
    category: "Outros",
    payment_method: "Pix"
  });

  useEffect(() => {
    setRecords(store.getFinancials());
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const date = new Date(r.date);
      return date.getMonth() === selectedDate.getMonth() &&
             date.getFullYear() === selectedDate.getFullYear();
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, selectedDate]);

  const totalRevenue = useMemo(() => 
    filteredRecords.filter(r => r.type === "receita").reduce((acc, r) => acc + r.value, 0),
  [filteredRecords]);

  const totalExpense = useMemo(() => 
    filteredRecords.filter(r => r.type === "despesa").reduce((acc, r) => acc + r.value, 0),
  [filteredRecords]);

  const balance = totalRevenue - totalExpense;

  const chartData = useMemo(() => {
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    const data = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      total: 0
    }));

    filteredRecords.forEach(r => {
      const day = new Date(r.date).getDate();
      if (day <= daysInMonth) {
        data[day - 1].total += r.type === "receita" ? r.value : -r.value;
      }
    });

    return data;
  }, [filteredRecords, selectedDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.value) {
      toast.error("Preencha descrição e valor");
      return;
    }
    store.addFinancial(form);
    toast.success("Registro adicionado!");
    setRecords(store.getFinancials());
    setShowForm(false);
    setForm({
      type: "despesa",
      description: "",
      value: 0,
      date: new Date().toISOString().split("T")[0],
      category: "Outros",
      payment_method: "Pix"
    });
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setSelectedDate(newDate);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground mt-1">Controle de caixa, receitas e despesas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/50 rounded-lg p-1 border">
            <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 text-xs font-bold uppercase tracking-wider min-w-[100px] text-center">
              {MONTHS[selectedDate.getMonth()].substring(0, 3)}
            </div>
            <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="shadow-lg shadow-primary/20 rounded-xl h-10 px-4 font-bold">
            <Plus className="h-5 w-5 mr-2" /> Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-none bg-emerald-50 shadow-none overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <TrendingUp className="h-12 w-12 text-emerald-600" />
          </div>
          <CardHeader className="pb-2">
            <p className="text-[10px] uppercase font-black text-emerald-600/70 tracking-widest flex items-center gap-1">
               Receitas
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-700 tracking-tighter">
              R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-rose-50 shadow-none overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <TrendingDown className="h-12 w-12 text-rose-600" />
          </div>
          <CardHeader className="pb-2">
            <p className="text-[10px] uppercase font-black text-rose-600/70 tracking-widest flex items-center gap-1">
               Despesas
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-700 tracking-tighter">
              R$ {totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card className={`border-none ${balance >= 0 ? "bg-primary/5" : "bg-orange-50"} shadow-none overflow-hidden relative border-t-4 ${balance >= 0 ? "border-t-primary" : "border-t-orange-500"}`}>
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Wallet className="h-12 w-12" />
          </div>
          <CardHeader className="pb-2">
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
              Saldo do Período
            </p>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-black tracking-tighter ${balance >= 0 ? "text-primary" : "text-orange-600"}`}>
              R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card className="mb-6 border-dashed border-2 animate-in slide-in-from-top-4 duration-300">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Tipo</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v, category: v === "receita" ? "Venda de Animais" : "Alimentação" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita (+)</SelectItem>
                      <SelectItem value="despesa">Despesa (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label className="text-xs font-bold uppercase">Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(form.type === "receita" ? REVENUE_CATEGORIES : CATEGORIES).map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-xs font-bold uppercase">Descrição</Label>
                  <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Venda de gado" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Pagamento</Label>
                  <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Valor (R$)</Label>
                  <Input type="number" step="0.01" value={form.value || ""} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Data</Label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2 text-right">
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                  <Button type="submit">Salvar</Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Spreadsheet Table View */}
      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden mb-20 overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Data</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Categoria</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Descrição</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Pagamento</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/30 transition-colors border-b border-border/40">
                <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {new Date(r.date).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-foreground leading-none">{r.category || "Geral"}</span>
                    <Badge variant={r.type === "receita" ? "outline" : "destructive"} 
                      className={`text-[9px] uppercase font-black h-4 px-1 rounded w-fit ${
                        r.type === "receita" 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {r.type}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-xs font-semibold tracking-tight truncate max-w-[150px]">
                  {r.description}
                </TableCell>
                <TableCell className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                  {r.payment_method || "—"}
                </TableCell>
                <TableCell className={`text-right text-sm font-black tracking-tighter ${r.type === "receita" ? "text-emerald-600" : "text-rose-600"}`}>
                  {r.type === "receita" ? "" : "-"}{r.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))}
            {filteredRecords.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-xs">
                  Nenhum lançamento encontrado neste período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* FERRAMENTA DE TESTE - RODAPÉ MÍNIMO */}
      <div className="fixed bottom-4 left-4 z-10">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] font-black uppercase text-slate-300 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all">
              <Trash2 className="h-3 w-3 mr-1" /> Resetar Dados (Fim da Página)
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="h-5 w-5" /> Modo de Teste
              </AlertDialogTitle>
              <AlertDialogDescription>
                Deseja limpar todos os registros financeiros para recomeçar o teste? Isso apaga gastos, alimentação e compras mas mantém o rebanho.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                store.clearFinancials();
                window.location.reload();
              }} className="bg-rose-600 hover:bg-rose-700 font-bold">Zerar para Testar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
