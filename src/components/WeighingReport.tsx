import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, AlertTriangle, TrendingUp, TrendingDown, Users, Weight, BarChart3 } from "lucide-react";
import { Animal, AnimalEvent, store } from "@/lib/store";

interface AnimalPerformance {
  animal: Animal;
  gain: number;
  gmd: number;
  isAlert: boolean;
  days: number;
  currentWeight: number;
  prevWeight: number;
}

interface WeighingReportProps {
  isOpen: boolean;
  onClose: () => void;
  loteId: string;
  weightedAnimalIds: string[]; // IDs of animals weighted in this session
}

export default function WeighingReport({ isOpen, onClose, loteId, weightedAnimalIds }: WeighingReportProps) {
  const performanceData = useMemo(() => {
    const data: AnimalPerformance[] = [];
    const THRESHOLD = 0.5; // kg/day

    weightedAnimalIds.forEach(id => {
      const animal = store.getAnimal(id);
      if (!animal) return;

      const events = store.getEventsByAnimal(id)
        .filter(e => e.type === "pesagem")
        .sort((a, b) => b.date.localeCompare(a.date));

      if (events.length < 2) return; // Need at least two weigh-ins

      const today = events[0];
      const prev = events[1];
      
      const gain = today.weight - prev.weight;
      const msDiff = new Date(today.date).getTime() - new Date(prev.date).getTime();
      const days = Math.max(1, Math.floor(msDiff / (1000 * 3600 * 24)));
      const gmd = gain / days;
      const isAlert = gmd < THRESHOLD;

      data.push({
        animal,
        gain,
        gmd,
        isAlert,
        days,
        currentWeight: today.weight,
        prevWeight: prev.weight
      });
    });

    return data;
  }, [weightedAnimalIds, isOpen]);

  const stats = useMemo(() => {
    if (performanceData.length === 0) return null;

    const totalGain = performanceData.reduce((acc, d) => acc + d.gain, 0);
    const avgGmd = performanceData.reduce((acc, d) => acc + d.gmd, 0) / performanceData.length;
    
    const sortedByGain = [...performanceData].sort((a, b) => b.gain - a.gain);
    const best = sortedByGain[0];
    const worst = sortedByGain[sortedByGain.length - 1];

    return { totalGain, avgGmd, best, worst, count: performanceData.length };
  }, [performanceData]);

  if (!stats) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
        <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 text-white relative">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic tracking-tight text-white flex items-center gap-2">
              <BarChart3 className="h-6 w-6" /> RELATÓRIO DE PESAGEM
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20">
              <p className="text-[10px] font-black uppercase opacity-70 mb-1">Ganho Médio Lote</p>
              <p className="text-xl font-black italic leading-none">{stats.avgGmd.toFixed(2)}kg/dia</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20">
              <p className="text-[10px] font-black uppercase opacity-70 mb-1">Animais Analisados</p>
              <p className="text-xl font-black italic leading-none">{stats.count} cabeças</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4 bg-background">
          {/* Destaques */}
          <div className="grid grid-cols-2 gap-3">
             <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-600">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <p className="text-[10px] font-black text-emerald-700 uppercase">Melhor Ganho</p>
                </div>
                <p className="font-black text-emerald-900 leading-none">Brinco {stats.best.animal.tag}</p>
                <p className="text-lg font-black text-emerald-600 mt-1">+{stats.best.gain}kg</p>
             </div>

             <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-600">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <p className="text-[10px] font-black text-rose-700 uppercase">Pior Ganho</p>
                </div>
                <p className="font-black text-rose-900 leading-none">Brinco {stats.worst.animal.tag}</p>
                <p className="text-lg font-black text-rose-600 mt-1">+{stats.worst.gain}kg</p>
             </div>
          </div>

          {/* Lista Detalhada */}
          <div className="space-y-2">
             <h3 className="text-xs font-black uppercase text-muted-foreground px-1">Detalhamento por Cabeça</h3>
             <ScrollArea className="h-[250px] pr-4">
                <div className="space-y-2 pb-4">
                   {performanceData.map((d, i) => (
                      <div key={i} className={`p-3 rounded-xl border flex items-center justify-between ${d.isAlert ? 'bg-rose-50 border-rose-200 shadow-sm' : 'bg-card'}`}>
                         <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-black italic ${d.isAlert ? 'bg-rose-100 text-rose-600' : 'bg-muted text-muted-foreground'}`}>
                               {d.animal.tag}
                            </div>
                            <div>
                               <p className="text-xs font-black uppercase text-muted-foreground leading-none mb-1">GMD Estimado</p>
                               <p className={`font-black tracking-tight ${d.isAlert ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {d.gmd.toFixed(3)} kg/dia
                               </p>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none">+ {d.gain}kg</p>
                            {d.isAlert && (
                               <Badge variant="destructive" className="mt-1 text-[8px] h-4 uppercase font-bold">Baixo Ganho</Badge>
                            )}
                         </div>
                      </div>
                   ))}
                </div>
             </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
