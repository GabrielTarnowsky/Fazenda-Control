import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { store, Animal, AnimalEvent, formatDateDisplay } from "@/lib/store";
import { ArrowLeft, Syringe, Weight, DollarSign, Calendar, Pencil, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const typeIcons: Record<string, React.ReactNode> = {
  vacina: <Syringe className="h-4 w-4 text-info" />,
  pesagem: <Weight className="h-4 w-4 text-primary" />,
  venda: <DollarSign className="h-4 w-4 text-success" />,
  morte: <Calendar className="h-4 w-4 text-destructive" />,
};

export default function AnimalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [animal, setAnimal] = useState<Animal | undefined>();
  const [events, setEvents] = useState<AnimalEvent[]>([]);

  useEffect(() => {
    if (!id) return;
    setAnimal(store.getAnimal(id));
    setEvents(store.getEventsByAnimal(id).sort((a, b) => b.date.localeCompare(a.date)));
  }, [id]);

  if (!animal) return <div className="p-4">Animal não encontrado</div>;

  const renderEventList = (eventList: AnimalEvent[]) => {
    if (eventList.length === 0) return <p className="text-muted-foreground text-sm py-4 text-center border border-dashed rounded-lg">Nenhum evento registrado</p>;
    return (
      <div className="space-y-2">
        {eventList.map(ev => (
          <div key={ev.id} className="bg-card rounded-lg p-3 border flex items-start gap-3">
            <div className="mt-0.5">{typeIcons[ev.type] || <Calendar className="h-4 w-4" />}</div>
            <div className="flex-1">
              <p className="text-sm font-medium capitalize">{ev.type}</p>
              <p className="text-xs text-muted-foreground">{formatDateDisplay(ev.date)}</p>
              {ev.description && <p className="text-xs text-muted-foreground">{ev.description}</p>}
            </div>
            <div className="text-right text-sm">
              {ev.weight > 0 && <p>{ev.weight}kg</p>}
              {ev.value > 0 && <p className="text-success">R$ {ev.value.toFixed(2)}</p>}
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 mt-1 bg-background hover:bg-muted" 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/events/${ev.id}/edit`);
                }}
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };
  const saleEvent = events.find(e => e.type === "venda");
  const saleValue = saleEvent?.value || 0;
  const saleWeight = saleEvent?.weight || animal.peso_saida || 0;
  const profit = saleValue > 0 ? saleValue - (animal.valor_compra || 0) : 0;
  
  const pesoEnt = animal.peso_entrada || (events.filter(e => e.type === "pesagem").sort((a,b) => a.date.localeCompare(b.date))[0]?.weight) || (animal.origem === 'Nascimento' ? 30 : animal.weight);

  return (
    <div className="p-4 pb-20 animate-fade-in space-y-4">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground text-sm">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={() => navigate(`/animals/${id}/edit`)}>
             <Pencil className="h-3 w-3 mr-1.5" /> Editar
           </Button>
        </div>
      </div>

      <div className="flex items-end justify-between px-1">
        <div>
           <Badge variant={animal.status === 'vendido' ? 'destructive' : 'default'} className="mb-2 uppercase text-[10px] font-black tracking-widest px-2 py-0.5">
             {animal.status === 'ativo' ? 'No Pasto' : animal.status}
           </Badge>
           <h1 className="font-display text-4xl font-black tracking-tight leading-none italic">{animal.tag}</h1>
        </div>
        <div className="text-right">
           <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{animal.breed}</p>
           <p className="text-sm font-black text-primary">{animal.categoria}</p>
        </div>
      </div>

      {animal.status === "vendido" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
             <DollarSign className="h-5 w-5 text-emerald-600 mb-1" />
             <p className="text-xs text-emerald-700/70 font-bold uppercase tracking-tighter mb-1">Valor Venda</p>
             <p className="text-xl font-black text-emerald-700 leading-none">R$ {saleValue.toLocaleString("pt-BR")}</p>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
             <Weight className="h-5 w-5 text-blue-600 mb-1" />
             <p className="text-xs text-blue-700/70 font-bold uppercase tracking-tighter mb-1">Peso Venda</p>
             <p className="text-xl font-black text-blue-700 leading-none">{saleWeight}kg</p>
          </div>
          <div className="col-span-2 bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center justify-between shadow-sm">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                   <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Lucro na Cabeça</p>
                   <p className={`text-xl font-black leading-none ${profit >= 0 ? 'text-primary' : 'text-destructive'}`}>R$ {profit.toLocaleString("pt-BR")}</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Investimento</p>
                <p className="text-xs font-bold">R$ {animal.valor_compra?.toLocaleString("pt-BR") || "0,00"}</p>
             </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl p-4 border shadow-xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
           <div className="space-y-0.5">
             <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sexo</p>
             <p className="font-bold">{animal.sex}</p>
           </div>
           <div className="space-y-0.5">
             <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Origem</p>
             <p className="font-bold">{animal.origem}</p>
           </div>
           <div className="space-y-0.5">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Peso de Entrada</p>
              <div className="flex items-center gap-2">
                 <p className="text-lg font-black">{pesoEnt}kg</p>
              </div>
           </div>
           <div className="space-y-0.5">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">R$/@ Atual</p>
              <p className="font-bold">R$ {animal.preco_arroba?.toFixed(2) || "—"}</p>
           </div>
        </div>

        {animal.origem === "Compra" && (
          <div className="pt-4 border-t flex items-center justify-between">
             <div className="flex items-center gap-2">
               <Calendar className="h-4 w-4 text-muted-foreground" />
               <div className="text-xs leading-none">
                 <p className="font-black text-muted-foreground uppercase text-[10px] mb-0.5">Data da Compra</p>
                 <p className="font-bold">{formatDateDisplay(animal.data_compra || "")}</p>
               </div>
             </div>
             <div className="text-right">
               <p className="font-black text-muted-foreground uppercase text-[10px] mb-0.5">Valor Pago</p>
               <p className="font-bold text-sm">R$ {animal.valor_compra?.toLocaleString("pt-BR") || "0,00"}</p>
             </div>
          </div>
        )}
      </div>

      <Tabs defaultValue="todos" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4 h-10">
          <TabsTrigger value="todos" className="text-xs sm:text-sm">Todos</TabsTrigger>
          <TabsTrigger value="vacina" className="text-xs sm:text-sm">Vacinas</TabsTrigger>
          <TabsTrigger value="pesagem" className="text-xs sm:text-sm">Pesos</TabsTrigger>
          <TabsTrigger value="venda" className="text-xs sm:text-sm">Vendas</TabsTrigger>
        </TabsList>
        
        <TabsContent value="todos">
          <h2 className="font-display text-lg font-semibold mb-3">Histórico Geral</h2>
          {renderEventList(events)}
        </TabsContent>

        <TabsContent value="vacina">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold">Vacinas</h2>
            <Button size="sm" onClick={() => navigate(`/events/new?animal=${id}&type=vacina`)}>
              <Syringe className="h-4 w-4 mr-1 hidden sm:block" /> <span className="sm:hidden mr-1">+</span> Adicionar
            </Button>
          </div>
          {renderEventList(events.filter(e => e.type === "vacina"))}
        </TabsContent>

        <TabsContent value="pesagem">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold">Pesagens</h2>
            <Button size="sm" variant="outline" onClick={() => navigate(`/events/new?animal=${id}&type=pesagem`)}>
              <Weight className="h-4 w-4 mr-1 hidden sm:block" /> <span className="sm:hidden mr-1">+</span> Adicionar
            </Button>
          </div>
          {renderEventList(events.filter(e => e.type === "pesagem"))}
        </TabsContent>

        <TabsContent value="venda">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold">Vendas</h2>
            {animal.status === "ativo" && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/events/new?animal=${id}&type=venda`)}>
                <DollarSign className="h-4 w-4 mr-1 hidden sm:block" /> <span className="sm:hidden mr-1">+</span> Adicionar
              </Button>
            )}
          </div>
          {renderEventList(events.filter(e => e.type === "venda"))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
