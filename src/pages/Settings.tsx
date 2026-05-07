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
import { Separator } from "@/components/ui/separator";
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
  CheckCircle,
  TrendingUp,
  Sun,
  Moon,
  MapPin,
  CloudRain,
  Lock,
  Smartphone
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
    <div className="p-4 md:p-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center ring-1 ring-primary/20 shadow-sm">
            <SettingsIcon className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
            <p className="text-sm text-muted-foreground font-medium mt-1">Gerencie seu perfil, sistema e dados</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="conta" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-14 bg-muted/40 p-1 mb-8 rounded-2xl">
          <TabsTrigger value="conta" className="rounded-xl text-xs md:text-sm font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <User className="h-4 w-4 mr-2" /> Conta
          </TabsTrigger>
          <TabsTrigger value="sistema" className="rounded-xl text-xs md:text-sm font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Smartphone className="h-4 w-4 mr-2" /> Sistema
          </TabsTrigger>
          <TabsTrigger value="dados" className="rounded-xl text-xs md:text-sm font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Cloud className="h-4 w-4 mr-2" /> Dados
          </TabsTrigger>
        </TabsList>

        {/* ================= ABA: CONTA ================= */}
        <TabsContent value="conta" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
          
          {/* Perfil */}
          <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> Perfil Pessoal
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">Atualize suas informações básicas.</CardDescription>
                </div>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0 font-bold">
                  <Shield className="h-3 w-3 mr-1" /> Ativa
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nome Completo</Label>
                  <Input 
                    value={profile.name} 
                    onChange={e => setProfile({...profile, name: e.target.value})}
                    className="h-11 rounded-xl bg-muted/30 focus-visible:bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">CPF / Documento</Label>
                  <Input 
                    placeholder="Somente números"
                    value={profile.cpf || ""} 
                    onChange={e => setProfile({...profile, cpf: e.target.value.replace(/\D/g, '').slice(0, 11)})}
                    className="h-11 rounded-xl bg-muted/30 focus-visible:bg-background"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">E-mail</Label>
                  <Input 
                    disabled
                    value={profile.email} 
                    className="h-11 rounded-xl bg-muted/50 text-muted-foreground cursor-not-allowed"
                  />
                  <p className="text-[10px] text-muted-foreground/70 ml-1">O e-mail de acesso não pode ser alterado.</p>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button 
                  onClick={async () => {
                    try {
                      await store.auth.updateProfile({ name: profile.name, cpf: profile.cpf });
                      toast.success("Perfil atualizado com sucesso!");
                    } catch (err: any) {
                      toast.error("Erro ao salvar perfil");
                    }
                  }}
                  className="rounded-xl h-10 font-bold px-6 bg-primary/90 hover:bg-primary"
                >
                  Salvar Perfil
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" /> Segurança
              </CardTitle>
              <CardDescription className="text-xs mt-1">Altere sua senha de acesso ao sistema.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nova Senha</Label>
                  <Input 
                    type="password" 
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="h-11 rounded-xl bg-muted/30 focus-visible:bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Confirmar Nova Senha</Label>
                  <Input 
                    type="password" 
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="Repita a senha"
                    className="h-11 rounded-xl bg-muted/30 focus-visible:bg-background"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button 
                  onClick={handleUpdatePassword}
                  disabled={updatingPass || !newPass}
                  variant="secondary"
                  className="rounded-xl h-10 font-bold px-6"
                >
                  {updatingPass ? "Atualizando..." : "Alterar Senha"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Logout */}
          <div className="pt-4">
            {!showLogoutConfirm ? (
              <Button 
                variant="outline" 
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full md:w-auto h-12 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5 hover:border-destructive/40 hover:text-destructive transition-all"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="font-bold">Sair da Conta (Logout)</span>
              </Button>
            ) : (
              <div className="p-5 bg-destructive/5 border border-destructive/20 rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                <h4 className="font-bold text-destructive text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Confirmar Saída
                </h4>
                <p className="text-xs text-muted-foreground mt-2 mb-4">
                  Seus dados estão salvos em segurança na nuvem. Você precisará do seu e-mail e senha para acessar novamente.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowLogoutConfirm(false)} className="h-10 rounded-xl text-xs font-bold flex-1">
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={handleLogout} className="h-10 rounded-xl text-xs font-bold flex-1 shadow-sm">
                    Sair Agora
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ================= ABA: SISTEMA ================= */}
        <TabsContent value="sistema" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
          
          {/* Aparência */}
          <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Aparência
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant="outline"
                  onClick={() => toggleTheme('light')}
                  className={`h-24 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all border-2 ${theme === 'light' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
                >
                  <Sun className="h-6 w-6" />
                  <span className="text-xs font-bold uppercase tracking-wider">Modo Claro</span>
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => toggleTheme('dark')}
                  className={`h-24 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all border-2 ${theme === 'dark' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
                >
                  <Moon className="h-6 w-6" />
                  <span className="text-xs font-bold uppercase tracking-wider">Modo Escuro</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Localização e Clima */}
          <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-blue-500/5 border-b border-blue-500/10 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-blue-600 dark:text-blue-500">
                <CloudRain className="h-4 w-4" /> Localização e Clima
              </CardTitle>
              <CardDescription className="text-xs mt-1">Gerencie a obtenção de dados de chuva via satélite.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-border/50">
                <div className="space-y-1 pr-4">
                  <Label className="text-sm font-bold">Pluviometria Automática</Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">Baixar histórico de chuvas automaticamente baseado nas coordenadas informadas abaixo.</p>
                </div>
                <Switch checked={useAutoRainfall} onCheckedChange={setUseAutoRainfall} />
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="lat" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Latitude</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input 
                      id="lat" 
                      value={lat} 
                      onChange={(e) => setLat(e.target.value)}
                      placeholder="-5.0892" 
                      className="pl-10 h-11 rounded-xl font-mono text-sm bg-muted/30 focus-visible:bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Longitude</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input 
                      id="lng" 
                      value={lng} 
                      onChange={(e) => setLng(e.target.value)}
                      placeholder="-42.8016" 
                      className="pl-10 h-11 rounded-xl font-mono text-sm bg-muted/30 focus-visible:bg-background"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  variant="outline" 
                  onClick={detectLocation}
                  className="flex-1 h-11 rounded-xl font-bold text-xs"
                >
                  <MapPin className="h-4 w-4 mr-2 text-blue-600" /> Usar Posição Atual do GPS
                </Button>
                <Button 
                  onClick={handleSaveLocation}
                  className="flex-1 h-11 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                  <CheckCircle className="h-4 w-4 mr-2" /> Salvar Coordenadas
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Mercado */}
          <Card className="border-pink-500/20 shadow-sm rounded-2xl overflow-hidden bg-slate-900/5 dark:bg-slate-900/40">
            <CardHeader className="bg-pink-500/5 border-b border-pink-500/10 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-pink-600 dark:text-pink-500">
                <TrendingUp className="h-4 w-4" /> Mercado (Boi Gordo)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div className="space-y-2 flex-1">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Preço Base da Arroba (@)</Label>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-pink-600 dark:text-pink-500">R$</span>
                    <Input 
                      type="number" 
                      value={marketPrice}
                      onChange={(e) => handleUpdatePrice(e.target.value)}
                      className="h-12 w-32 rounded-xl text-lg font-black bg-white dark:bg-slate-900 border-pink-200 dark:border-pink-900/50"
                    />
                  </div>
                </div>
                <div className="sm:w-auto w-full pt-6 sm:pt-0">
                  <Button 
                    onClick={syncMarket}
                    disabled={fetchingMarket}
                    className="w-full sm:w-auto h-12 rounded-xl font-bold px-6 bg-pink-600 hover:bg-pink-700 text-white shadow-sm"
                  >
                    {fetchingMarket ? "Buscando..." : "Sincronizar Mercado Atual"}
                  </Button>
                </div>
              </div>
              <div className="mt-5 p-4 bg-white/60 dark:bg-slate-950/40 rounded-xl border border-pink-500/10 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  Este valor base é utilizado nos relatórios e no simulador para prever lucro de lotes ativos. Animais que já possuem "Valor de Venda" registrado não serão alterados.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= ABA: DADOS ================= */}
        <TabsContent value="dados" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
          
          {/* Sincronização */}
          <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5 w-full md:w-auto">
                  <div className="h-16 w-16 bg-blue-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-blue-500/20">
                    {syncing ? (
                      <RotateCcw className="h-7 w-7 text-blue-600 animate-spin" />
                    ) : (
                      <Cloud className="h-7 w-7 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">Sincronização em Nuvem</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Última sincronização: <span className="font-bold text-foreground">{lastSyncFormatted}</span>
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleSync} 
                  disabled={syncing}
                  className="w-full md:w-auto h-12 rounded-xl font-bold px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                  {syncing ? "Sincronizando..." : "Forçar Sincronização"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-border/50 shadow-sm rounded-2xl">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-1">
                  <Beef className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-3xl font-black text-foreground">{counts.animals}</p>
                <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Animais</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm rounded-2xl">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-1">
                  <Activity className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-3xl font-black text-foreground">{counts.events}</p>
                <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Eventos</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm rounded-2xl">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-1">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-3xl font-black text-foreground">{counts.financials}</p>
                <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Registros Fin.</p>
              </CardContent>
            </Card>
          </div>

          {/* App Info */}
          <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden bg-muted/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 border border-primary/10">
                    <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain opacity-80" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">FazendaControl Pro</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Plataforma de Gestão Pecuária Inteligente</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-background">
                  Versão 1.5.0
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
      
      {/* Footer */}
      <p className="text-center text-[10px] text-muted-foreground/40 font-bold uppercase tracking-[0.2em] mt-12">
        FazendaControl © {new Date().getFullYear()}
      </p>
    </div>
  );
}
