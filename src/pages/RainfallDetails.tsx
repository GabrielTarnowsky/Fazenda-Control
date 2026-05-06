import { useState, useEffect, useMemo } from "react";
import { store, Rainfall } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  CloudRain, 
  Calendar, 
  ChevronLeft, 
  Trash2, 
  ArrowRight,
  TrendingUp,
  Droplets,
  Search
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function RainfallDetails() {
  const navigate = useNavigate();
  const [rainfall, setRainfall] = useState<Rainfall[]>([]);
  const [autoRainfall, setAutoRainfall] = useState<any[]>([]);
  const [isAutoEnabled, setIsAutoEnabled] = useState(false);
  const [farmCoords, setFarmCoords] = useState<{lat: string, lng: string} | null>(null);
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Últimos 30 dias por padrão
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [manual, settings] = await Promise.all([
      store.getRainfall(),
      store.getSettings()
    ]);
    setRainfall(manual);

    const useAuto = settings.find(s => s.key === 'use_auto_rainfall')?.value === 'true';
    const lat = settings.find(s => s.key === 'farm_lat')?.value;
    const lng = settings.find(s => s.key === 'farm_lng')?.value;

    if (useAuto && lat && lng) {
      setIsAutoEnabled(true);
      setFarmCoords({ lat, lng });
      const autoData = await store.fetchRainfallAuto(parseFloat(lat), parseFloat(lng), startDate, endDate);
      setAutoRainfall(autoData);
    } else {
      setIsAutoEnabled(false);
      setAutoRainfall([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = () => {
    loadData();
  };

  const filteredManual = useMemo(() => {
    return rainfall.filter(r => r.date >= startDate && r.date <= endDate);
  }, [rainfall, startDate, endDate]);

  const totalMm = useMemo(() => {
    if (isAutoEnabled) {
      return autoRainfall.reduce((sum, r) => sum + r.mm, 0).toFixed(1);
    }
    return filteredManual.reduce((sum, r) => sum + r.mm, 0).toFixed(1);
  }, [filteredManual, autoRainfall, isAutoEnabled]);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    await store.deleteRainfall(id);
    toast.success("Registro excluído!");
    loadData();
  };

  return (
    <div className="p-4 pb-20 animate-fade-in space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-xl bg-muted/50"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Histórico de Chuvas</h1>
          <p className="text-sm text-muted-foreground font-medium">Análise detalhada por período</p>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="border-none shadow-xl bg-card rounded-[2rem] overflow-hidden">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Início</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/50" />
                <Input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10 h-12 rounded-2xl border-none bg-muted/50 font-bold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fim</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/50" />
                <Input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10 h-12 rounded-2xl border-none bg-muted/50 font-bold"
                />
              </div>
            </div>
            <Button 
              onClick={handleSearch}
              disabled={loading}
              className="h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black italic uppercase shadow-lg shadow-blue-600/20"
            >
              <Search className="h-4 w-4 mr-2" /> {loading ? "Buscando..." : "Filtrar Período"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Card */}
      <Card className="border-none shadow-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-[2rem] overflow-hidden relative">
        <div className="absolute right-0 top-0 p-8 opacity-10">
          <CloudRain className="h-32 w-32" />
        </div>
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Total no Período</span>
              <div className="flex items-baseline gap-2">
                <h2 className="text-6xl font-black italic tracking-tighter">{totalMm}</h2>
                <span className="text-2xl font-bold uppercase opacity-60">mm</span>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Badge className="bg-white/10 hover:bg-white/20 text-white border-none text-[9px] font-black uppercase py-1">
                  <TrendingUp className="h-3 w-3 mr-1" /> {filteredManual.length || autoRainfall.length} dias registrados
                </Badge>
                {isAutoEnabled && (
                  <Badge className="bg-emerald-500 text-white border-none text-[9px] font-black uppercase py-1">
                    Automático (Satélite)
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="hidden md:flex flex-col items-end gap-2">
              <div className="text-right">
                <p className="text-[10px] font-black uppercase opacity-40">Período Selecionado</p>
                <p className="font-bold text-sm flex items-center gap-2">
                  {new Date(startDate).toLocaleDateString()} <ArrowRight className="h-3 w-3" /> {new Date(endDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card className="border-none shadow-xl bg-card rounded-[2rem] overflow-hidden">
        <CardHeader className="p-6 border-b border-muted/50 bg-muted/20 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-500" /> Detalhes Diários
          </CardTitle>
          {isAutoEnabled && (
            <p className="text-[10px] text-muted-foreground font-bold italic">Fonte: Open-Meteo API</p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/30">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Precipitação</th>
                  {!isAutoEnabled && <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/50">
                {isAutoEnabled ? (
                  autoRainfall.filter(r => r.mm > 0).map((r, i) => (
                    <tr key={i} className="hover:bg-blue-500/5 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-bold text-sm">{new Date(r.date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black italic text-blue-600">{r.mm.toFixed(1)}</span>
                          <span className="text-[10px] font-bold text-blue-400 uppercase">mm</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  filteredManual.map((r) => (
                    <tr key={r.id} className="hover:bg-blue-500/5 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-bold text-sm">{new Date(r.date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black italic text-blue-600">{r.mm.toFixed(1)}</span>
                          <span className="text-[10px] font-bold text-blue-400 uppercase">mm</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(r.id)}
                          className="h-8 w-8 rounded-lg text-destructive opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
                {(isAutoEnabled ? autoRainfall.filter(r => r.mm > 0).length : filteredManual.length) === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 opacity-30">
                        <CloudRain className="h-12 w-12" />
                        <p className="text-sm font-bold uppercase tracking-widest">Nenhum registro no período</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
