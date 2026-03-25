import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { store } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Beef, KeyRound, Mail, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState(1); // 1: Email, 2: New Password
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStep(2);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      await store.auth.resetPassword(email, newPassword);
      toast.success("Senha redefinida com sucesso!");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || "Erro ao redefinir senha");
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden p-4">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4 border border-primary/20">
            <Beef className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-display font-black text-white tracking-tighter italic">FazendaControl</h1>
          <p className="text-slate-400 mt-2 font-medium">Recuperação de Acesso</p>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden rounded-3xl">
          <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-primary to-emerald-500"></div>
          <CardHeader className="pt-8 text-center">
            <CardTitle className="text-2xl font-black text-white italic flex items-center justify-center gap-2 uppercase">
              {step === 1 ? "Identifique-se" : "Nova Senha"} <KeyRound className="h-5 w-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 px-8 pb-8">
            {step === 1 ? (
              <form onSubmit={handleNextStep} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Seu E-mail Cadastrado</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input 
                      type="email" 
                      placeholder="exemplo@fazenda.com" 
                      className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-primary/50 transition-all rounded-xl"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black italic text-lg rounded-xl shadow-lg shadow-primary/20 group transition-all"
                >
                  CONTINUAR <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleReset} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nova Senha</label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-primary/50 transition-all rounded-xl"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Confirmar Senha</label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-primary/50 transition-all rounded-xl"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="ghost"
                    onClick={() => setStep(1)}
                    className="h-12 border border-white/10 text-slate-400 hover:bg-white/5 rounded-xl transition-all"
                  >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 h-12 bg-primary hover:bg-primary/90 text-white font-black italic text-lg rounded-xl shadow-lg shadow-primary/20 transition-all"
                    disabled={loading}
                  >
                    {loading ? "ALTERANDO..." : "REDEFINIR SENHA"}
                  </Button>
                </div>
              </form>
            )}

            <div className="mt-8 flex items-center justify-center">
              <Link to="/login" className="text-sm text-slate-400 hover:text-primary transition-all font-bold">
                VOLTAR PARA O LOGIN
              </Link>
            </div>
          </CardContent>
          <CardFooter className="bg-white/5 border-t border-white/5 py-4 justify-center">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
              <ShieldCheck className="h-3 w-3 text-primary" /> PROTEÇÃO DE DADOS ATIVA
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
