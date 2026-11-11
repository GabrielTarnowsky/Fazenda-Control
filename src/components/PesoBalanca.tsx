import React, { useRef, useState, useEffect } from 'react';
import { BalancaSerial, BalancaStatus, BalancaSerialOpcoes } from '@/lib/balanca-serial';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Scale, Wifi, WifiOff, CheckCircle2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export interface PesoBalancaProps {
  onPesoEstavel?: (peso: number) => void;
  onPeso?: (dados: { kg: number; estavel: boolean }) => void;
  opcoes?: BalancaSerialOpcoes;
  className?: string;
  showTestSimulator?: boolean;
}

export default function PesoBalanca({
  onPesoEstavel,
  onPeso,
  opcoes,
  className = '',
  showTestSimulator = false,
}: PesoBalancaProps) {
  const balanca = useRef<BalancaSerial | null>(null);
  const [kg, setKg] = useState<number | null>(null);
  const [estavel, setEstavel] = useState<boolean>(false);
  const [status, setStatus] = useState<BalancaStatus>('desconectado');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [isIframe, setIsIframe] = useState<boolean>(false);

  useEffect(() => {
    setIsIframe(BalancaSerial.emIframe());
    return () => {
      if (balanca.current) {
        balanca.current.desconectar().catch(() => {});
      }
    };
  }, []);

  async function conectar() {
    try {
      if (!balanca.current) {
        balanca.current = new BalancaSerial({
          baudRate: 9600,
          toleranciaKg: 0.5,
          janelaEstavelMs: 2000,
          pesoMinimoKg: 5,
          ...opcoes,
        });

        balanca.current.onPeso = ({ kg: pesoLido, estavel: isEstavel }) => {
          setKg(pesoLido);
          setEstavel(isEstavel);
          if (onPeso) onPeso({ kg: pesoLido, estavel: isEstavel });
        };

        balanca.current.onEstavel = (pesoEstabilizado) => {
          toast.success(`Peso estabilizado capturado: ${pesoEstabilizado.toFixed(1)} kg!`);
          if (onPesoEstavel) onPesoEstavel(pesoEstabilizado);
        };

        balanca.current.onStatus = (estado, msg) => {
          setStatus(estado);
          setStatusMsg(msg || '');
          if (estado === 'conectado') {
            toast.success('Balança Alfa conectada com sucesso na porta serial!');
          } else if (estado === 'erro' && msg) {
            toast.error(msg);
          }
        };
      }

      await balanca.current.conectar();
    } catch (e: any) {
      console.warn('Erro ao conectar balança:', e);
    }
  }

  async function desconectar() {
    if (balanca.current) {
      await balanca.current.desconectar();
      setKg(null);
      setEstavel(false);
      toast.info('Balança desconectada.');
    }
  }

  function injetarTeste(valor: number) {
    if (!balanca.current) {
      balanca.current = new BalancaSerial(opcoes);
      balanca.current.onPeso = ({ kg: p, estavel: e }) => {
        setKg(p);
        setEstavel(e);
        if (onPeso) onPeso({ kg: p, estavel: e });
      };
      balanca.current.onEstavel = (p) => {
        if (onPesoEstavel) onPesoEstavel(p);
      };
      balanca.current.onStatus = (s, m) => {
        setStatus(s);
        setStatusMsg(m || '');
      };
    }
    balanca.current.injetar(`ST,GS,  ${valor.toFixed(1)}kg\r\n`);
  }

  return (
    <div className={`p-4 rounded-2xl border bg-card shadow-sm space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm tracking-tight">Leitura de Balança Serial</span>
        </div>

        <Badge
          variant="outline"
          className={`text-xs font-bold gap-1.5 px-2.5 py-0.5 ${
            status === 'conectado'
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
              : status === 'conectando'
              ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse'
              : status === 'erro'
              ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {status === 'conectado' ? (
            <>
              <Wifi className="h-3 w-3" /> Conectada (9600 8N1)
            </>
          ) : status === 'conectando' ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin" /> Conectando...
            </>
          ) : status === 'erro' ? (
            <>
              <AlertCircle className="h-3 w-3" /> Falha na Conexão
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" /> Desconectada
            </>
          )}
        </Badge>
      </div>

      {/* Visor de Peso */}
      <div className="p-4 rounded-xl bg-slate-950 text-white flex items-baseline justify-between">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block mb-1">
            Peso da Balança
          </span>
          <div className="text-3xl font-black font-mono tracking-tight text-emerald-400 flex items-baseline gap-1.5">
            <span>{kg !== null ? kg.toFixed(1) : '---'}</span>
            <span className="text-sm font-bold text-slate-400">kg</span>
          </div>
        </div>

        <div>
          {estavel ? (
            <Badge className="bg-emerald-500 text-slate-950 font-black text-xs gap-1 py-1 px-2.5 shadow-md">
              <CheckCircle2 className="h-3.5 w-3.5" /> ESTÁVEL
            </Badge>
          ) : kg !== null && kg > 0 ? (
            <Badge variant="outline" className="text-amber-400 border-amber-400/40 text-xs font-semibold animate-pulse">
              Oscilando...
            </Badge>
          ) : (
            <span className="text-xs text-slate-500 font-mono">Aguardando</span>
          )}
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex flex-wrap items-center gap-2">
        {status !== 'conectado' ? (
          <Button
            type="button"
            onClick={conectar}
            disabled={status === 'conectando'}
            className="flex-1 font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
          >
            {status === 'conectando' ? 'Aguardando Porta...' : 'Conectar Balança'}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={desconectar}
            className="flex-1 font-bold text-xs text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            Desconectar
          </Button>
        )}

        {isIframe && status !== 'conectado' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(window.location.href, '_blank')}
            className="text-xs font-bold gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
            title="Abrir em nova aba para contornar bloqueio de porta serial no iframe"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir em Nova Aba
          </Button>
        )}
      </div>

      {statusMsg && status === 'erro' && (
        <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900 leading-relaxed">
          {statusMsg}
        </p>
      )}

      {/* Injeção rápida para teste/homologação quando solicitado */}
      {showTestSimulator && (
        <div className="pt-2 border-t flex items-center justify-between gap-2 text-xs">
          <span className="text-[11px] text-muted-foreground font-semibold">Testar sem cabo:</span>
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => injetarTeste(452.3)}>
              Injetar 452.3kg
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => injetarTeste(0.0)}>
              Zerar (0.0kg)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
