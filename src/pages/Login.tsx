import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { store } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Beef, LogIn, Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await store.auth.login(email, password);
      toast.success("Bem-vindo! Sincronizando seus dados...");
      
      // CRITICAL: Sync data from Supabase AFTER login on new device
      await store.sync();
      
      toast.success("Dados sincronizados com sucesso!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Email ou senha inválidos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden p-4">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4 border border-primary/20">
            <Beef className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-display font-black text-white tracking-tighter italic">FazendaControl</h1>
          <p className="text-slate-400 mt-2 font-medium">Gestão de Peucária Inteligente</p>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden rounded-3xl">
          <div className="h-2 w-full bg-gradient-to-r from-primary via-emerald-500 to-blue-500"></div>
          <CardHeader className="pt-8 text-center">
            <CardTitle className="text-2xl font-black text-white italic flex items-center justify-center gap-2">
              LOGIN <LogIn className="h-5 w-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 px-8 pb-8">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">E-mail Corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input 
                    type="email" 
                    placeholder="seu@parceiro.com" 
                    className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-primary/50 transition-all rounded-xl"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sua Senha</label>
                  <Link to="/forgot-password" title="Redefinir Senha" className="text-[10px] font-bold text-primary hover:underline uppercase tracking-tighter">Esqueci a senha</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-primary/50 transition-all rounded-xl"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black italic text-lg rounded-xl shadow-lg shadow-primary/20 group transition-all"
                disabled={loading}
              >
                {loading ? "SINCRONIZANDO..." : "ENTRAR NO SISTEMA"} 
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </form>

            <div className="mt-8 flex items-center gap-4">
              <div className="flex-1 h-[1px] bg-white/10"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase">Segurança Ativa</span>
              <div className="flex-1 h-[1px] bg-white/10"></div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-2">
              <p className="text-sm text-slate-400">Não possui conta ainda?</p>
              <Link to="/signup">
                <Button variant="ghost" className="text-primary font-bold hover:bg-primary/10 hover:text-primary transition-all">
                  CRIAR CONTA AGORA
                </Button>
              </Link>
            </div>
          </CardContent>
          <CardFooter className="bg-white/5 border-t border-white/5 py-4 justify-center">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
              <ShieldCheck className="h-3 w-3 text-primary" /> AMBIENTE 100% SEGURO
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
