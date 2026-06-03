import { useEffect, useState } from "react";
import { store, Animal } from "@/lib/store";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Weight, TrendingUp, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface LoteStats {
  nome: string;
  quantidade: number;
  pesoTotal: number;
  pesoMedio: number;
  isVendido: boolean;
  dataFim: string;
}

export default function Lotes() {
  const [stats, setStats] = useState<LoteStats[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [animals, allEvents] = await Promise.all([
          store.getAnimals(),
          store.getEvents()
        ]);

        const lotesMap: Record<string, Animal[]> = {};

        animals.forEach(a => {
          const loteName = a.lote_id || "Sem Lote";
          if (!lotesMap[loteName]) lotesMap[loteName] = [];
          lotesMap[loteName].push(a);
        });

        const lotesStats: LoteStats[] = Object.keys(lotesMap).map(nome => {
          const loteAnimals = lotesMap[nome];
          
          let somaPesoFinal = 0;
          let maxDate = "";

          loteAnimals.forEach(a => {
            const animalEvents = allEvents.filter(e => e.animal_id === a.id);
            animalEvents.forEach(e => {
              if (e.date > maxDate) maxDate = e.date;
            });

            let pSai = (a.peso_saida && a.peso_saida > 0) ? a.peso_saida : 0;
            
            if (pSai === 0 && (a.status === "vendido" || a.status === "morto")) {
              const saleEvent = animalEvents.find(e => e.type === "venda" || e.type === "morte");
              if (saleEvent && saleEvent.weight > 0) {
                pSai = saleEvent.weight;
              }
            }
            
            const pesoFinal = pSai > 0 ? pSai : (a.weight || 0);
            somaPesoFinal += pesoFinal;
          });

          const pesoMedioFinal = loteAnimals.length ? somaPesoFinal / loteAnimals.length : 0;
          const isVendido = loteAnimals.length > 0 && loteAnimals.every(a => a.status === "vendido" || a.status === "morto");
          
          return {
            nome,
            quantidade: loteAnimals.length,
            pesoTotal: somaPesoFinal,
            pesoMedio: pesoMedioFinal,
            isVendido,
            dataFim: maxDate
          };
        });

        lotesStats.sort((a, b) => {
          if (a.nome === "Sem Lote") return 1;
          if (b.nome === "Sem Lote") return -1;
          if (a.isVendido !== b.isVendido) return a.isVendido ? 1 : -1;
          if (a.isVendido && b.isVendido) return b.dataFim.localeCompare(a.dataFim);
          return a.nome.localeCompare(b.nome);
        });

        setStats(lotesStats);
      } catch (e) {
        toast.error('Erro ao carregar dados. Verifique sua conexão.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-4 pb-20 animate-fade-in space-y-4">
      <h1 className="font-display text-xl font-bold mb-6">Dashboard de Lotes</h1>

      {stats.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum lote ou animal cadastrado.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stats.map(lote => (
            <Card 
              key={lote.nome} 
              className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${lote.isVendido ? 'bg-card border-l-destructive border-t-muted border-r-muted border-b-muted' : 'bg-card border-l-primary border-t-muted border-r-muted border-b-muted'}`} 
              onClick={() => navigate(`/lotes/${encodeURIComponent(lote.nome)}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  {lote.nome} 
                  {lote.isVendido ? (
                    <span className="text-[10px] uppercase font-bold bg-destructive/20 text-destructive px-2 py-0.5 rounded ml-2">Finalizado</span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-700 px-2 py-0.5 rounded ml-2">Em Andamento</span>
                  )}
                  <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Animais</p>
                      <p className="font-semibold">{lote.quantidade} cabeças</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-info/10 rounded-lg text-info">
                      <Weight className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Peso Médio Final</p>
                      <p className="font-semibold">{lote.pesoMedio.toFixed(1)} kg</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 col-span-2">
                    <div className="p-2 bg-success/10 rounded-lg text-success">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Peso Total</p>
                      <p className="font-semibold">{lote.pesoTotal.toFixed(1)} kg</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
