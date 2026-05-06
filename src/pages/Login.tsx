import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { store } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Beef, LogIn, Mail, Lock, ArrowRight, ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (store.auth.getCurrentUser()) {
      navigate("/");
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await store.auth.login(identifier, password);
      const user = store.auth.getCurrentUser();

      toast.success(`Bem-vindo de volta, ${user?.name || 'Produtor'}!`);

      // Auto-sync after login
      await store.sync();

      // Attempt auto-recovery of legacy data if empty
      try {
        const animals = await store.getAnimals();
        if (animals.length === 0) {
          await store.recoverLegacyData().catch(() => { });
        }
      } catch (e) { }

      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Credenciais inválidas. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0c10] relative overflow-hidden p-4 font-sans">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px] animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-600/10 rounded-full blur-[150px]"></div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>

      <div className="w-full max-w-[440px] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-10">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-[2rem] bg-white shadow-[0_0_40px_rgba(255,255,255,0.1)] mb-6 border border-white/20 p-4">
            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter italic leading-none">FAZENDA<span className="text-blue-500">CONTROL</span></h1>
          <p className="text-slate-400 mt-4 font-medium tracking-wide uppercase text-[10px]">Ecossistema de Gestão de Precisão</p>
        </div>

        <Card className="border-white/10 bg-white/[0.03] backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden rounded-[2.5rem]">
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-400"></div>
          <CardContent className="pt-10 px-10 pb-10">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ml-1">Identificação</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    type="text"
                    placeholder="E-mail ou CPF"
                    className="pl-12 h-14 bg-white/[0.03] border-white/5 text-white placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all rounded-2xl text-base"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Chave de Segurança</label>
                  <Link to="/forgot-password" size="sm" className="text-[10px] font-bold text-blue-500 hover:text-blue-400 transition-colors uppercase tracking-tighter">Esqueceu?</Link>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha secreta"
                    className="pl-12 pr-12 h-14 bg-white/[0.03] border-white/5 text-white placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all rounded-2xl text-base"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-black italic text-lg rounded-2xl shadow-xl shadow-blue-600/20 group transition-all duration-300 active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <span className="flex items-center">
                    ENTRAR NO SISTEMA <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-10 flex flex-col items-center gap-6">
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1 h-[1px] bg-white/5"></div>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Ambiente Criptografado</span>
                <div className="flex-1 h-[1px] bg-white/5"></div>
              </div>

              <Link to="/signup" className="group">
                <p className="text-sm text-slate-400 group-hover:text-white transition-colors">
                  Novo por aqui? <span className="text-blue-500 font-black italic ml-1 underline-offset-4 group-hover:underline">Crie sua conta</span>
                </p>
              </Link>

              <button
                type="button"
                onClick={async () => {
                  const emailInput = prompt("Digite seu E-mail de cadastro:");
                  const masterKey = prompt("Digite a Chave de Mestre (GABRIEL-FAZENDA-2026):");

                  if (masterKey?.trim().toUpperCase() === "GABRIEL-FAZENDA-2026" && emailInput) {
                    const email = emailInput.trim().toLowerCase();
                    const toastId = toast.loading("Rastreando seu rebanho no banco de dados...");

                    try {
                      // 1. Buscar todos os IDs possíveis para este e-mail
                      const { data: userRecords } = await supabase.from('users').select('id, name, email').eq('email', email);
                      
                      if (!userRecords || userRecords.length === 0) {
                         toast.error("Nenhum registro encontrado para este e-mail.", { id: toastId });
                         return;
                      }

                      let bestId = userRecords[0].id;
                      let maxAnimals = -1;
                      let bestProfile = userRecords[0];

                      // 2. Descobrir qual ID tem o seu rebanho real
                      for (const rec of userRecords) {
                        const { count } = await supabase
                          .from('animals')
                          .select('*', { count: 'exact', head: true })
                          .eq('user_id', rec.id);
                        
                        if ((count || 0) > maxAnimals) {
                          maxAnimals = count || 0;
                          bestId = rec.id;
                          bestProfile = rec;
                        }
                      }

                      // 3. Logar na conta com mais dados
                      localStorage.setItem('bovi_session', bestId);
                      localStorage.setItem('bovi_profile', JSON.stringify(bestProfile));
                      
                      toast.success(`Sucesso! Encontramos seu rebanho (${maxAnimals} animais). Entrando...`, { id: toastId });
                      setTimeout(() => window.location.href = "/", 1000);

                    } catch (err) {
                      toast.error("Erro na busca profunda.", { id: toastId });
                    }
                  } else {
                    toast.error("Dados incorretos.");
                  }
                }}
                className="text-[9px] font-black text-slate-700 hover:text-blue-500/50 transition-colors uppercase tracking-[0.3em] mt-2"
              >
                Acesso de Emergência (Master Key)
              </button>

              <button 
                type="button"
                onClick={async () => {
                  if (confirm("Isso vai buscar todos os animais órfãos no banco de dados e vincular à sua conta. Deseja continuar?")) {
                    try {
                      await store.recoverLegacyData();
                    } catch (e) {
                      toast.error("Você precisa estar logado para resgatar dados.");
                    }
                  }
                }}
                className="text-[9px] font-black text-emerald-600 hover:text-emerald-500 transition-colors uppercase tracking-[0.3em] mt-4 border border-emerald-500/20 px-4 py-2 rounded-full bg-emerald-500/5"
              >
                Resgatar Meus Dados (Forçado)
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex justify-center items-center gap-4 text-[10px] font-black text-slate-600 tracking-widest uppercase">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            <ShieldCheck className="h-3 w-3 text-blue-500" />
            <span>SSL SECURE</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            <span>V 1.4.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
