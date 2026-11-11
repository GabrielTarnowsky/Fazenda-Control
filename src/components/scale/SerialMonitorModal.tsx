import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SerialDebugFrame } from "@/services/scale/webSerialService";
import { Terminal, Trash2, Pause, Play, Copy, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface SerialMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  frames: SerialDebugFrame[];
  onClear: () => void;
  isConnected: boolean;
  scaleModel: string;
}

export const SerialMonitorModal: React.FC<SerialMonitorModalProps> = ({
  isOpen,
  onClose,
  frames,
  onClear,
  isConnected,
  scaleModel
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayFrames = isPaused ? frames : frames;

  const handleCopyLogs = () => {
    if (frames.length === 0) {
      toast.info("Nenhum dado serial para copiar.");
      return;
    }
    const text = frames
      .map(f => `[${f.timestamp}] ASCII: "${f.rawAscii}" | HEX: ${f.rawHex} | PESO: ${f.parsedWeight !== undefined ? f.parsedWeight + "kg" : "N/D"}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Logs seriais copiados para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-6 rounded-3xl flex flex-col">
        <DialogHeader className="border-b pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-foreground">
              <Terminal className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-black italic tracking-tight">
                MONITOR SERIAL EM TEMPO REAL — {scaleModel}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] font-bold ${
                isConnected ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
              }`}>
                {isConnected ? "Porta Serial Aberta" : "Desconectado"}
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Inspecione os bytes e telegramas ASCII brutos transmitidos pelo indicador de pesagem
          </DialogDescription>
        </DialogHeader>

        {/* Barra de Ferramentas do Terminal */}
        <div className="flex items-center justify-between py-2 shrink-0 border-b text-xs">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
              className="h-8 text-xs font-bold gap-1.5"
            >
              {isPaused ? <Play className="h-3.5 w-3.5 text-emerald-600" /> : <Pause className="h-3.5 w-3.5 text-amber-600" />}
              {isPaused ? "Retomar Fluxo" : "Pausar Leitura"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              className="h-8 text-xs font-bold gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar Tela
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLogs}
            className="h-8 text-xs font-bold gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            Copiar Logs
          </Button>
        </div>

        {/* Janela de Terminal Preto / Monospace */}
        <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 rounded-2xl p-4 font-mono text-xs space-y-2 mt-3 border border-slate-800 shadow-inner min-h-[300px]">
          {displayFrames.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 text-center">
              <Terminal className="h-8 w-8 mb-2 opacity-30" />
              <p className="font-bold">Aguardando dados da porta serial...</p>
              <p className="text-[11px] mt-1 opacity-70">
                Certifique-se de que a balança Alfa 3102C.S está ligada e transmitindo em modo contínuo T02.
              </p>
            </div>
          ) : (
            displayFrames.map((frame) => (
              <div 
                key={frame.id}
                className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 leading-tight transition-colors"
              >
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-500 font-bold">{frame.timestamp}</span>
                  {frame.parsedWeight !== undefined ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-black h-5">
                      {frame.parsedWeight.toFixed(1)} kg {frame.isStable ? "(ST)" : "(US)"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-500 border-slate-700 text-[10px] h-5">
                      Ruído / Sem Peso
                    </Badge>
                  )}
                </div>

                <div className="flex-1 truncate mx-2 text-slate-300">
                  <span className="text-slate-500 mr-1.5">ASCII:</span>
                  <span className="text-amber-300 font-bold tracking-wide">
                    "{frame.rawAscii.replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"
                  </span>
                  {frame.statusNote && (
                    <span className="ml-2 text-[10px] text-slate-400 italic">
                      ({frame.statusNote})
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 shrink-0 font-mono hidden md:block">
                  <span className="opacity-50">HEX: </span>
                  <span className="text-slate-400">{frame.rawHex}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
