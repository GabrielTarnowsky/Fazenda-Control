import { useEffect, useState, useMemo } from "react";
import { store, Financial, formatDateDisplay } from "@/lib/store";
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
  MoreHorizontal
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Financial>>({});
  const [form, setForm] = useState({
    type: "despesa",
    description: "",
    value: 0,
    date: new Date().toISOString().split("T")[0],
    category: "Outros",
    payment_method: "Pix",
    installments: 1
  });

  const refreshRecords = async () => {
    const data = await store.getFinancials();
    setRecords(data);
  };

  useEffect(() => {
    refreshRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    const targetYear = selectedDate.getFullYear().toString();
    const targetMonth = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const monthPrefix = `${targetYear}-${targetMonth}`;

    return records.filter(r => r.date.startsWith(monthPrefix))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records, selectedDate]);

  const totalRevenue = useMemo(() => 
    filteredRecords.filter(r => r.type === "receita").reduce((acc, r) => acc + r.value, 0),
  [filteredRecords]);

  const totalExpense = useMemo(() => 
    filteredRecords.filter(r => r.type === "despesa").reduce((acc, r) => acc + r.value, 0),
  [filteredRecords]);

  const balance = totalRevenue - totalExpense;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.value) {
      toast.error("Preencha descrição e valor");
      return;
    }
    await store.addFinancial(form, form.installments);
    toast.success("Registro adicionado!");
    await refreshRecords();
    setShowForm(false);
    setForm({
      type: "despesa",
      description: "",
      value: 0,
      date: new Date().toISOString().split("T")[0],
      category: "Outros",
      payment_method: "Pix",
      installments: 1
    });
  };

  const startEditing = (record: Financial) => {
    setEditingId(record.id);
    setEditForm({
      type: record.type,
      description: record.description,
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
    await store.updateFinancial(editingId, editForm);
    toast.success("Registro atualizado!");
    await refreshRecords();
    cancelEditing();
  };

  const handleDelete = async (id: string) => {
    await store.deleteFinancial(id);
    toast.success("Registro excluído");
    await refreshRecords();
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
                  <Input 
                    type="number" 
                    step="0.01"
                    value={form.value || ""} 
                    onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} 
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0.00" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Data</Label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                {form.type === "despesa" && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-left-4 duration-500">
                    <Label className="text-xs font-bold uppercase flex items-center gap-1 text-primary">
                      Parcelas <Badge variant="outline" className="text-[9px] h-4 py-0 border-primary/30 text-primary">Novo</Badge>
                    </Label>
                    <Input 
                      type="number" 
                      min="1" 
                      max="48" 
                      value={form.installments} 
                      onChange={e => setForm(f => ({ ...f, installments: Number(e.target.value) }))} 
                      className="border-primary/20 focus-visible:ring-primary shadow-sm font-bold"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2 text-right md:col-start-4">
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                  <Button type="submit" className="font-bold shadow-md">Lançar {form.installments > 1 ? `${form.installments}x` : ""}</Button>
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
              <TableHead className="w-[80px] text-[10px] font-black uppercase tracking-widest text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.map((r) => (
              editingId === r.id ? (
                /* ===== INLINE EDIT ROW ===== */
                <TableRow key={r.id} className="bg-primary/5 border-b border-primary/20">
                  <TableCell>
                    <Input
                      type="date"
                      className="h-8 text-xs w-[120px]"
                      value={editForm.date || ""}
                      onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={editForm.category || ""} onValueChange={v => setEditForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[...CATEGORIES, ...REVENUE_CATEGORIES].map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-xs"
                      value={editForm.description || ""}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={editForm.payment_method || ""} onValueChange={v => setEditForm(f => ({ ...f, payment_method: v }))}>
                      <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs text-right w-[100px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={editForm.value || ""}
                      onChange={e => setEditForm(f => ({ ...f, value: Number(e.target.value) }))}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" onClick={saveEditing}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:bg-slate-50" onClick={cancelEditing}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                /* ===== NORMAL ROW ===== */
                <TableRow key={r.id} className="hover:bg-muted/30 transition-colors border-b border-border/40 group">
                  <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {formatDateDisplay(r.date)}
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
                  <TableCell>
                    <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-500 hover:bg-blue-50" onClick={() => startEditing(r)} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-400 hover:bg-rose-50" title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                              <AlertTriangle className="h-5 w-5" /> Excluir Registro
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja excluir "<strong>{r.description}</strong>" no valor de R$ {r.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(r.id)} className="bg-rose-600 hover:bg-rose-700 font-bold">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              )
            ))}
            {filteredRecords.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic text-xs">
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
              <AlertDialogAction onClick={async () => {
                await store.clearFinancials();
                window.location.reload();
              }} className="bg-rose-600 hover:bg-rose-700 font-bold">Zerar para Testar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
