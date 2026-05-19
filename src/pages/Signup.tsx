import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { store, validatePasswordStrength } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { UserPlus, Mail, Lock, User, ArrowRight, ShieldCheck, Beef, Loader2 } from "lucide-react";

export default function Signup() {
  const [name, setName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const passError = validatePasswordStrength(password);
    if (passError) {
      toast.error(passError);
      return;
    }

    setLoading(true);
    
    try {
      await store.auth.signup(name, email, password, farmName);
      toast.success("Bem-vindo à FazendaControl! Sua conta foi criada.");
      
      // Automatically log in
      await store.auth.login(email, password);
      
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar conta. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0c10] relative overflow-hidden p-4 font-sans">
      {/* Background Decor */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-600/10 rounded-full blur-[150px] animate-pulse"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px]"></div>
      
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>

      <div className="w-full max-w-[460px] relative z-10 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 mb-4 border border-white/20">
            <UserPlus className="h-8 w-8 text-blue-500" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter italic leading-none uppercase">Começar Agora</h1>
          <p className="text-slate-500 mt-2 font-medium tracking-widest text-[10px] uppercase">Criação de Perfil de Produtor</p>
        </div>

        <Card className="border-white/10 bg-white/[0.03] backdrop-blur-2xl shadow-2xl overflow-hidden rounded-[2.5rem]">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-blue-600 to-blue-400"></div>
          <CardContent className="px-10 py-10">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Seu Nome</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    <Input 
                      placeholder="Nome" 
                      className="pl-10 h-12 bg-white/[0.03] border-white/5 text-white placeholder:text-slate-600 focus:border-blue-500/50 transition-all rounded-xl text-sm"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Fazenda</label>
                  <div className="relative">
                    <Beef className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    <Input 
                      placeholder="Propriedade" 
                      className="pl-10 h-12 bg-white/[0.03] border-white/5 text-white placeholder:text-slate-600 focus:border-blue-500/50 transition-all rounded-xl text-sm"
                      value={farmName}
                      onChange={e => setFarmName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">E-mail Principal</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <Input 
                    type="email" 
                    placeholder="contato@agro.com" 
                    className="pl-10 h-12 bg-white/[0.03] border-white/5 text-white placeholder:text-slate-600 focus:border-blue-500/50 transition-all rounded-xl text-sm"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Senha (Mín. 6 dígitos)</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10 h-12 bg-white/[0.03] border-white/5 text-white placeholder:text-slate-600 focus:border-blue-500/50 transition-all rounded-xl text-sm"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-black italic text-lg rounded-2xl shadow-xl shadow-blue-600/20 group transition-all mt-4"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <span className="flex items-center">
                    FINALIZAR CADASTRO <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-8 flex flex-col items-center gap-2">
              <p className="text-sm text-slate-400">Já tem uma conta ativa?</p>
              <Link to="/login">
                <Button variant="ghost" className="text-blue-500 font-black italic hover:bg-blue-500/10 transition-all uppercase text-xs">
                  Acessar Minha Conta
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-6 flex justify-center items-center gap-4 text-[10px] font-black text-slate-600 tracking-widest uppercase">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>DADOS PROTEGIDOS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
