import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LogOut, User, RotateCcw, Cloud, AlertTriangle, Beef, Activity,
  CheckCircle, TrendingUp, Sun, Moon, MapPin, CloudRain, Lock, Smartphone
} from "lucide-react";

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = store.auth.getCurrentUser();
  const [syncing, setSyncing] = useState(false);
  const [fetchingMarket, setFetchingMarket] = useState(false);
  const [marketPrice, setMarketPrice] = useState("330.00");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('bovi_theme') || 'light');

  // Location Settings
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [useAutoRainfall, setUseAutoRainfall] = useState(false);
  const [profile, setProfile] = useState({ name: user?.name || "", email: user?.email || "", cpf: user?.cpf || "" });

  const [counts, setCounts] = useState({ animals: 0, events: 0, financials: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [a, e, f, settings] = await Promise.all([
          store.getAnimals(),
          store.getEvents(),
          store.getFinancials(),
          store.getSettings()
        ]);
        setCounts({ animals: a.length, events: e.length, financials: f.length });
        
        const price = settings.find(s => s.key === 'preco_arroba_pi')?.value;
        if (price) setMarketPrice(price);

        const savedLat = settings.find(s => s.key === 'farm_lat')?.value;
        const savedLng = settings.find(s => s.key === 'farm_lng')?.value;
        const savedAuto = settings.find(s => s.key === 'use_auto_rainfall')?.value;

        if (savedLat) setLat(savedLat);
        if (savedLng) setLng(savedLng);
        if (savedAuto) setUseAutoRainfall(savedAuto === 'true');

      } catch (err) {
        console.error("Fetch err:", err);
      }
    };
    fetchData();
  }, []);

  const handleUpdatePrice = async (val: string) => {
    setMarketPrice(val);
    await store.updateSetting('preco_arroba_pi', val);
  };

  const handleSaveLocation = async () => {
    await Promise.all([
      store.updateSetting('farm_lat', lat),
      store.updateSetting('farm_lng', lng),
      store.updateSetting('use_auto_rainfall', useAutoRainfall.toString())
    ]);
    toast.success("Configurações de localização salvas!");
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada pelo seu navegador.");
      return;
    }
    toast.info("Obtendo localização...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        toast.success("Localização detectada!");
      },
      (err) => {
        toast.error("Erro ao obter localização. Verifique as permissões.");
      }
    );
  };

  const syncMarket = async () => {
    setFetchingMarket(true);
    const price = await store.fetchMarketPrice();
    if (price) {
      handleUpdatePrice(price.toFixed(2));
      toast.success(`Cotação atualizada: R$ ${price.toFixed(2)}`);
    } else {
      toast.error("Não foi possível obter a cotação automática agora.");
    }
    setFetchingMarket(false);
  };

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

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [updatingPass, setUpdatingPass] = useState(false);

  const toggleTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('bovi_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    toast.success(`Modo ${newTheme === 'dark' ? 'Escuro' : 'Claro'} ativado!`);
  };

  const handleUpdatePassword = async () => {
    if (!newPass || newPass.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (newPass !== confirmPass) {
      toast.error("As senhas não coincidem");
      return;
    }

    setUpdatingPass(true);
    try {
      await store.auth.resetPassword(user?.email || "", newPass);
      toast.success("Senha atualizada com sucesso!");
      setNewPass("");
      setConfirmPass("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar senha");
    } finally {
      setUpdatingPass(false);
    }
  };

  return (
    <div className="p-4 md:p-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seu perfil, sistema e dados</p>
      </div>

      <Tabs defaultValue="conta" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-11 bg-muted/50 p-1 mb-6 rounded-xl">
          <TabsTrigger value="conta" className="rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
            <User className="h-3.5 w-3.5" /> Conta
          </TabsTrigger>
          <TabsTrigger value="sistema" className="rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
            <Smartphone className="h-3.5 w-3.5" /> Sistema
          </TabsTrigger>
          <TabsTrigger value="dados" className="rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
            <Cloud className="h-3.5 w-3.5" /> Dados
          </TabsTrigger>
        </TabsList>

        {/* ================= ABA: CONTA ================= */}
        <TabsContent value="conta" className="space-y-5 focus-visible:outline-none focus-visible:ring-0">
          
          {/* Perfil */}
          <Card className="border shadow-sm rounded-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" /> Perfil
                </CardTitle>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px] font-bold">
                  Ativa
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Nome Completo</Label>
                  <Input 
                    value={profile.name} 
                    onChange={e => setProfile({...profile, name: e.target.value})}
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-muted-foreground">CPF / Documento</Label>
                  <Input 
                    placeholder="Somente números"
                    value={profile.cpf || ""} 
                    onChange={e => setProfile({...profile, cpf: e.target.value.replace(/\D/g, '').slice(0, 11)})}
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-[11px] font-semibold text-muted-foreground">E-mail</Label>
                  <Input 
                    disabled
                    value={profile.email} 
                    className="h-10 rounded-lg bg-muted/50 text-muted-foreground cursor-not-allowed"
                  />
                  <p className="text-[10px] text-muted-foreground/60">O e-mail não pode ser alterado.</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={async () => {
                    try {
                      await store.auth.updateProfile({ name: profile.name, cpf: profile.cpf });
                      toast.success("Perfil atualizado com sucesso!");
                    } catch (err: any) {
                      toast.error("Erro ao salvar perfil");
                    }
                  }}
                  size="sm"
                  className="rounded-lg font-bold px-5"
                >
                  Salvar Perfil
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card className="border shadow-sm rounded-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" /> Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Nova Senha</Label>
                  <Input 
                    type="password" 
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Confirmar Senha</Label>
                  <Input 
                    type="password" 
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="Repita a senha"
                    className="h-10 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={handleUpdatePassword}
                  disabled={updatingPass || !newPass}
                  variant="secondary"
                  size="sm"
                  className="rounded-lg font-bold px-5"
                >
                  {updatingPass ? "Atualizando..." : "Alterar Senha"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Logout */}
          <div className="pt-2">
            {!showLogoutConfirm ? (
              <Button 
                variant="ghost" 
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full h-11 rounded-xl text-destructive hover:bg-destructive/5 hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="font-bold text-sm">Sair da Conta</span>
              </Button>
            ) : (
              <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                <h4 className="font-bold text-destructive text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Confirmar Saída
                </h4>
                <p className="text-xs text-muted-foreground mt-1.5 mb-4">
                  Seus dados estão salvos na nuvem. Você precisará do e-mail e senha para acessar novamente.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowLogoutConfirm(false)} className="h-9 rounded-lg text-xs font-bold flex-1">
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={handleLogout} className="h-9 rounded-lg text-xs font-bold flex-1">
                    Sair Agora
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ================= ABA: SISTEMA ================= */}
        <TabsContent value="sistema" className="space-y-5 focus-visible:outline-none focus-visible:ring-0">
          
          {/* Aparência */}
          <Card className="border shadow-sm rounded-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" /> Aparência
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => toggleTheme('light')}
                  className={`h-20 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border-2 ${theme === 'light' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
                >
                  <Sun className="h-5 w-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Modo Claro</span>
                </button>
                <button 
                  onClick={() => toggleTheme('dark')}
                  className={`h-20 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border-2 ${theme === 'dark' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
                >
                  <Moon className="h-5 w-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Modo Escuro</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Localização e Clima */}
          <Card className="border shadow-sm rounded-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CloudRain className="h-4 w-4 text-muted-foreground" /> Localização e Clima
              </CardTitle>
              <CardDescription className="text-xs mt-1">Dados de chuva automáticos via satélite.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-xs font-bold">Pluviometria Automática</Label>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Baixar histórico de chuvas baseado nas coordenadas.</p>
                </div>
                <Switch checked={useAutoRainfall} onCheckedChange={setUseAutoRainfall} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Latitude</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                    <Input 
                      value={lat} 
                      onChange={(e) => setLat(e.target.value)}
                      placeholder="-5.0892" 
                      className="pl-9 h-10 rounded-lg font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Longitude</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                    <Input 
                      value={lng} 
                      onChange={(e) => setLng(e.target.value)}
                      placeholder="-42.8016" 
                      className="pl-9 h-10 rounded-lg font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={detectLocation}
                  size="sm"
                  className="flex-1 rounded-lg font-bold text-xs"
                >
                  <MapPin className="h-3.5 w-3.5 mr-1.5" /> GPS Atual
                </Button>
                <Button 
                  onClick={handleSaveLocation}
                  size="sm"
                  className="flex-1 rounded-lg font-bold text-xs"
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Salvar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Mercado */}
          <Card className="border shadow-sm rounded-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" /> Mercado (Boi Gordo)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Preço Base da Arroba (@)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-muted-foreground">R$</span>
                    <Input 
                      type="number" 
                      value={marketPrice}
                      onChange={(e) => handleUpdatePrice(e.target.value)}
                      className="h-10 w-28 rounded-lg text-lg font-bold"
                    />
                  </div>
                </div>
                <Button 
                  onClick={syncMarket}
                  disabled={fetchingMarket}
                  size="sm"
                  className="rounded-lg font-bold text-xs px-4 h-10 self-end"
                >
                  {fetchingMarket ? "Buscando..." : "Sincronizar"}
                </Button>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Valor utilizado nos relatórios e simulador. Animais com "Valor de Venda" registrado não são alterados.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= ABA: DADOS ================= */}
        <TabsContent value="dados" className="space-y-5 focus-visible:outline-none focus-visible:ring-0">
          
          {/* Sincronização */}
          <Card className="border shadow-sm rounded-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    {syncing ? (
                      <RotateCcw className="h-5 w-5 text-primary animate-spin" />
                    ) : (
                      <Cloud className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Sincronização</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Última: <span className="font-semibold text-foreground">{lastSyncFormatted}</span>
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleSync} 
                  disabled={syncing}
                  size="sm"
                  className="rounded-lg font-bold px-4"
                >
                  {syncing ? "Sincronizando..." : "Sincronizar"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resumo de Dados */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border shadow-sm rounded-xl">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <Beef className="h-5 w-5 text-primary mb-2" />
                <p className="text-2xl font-black">{counts.animals}</p>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Animais</p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm rounded-xl">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <Activity className="h-5 w-5 text-primary mb-2" />
                <p className="text-2xl font-black">{counts.events}</p>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Eventos</p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm rounded-xl">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <TrendingUp className="h-5 w-5 text-primary mb-2" />
                <p className="text-2xl font-black">{counts.financials}</p>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Financeiro</p>
              </CardContent>
            </Card>
          </div>

          {/* App Info */}
          <Card className="border shadow-sm rounded-xl bg-muted/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-background rounded-lg flex items-center justify-center border">
                    <img src="/logo.png" alt="Logo" className="h-5 w-5 object-contain" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs">FazendaControl Pro</h3>
                    <p className="text-[10px] text-muted-foreground">Gestão Pecuária Inteligente</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider">
                  v1.5.0
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
      
      <p className="text-center text-[10px] text-muted-foreground/30 font-semibold mt-10">
        FazendaControl © {new Date().getFullYear()}
      </p>
    </div>
  );
}
