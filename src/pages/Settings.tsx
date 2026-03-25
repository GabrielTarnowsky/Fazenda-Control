import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Settings as SettingsIcon, 
  LogOut, 
  User, 
  Mail, 
  Shield, 
  RotateCcw, 
  Cloud, 
  ChevronRight,
  AlertTriangle,
  Beef,
  Activity,
  CheckCircle
} from "lucide-react";

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = store.auth.getCurrentUser();
  const [syncing, setSyncing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const lastSync = localStorage.getItem("bovi_last_sync");
  const lastSyncFormatted = lastSync 
    ? new Date(lastSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) 
    : "Nunca";

  const handleSync = async () => {
    setSyncing(true);
    try {
      const success = await store.sync();
      if (success) {
        toast.success("Dados sincronizados com sucesso!");
      } else {
        toast.error("Erro na sincronização. Tente novamente.");
      }
    } catch {
      toast.error("Falha na conexão com o servidor.");
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    store.auth.logout();
    toast.success("Até mais! 👋");
    navigate("/login", { replace: true });
  };

  // Count local data for info
  const animalCount = store.getAnimals().length;
  const eventCount = store.getEvents().length;
  const financialCount = store.getFinancials().length;

  return (
    <div className="p-4 pb-20 animate-fade-in space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center">
          <SettingsIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground font-medium">Gerencie sua conta e dados</p>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="border-none shadow-xl bg-gradient-to-br from-primary/5 via-card to-emerald-500/5 overflow-hidden rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center ring-2 ring-primary/20">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black italic tracking-tight truncate">{user?.name || "Usuário"}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground truncate">{user?.email || "—"}</p>
              </div>
              <Badge variant="outline" className="mt-2 text-[9px] font-black uppercase tracking-widest border-primary/30 text-primary bg-primary/5">
                <Shield className="h-3 w-3 mr-1" /> Conta Ativa
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Summary */}
      <Card className="border-none shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30 border-b">
          <CardTitle className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" /> Dados Neste Dispositivo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
              <p className="text-2xl font-black italic text-blue-700">{animalCount}</p>
              <p className="text-[9px] font-black uppercase text-muted-foreground mt-1">Animais</p>
            </div>
            <div className="text-center p-3 bg-purple-500/5 rounded-xl border border-purple-500/10">
              <p className="text-2xl font-black italic text-purple-700">{eventCount}</p>
              <p className="text-[9px] font-black uppercase text-muted-foreground mt-1">Eventos</p>
            </div>
            <div className="text-center p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
              <p className="text-2xl font-black italic text-emerald-700">{financialCount}</p>
              <p className="text-[9px] font-black uppercase text-muted-foreground mt-1">Financeiro</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cloud Migration Section */}
      <Card className="border-none shadow-lg rounded-2xl overflow-hidden bg-amber-500/5 border border-amber-500/10">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <Cloud className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-black text-sm text-amber-900">Migrar Dados para a Nuvem</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                Use este botão **apenas no computador onde seus dados estão salvos** para enviá-los à nuvem pela primeira vez.
              </p>
            </div>
          </div>
          <Button 
            onClick={async () => {
              if (window.confirm("Isso enviará todos os seus animais e gastos locais para o servidor. Deseja continuar?")) {
                await store.pushToCloud();
              }
            }}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black italic uppercase text-xs tracking-widest h-11 rounded-xl shadow-lg shadow-amber-600/20"
          >
            Subir Dados Locais para Nuvem
          </Button>
        </CardContent>
      </Card>

      {/* Sync Section */}
      <Card className="border-none shadow-lg rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <button 
            onClick={handleSync} 
            disabled={syncing}
            className="w-full p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors active:scale-[0.99] disabled:opacity-60"
          >
            <div className="h-11 w-11 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
              {syncing ? (
                <RotateCcw className="h-5 w-5 text-blue-600 animate-spin" />
              ) : (
                <Cloud className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-sm">{syncing ? "Sincronizando..." : "Sincronizar Dados"}</p>
              <p className="text-[11px] text-muted-foreground">
                Última sincronização: <span className="font-bold">{lastSyncFormatted}</span>
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/50 shrink-0" />
          </button>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card className="border-none shadow-lg rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 flex items-center gap-4 border-b border-muted/40">
            <div className="h-11 w-11 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <Beef className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-sm">FazendaControl</p>
              <p className="text-[11px] text-muted-foreground">Versão 1.0.0 — Gestão Pecuária</p>
            </div>
            <Badge variant="outline" className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <CheckCircle className="h-3 w-3 mr-1" /> Atualizado
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Logout Section */}
      {!showLogoutConfirm ? (
        <Button 
          variant="outline" 
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full h-14 rounded-2xl border-destructive/20 text-destructive hover:bg-destructive/5 hover:border-destructive/40 transition-all group shadow-sm"
        >
          <LogOut className="h-5 w-5 mr-3 transition-transform group-hover:-translate-x-1" />
          <span className="font-black italic uppercase tracking-wide text-sm">Sair da Conta</span>
        </Button>
      ) : (
        <Card className="border-destructive/30 bg-destructive/5 rounded-2xl overflow-hidden shadow-lg animate-in slide-in-from-bottom-4 duration-300">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 bg-destructive/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-black text-sm text-destructive">Confirmar Saída</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Seus dados continuam salvos na nuvem. Para acessar novamente, basta fazer login com seu email e senha.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowLogoutConfirm(false)}
                className="h-12 rounded-xl font-bold uppercase text-xs"
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleLogout}
                className="h-12 rounded-xl font-black italic uppercase text-xs shadow-lg shadow-destructive/20 tracking-wide"
              >
                <LogOut className="h-4 w-4 mr-2" /> Sair Agora
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <p className="text-center text-[10px] text-muted-foreground/50 font-bold uppercase tracking-[0.3em] pt-4">
        FazendaControl © 2024 — Todos os direitos reservados
      </p>
    </div>
  );
}
