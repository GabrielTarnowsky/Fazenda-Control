import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, RefreshCw, AlertCircle, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function SupabaseTest() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Iniciando busca na tabela 'financial'...");
      const { data: financialData, error: supabaseError } = await supabase
        .from('financial')
        .select('*');

      if (supabaseError) {
        console.error("Erro no Supabase:", supabaseError);
        setError(supabaseError.message);
      } else {
        console.log("Dados retornados:", financialData);
        setData(financialData || []);
      }
    } catch (err: any) {
      console.error("Erro inesperado:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <h1 className="text-2xl font-black italic flex items-center gap-2">
          <DollarSign className="text-primary h-6 w-6" /> TESTE FINANCEIRO SUPABASE
        </h1>
        <Button size="sm" onClick={fetchData} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <Card className="max-w-4xl mx-auto border-none shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-900 text-white">
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center justify-between">
            Dados Brutos do Banco
            <Badge variant="outline" className="text-white border-white/20">
              {data.length} Registros
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-8 text-center space-y-3">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="font-bold text-destructive">Falha na Conexão</p>
              <code className="block bg-slate-100 p-4 rounded text-xs text-slate-700 overflow-auto">
                {error}
              </code>
            </div>
          )}

          {!error && loading && (
            <div className="p-20 text-center">
              <RefreshCw className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
              <p className="text-slate-500 font-medium italic">Consultando tabelas...</p>
            </div>
          )}

          {!error && !loading && data.length === 0 && (
            <div className="p-20 text-center text-slate-400">
              <p>Nenhum dado encontrado na tabela 'financial'.</p>
            </div>
          )}

          {!error && !loading && data.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100">
                    <TableHead className="font-black text-xs uppercase">Tipo</TableHead>
                    <TableHead className="font-black text-xs uppercase text-right">Valor</TableHead>
                    <TableHead className="font-black text-xs uppercase text-center">Data</TableHead>
                    <TableHead className="font-black text-xs uppercase text-right px-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.uuid} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell>
                        <Badge variant="outline" className={item.tipo?.toLowerCase() === 'entrada' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-rose-600 border-rose-200 bg-rose-50'}>
                          {item.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-right">
                        R$ {Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center font-medium text-slate-600">
                        {item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell className="text-right px-4">
                        <span className="font-mono text-[10px] text-slate-300">
                          {item.uuid?.substring(0, 8)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-[10px] font-black uppercase text-slate-400 tracking-tighter">
        Verifique o console do navegador (F12) para o log de debug detalhado.
      </p>
    </div>
  );
}
