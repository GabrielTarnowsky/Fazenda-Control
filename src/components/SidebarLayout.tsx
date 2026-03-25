import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { store } from "@/lib/store";
import { LogOut, User as UserIcon, Beef } from "lucide-react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { toast } from "sonner";

export function SidebarLayout({ children }: { children?: React.ReactNode }) {
  const user = store.auth.getCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  const handleLogout = () => {
    store.auth.logout();
    toast.success("Sessão encerrada");
    navigate("/login");
  };

  if (isAuthPage) {
    return <main className="w-full min-h-screen bg-slate-950">{children}</main>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-hidden font-sans">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto w-full p-4 md:p-8 pt-16 md:pt-8 bg-slate-50/50">
          <div className="md:hidden flex items-center justify-between fixed top-0 left-0 right-0 p-4 bg-white border-b z-20 shadow-sm">
             <div className="flex items-center gap-2">
                <Beef className="h-6 w-6 text-primary" />
                <h1 className="font-display font-black italic tracking-tighter text-primary text-xl">FazendaControl</h1>
             </div>
             <SidebarTrigger />
          </div>
          
          {/* User Header Info at the top right */}
          {user && (
            <div className="hidden md:flex justify-end items-center gap-4 mb-6 sticky top-0 bg-transparent z-10 py-2">
              <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-full shadow-md border border-border/40 hover:shadow-lg transition-shadow">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="text-left leading-tight">
                  <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Produtor Ativo</p>
                  <p className="text-sm font-black italic text-slate-800 truncate max-w-[150px]">{user.name}</p>
                </div>
                <div className="h-6 w-[1px] bg-border mx-2"></div>
                <button 
                  onClick={handleLogout}
                  className="p-1.5 rounded-full hover:bg-rose-50 hover:text-rose-500 transition-all text-slate-400"
                  title="Sair do sistema"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="animate-in fade-in duration-700">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
