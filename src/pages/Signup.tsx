import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { store } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Beef, UserPlus, Mail, Lock, User, ArrowRight, ShieldCheck } from "lucide-react";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setLoading(true);
    
    try {
      // Small delay to simulate server
      await new Promise(resolve => setTimeout(resolve, 1000));
      store.auth.signup(name, email, password);
      toast.success("Conta criada! Boas-vindas ao FazendaControl.");
      // Automatically log in
      store.auth.login(email, password);
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden p-4">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3 border border-primary/20">
            <Beef className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-black text-white tracking-tighter italic">CRIAR CONTA</h1>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden rounded-3xl">
          <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-primary to-blue-500"></div>
          <CardHeader className="pt-8 text-center pb-4">
            <CardTitle className="text-xl font-black text-white italic flex items-center justify-center gap-2">
              CADASTRO <UserPlus className="h-5 w-5 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input 
                    type="text" 
                    placeholder="Como devemos te chamar?" 
                    className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500/50 transition-all rounded-xl"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input 
                    type="email" 
                    placeholder="exemplo@fazenda.com" 
                    className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500/50 transition-all rounded-xl"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Senha (Mín. 6 dígitos)</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500/50 transition-all rounded-xl"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black italic text-lg rounded-xl shadow-lg shadow-emerald-500/20 group transition-all mt-4"
                disabled={loading}
              >
                {loading ? "CRIANDO..." : "FINALIZAR CADASTRO"} 
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </form>

            <div className="mt-6 flex flex-col items-center gap-2">
              <p className="text-sm text-slate-400">Já tem uma conta?</p>
              <Link to="/login">
                <Button variant="ghost" className="text-emerald-500 font-bold hover:bg-emerald-500/10 hover:text-emerald-500 transition-all">
                  VOLTAR PARA O LOGIN
                </Button>
              </Link>
            </div>
          </CardContent>
          <CardFooter className="bg-white/5 border-t border-white/5 py-4 justify-center">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
              <ShieldCheck className="h-3 w-3 text-emerald-500" /> SEUS DADOS PROTEGIDOS
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
